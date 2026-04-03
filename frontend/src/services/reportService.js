/**
 * @module reportService
 * @purpose Generiert Markdown-Reports aus ausgewählten Artikeln
 *
 * @reads    config/prompts.js → getReportPrompt()
 * @reads    stores/articleStore.js → getArticleById()
 * @reads    stores/settingsStore.js → getNvidiaApiKey()
 * @writes   nichts (gibt Markdown-String zurück)
 * @calledBy components/ReportGenerator.jsx
 *
 * @dataflow
 *   articleIds → Artikel aus Store laden → mit User-Notes anreichern
 *   → Prompt bauen (System + Artikel-Kontext) → API-Call
 *   → Markdown-Response zurückgeben
 *
 * @exports
 *   generateReport(config: ReportConfig): Promise<string>
 *     → Gibt fertigen Markdown-Report zurück
 *
 * @errors
 *   - Kein API-Key: Error werfen
 *   - Keine Artikel gefunden: Error werfen
 *   - API-Fehler: Retry 2x, dann Error
 */

import { getReportPrompt } from "../config/prompts.js";
import { getNvidiaApiKey } from "../stores/settingsStore.js";
import { getArticleById } from "../stores/articleStore.js";
import { API_CONFIG } from "../config/settings.js";

// Use first worker for report generation (single request, larger payload)
const WORKER_URL = "https://rss-proxy-1.philipp-thuering.workers.dev";

/**
 * Build user message with articles context
 * @param {EnrichedArticle[]} articles - Selected articles
 * @param {boolean} includeUserNotes - Whether to include user notes
 * @returns {string}
 */
function buildUserMessage(articles, includeUserNotes) {
  let message = "Erstelle einen Report basierend auf folgenden Artikeln:\n\n";
  
  articles.forEach((article, index) => {
    message += `--- Artikel ${index + 1} ---\n`;
    message += `Titel: ${article.title}\n`;
    message += `Quelle: ${article.source}\n`;
    message += `Datum: ${article.published}\n`;
    
    if (article.summary_de) {
      message += `Zusammenfassung: ${article.summary_de}\n`;
    }
    
    if (article.scores) {
      message += `Scores: ÖV=${article.scores.oepnv_direkt}, TT=${article.scores.tech_transfer}, FÖ=${article.scores.foerder}, MA=${article.scores.markt}\n`;
    }
    
    if (article.tags && article.tags.length > 0) {
      message += `Tags: ${article.tags.join(", ")}\n`;
    }
    
    if (includeUserNotes && article.userNotes) {
      message += `Eigene Notizen: ${article.userNotes}\n`;
    } else {
      message += `Eigene Notizen: keine\n`;
    }
    
    message += "\n";
  });
  
  return message;
}

/**
 * Generate a report using AI
 * @param {ReportConfig} config - Report configuration
 * @returns {Promise<string>} - Generated markdown report
 * @throws {Error} - If API key missing, no articles, or API fails
 */
