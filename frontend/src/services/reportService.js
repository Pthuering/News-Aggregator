/**
 * @module reportService
 * @purpose Generate markdown reports from articles
 *
 * @reads    prompts.js → reportPrompt
 * @reads    settingsStore.js → getAnthropicApiKey()
 * @calledBy ReportGenerator.jsx → on generate
 * @calls    Anthropic API → for AI-generated reports
 *
 * @dataflow ReportConfig + Articles → AI/Template → Markdown
 *
 * @exports
 *   generateReport(config: ReportConfig, articles: EnrichedArticle[]): Promise<string>
 *   generateSimpleReport(config: ReportConfig, articles: EnrichedArticle[]): string
 *
 * @errors Falls back to template if AI fails
 */

import { reportPrompt } from "../config/prompts.js";
import { getAnthropicApiKey } from "../stores/settingsStore.js";
import { settings } from "../config/settings.js";

/**
 * Generate a report using AI
 * @param {ReportConfig} config - Report configuration
 * @param {EnrichedArticle[]} articles - Selected articles
 * @returns {Promise<string>} - Generated markdown report
 */
export async function generateReport(config, articles) {
  const apiKey = await getAnthropicApiKey();
  
  if (!apiKey) {
    console.warn("No API key, falling back to template report");
    return generateSimpleReport(config, articles);
  }

  // Prepare articles summary
  const articlesText = articles
    .map(
      (a, i) => `
${i + 1}. ${a.title}
   Quelle: ${a.source}
   ${a.summary_de || a.content.substring(0, 300) + "..."}
   ${a.userNotes ? `Notizen: ${a.userNotes}` : ""}
`
    )
    .join("\n");

  const prompt = reportPrompt
    .replace("{{length}}", config.length)
    .replace("{{audience}}", config.audience)
    .replace("{{focus}}", config.focus)
    .replace("{{articles}}", articlesText)
    .replace("{{#includeUserNotes}}", config.includeUserNotes ? "true" : "")
    .replace("{{userNotes}}", config.includeUserNotes ? "Nutzer-Notizen sind enthalten" : "");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: settings.anthropic.model,
        max_tokens: settings.anthropic.maxTokens,
        temperature: 0.5,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error("API request failed");
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error("AI report generation failed:", error);
    return generateSimpleReport(config, articles);
  }
}

/**
 * Generate a simple template-based report
 * @param {ReportConfig} config - Report configuration
 * @param {EnrichedArticle[]} articles - Selected articles
 * @returns {string} - Markdown report
 */
export function generateSimpleReport(config, articles) {
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
**Zielgruppe:** ${audienceLabels[config.audience] || config.ausience}  
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

    if (config.includeUserNotes && article.userNotes) {
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
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default {
  generateReport,
  generateSimpleReport,
  downloadReport,
};