export async function generateReport(config, onChunk) {
  const { articleIds, audience, focus, length, includeUserNotes } = config;

  // Validate API key
  const apiKey = await getNvidiaApiKey();
  if (!apiKey) {
    throw new Error("Kein API-Key vorhanden. Bitte in den Einstellungen hinterlegen.");
  }
  
  // Validate articles
  if (!articleIds || articleIds.length === 0) {
    throw new Error("Keine Artikel ausgewählt.");
  }
  
  // Load articles from store
  const articles = [];
  for (const id of articleIds) {
    const article = await getArticleById(id);
    if (article) {
      articles.push(article);
    }
  }
  
  if (articles.length === 0) {
    throw new Error("Keine Artikel gefunden.");
  }
  
  // Build prompts
  const systemPrompt = getReportPrompt({ audience, focus, length });
  const userMessage = buildUserMessage(articles, includeUserNotes);

  // API call with retries
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`${WORKER_URL}/api/nvidia`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: API_CONFIG.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          temperature: 0.5,
          max_tokens: 5000000,
          stream: true,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API-Fehler: ${errorData.message || response.statusText}`);
      }

      // Parse SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep last potentially incomplete line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              if (onChunk) onChunk(fullText);
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      if (fullText) return fullText.trim();
      throw new Error("Keine Antwort von der API erhalten");
    } catch (error) {
      lastError = error;
      console.warn(`Report generation attempt ${attempt + 1} failed:`, error);
      
      // Wait before retry (exponential backoff)
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  
  throw new Error(`Report-Generierung fehlgeschlagen nach 3 Versuchen: ${lastError.message}`);
}

/**
 * Generate a simple template-based report (fallback)
 * @param {ReportConfig} config - Report configuration
 * @returns {Promise<string>} - Markdown report
 */
export async function generateSimpleReport(config) {
  const { articleIds, includeUserNotes } = config;
  
  // Load articles from store
  const articles = [];
  for (const id of articleIds) {
    const article = await getArticleById(id);
    if (article) {
      articles.push(article);
    }
  }
  
  if (articles.length === 0) {
    throw new Error("Keine Artikel gefunden.");
  }
  
  const now = new Date().toLocaleDateString("de-DE");
  
  const audienceLabels = {
    geschaeftsfuehrung: "Geschäftsführung",
    fachabteilung: "Fachabteilung",
    foerderantrag: "Förderantrag",
  };

  const focusLabels = {
    technologie: "Technologie",
    wettbewerb: "Wettbewerb",
    foerderpotential: "Förderpotential",
    allgemein: "Allgemein",
  };

  let report = `# Trend Radar Report

**Datum:** ${now}  
**Zielgruppe:** ${audienceLabels[config.audience] || config.audience}  
**Fokus:** ${focusLabels[config.focus] || config.focus}  
**Ausgewählte Artikel:** ${articles.length}

---

`;

  // Executive Summary
  report += `## Executive Summary

Dieser Report enthält ${articles.length} ausgewählte Artikel zum Thema ÖPNV-Digitalisierung.

`;

  // Articles
  report += `## Artikelübersicht

`;

  articles.forEach((article, index) => {
    report += `### ${index + 1}. ${article.title}

**Quelle:** ${article.source}  
**Kategorie:** ${article.sourceCategory}  
**Veröffentlicht:** ${new Date(article.published).toLocaleDateString("de-DE")}

${article.summary_de || article.content.substring(0, 500) + "..."}

`;

    if (article.scores) {
      report += `**Bewertung:**  
`;
      report += `- ÖPNV-Relevanz: ${article.scores.oepnv_direkt}/10  \n`;
      report += `- Tech-Transfer: ${article.scores.tech_transfer}/10  \n`;
      report += `- Förderrelevanz: ${article.scores.foerder}/10  \n`;
      report += `- Marktrelevanz: ${article.scores.markt}/10  \n\n`;
    }

    if (includeUserNotes && article.userNotes) {
      report += `**Notizen:** ${article.userNotes}\n\n`;
    }

    report += `[Original lesen](${article.url})\n\n---\n\n`;
  });

  // Sources
  report += `## Quellen

`;
  const uniqueSources = [...new Set(articles.map((a) => a.source))];
  uniqueSources.forEach((source) => {
    report += `- ${source}\n`;
  });

  report += `\n---\n*Generiert mit Trend Radar*\n`;

  return report;
}

/**
 * Download report as file
 * @param {string} content - Report content
 * @param {string} filename - Filename
 */
export function downloadReport(content, filename = "report.md") {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy report to clipboard
 * @param {string} content - Report content
 * @returns {Promise<boolean>}
 */
export async function copyReportToClipboard(content) {
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}

export default {
  generateReport,
  generateSimpleReport,
  downloadReport,
  copyReportToClipboard,
};
