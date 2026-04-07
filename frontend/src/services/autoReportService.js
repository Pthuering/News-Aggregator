/**
 * @module autoReportService
 * @purpose Wählt signifikante tiefenanalysierte Artikel automatisch aus und
 *          generiert einen thematisch synthetisierten Wochen-Report
 *
 * @reads    stores/articleStore.js → getAllArticles(), deepClassifiedAt
 * @reads    stores/settingsStore.js → getNvidiaApiKey()
 * @reads    config/prompts.js → getAutoReportPrompt()
 * @reads    config/settings.js → API_CONFIG
 * @reads    utils/keywordUtils.js → normalizeKeyword() (für Trend-Erkennung)
 * @calledBy App.jsx → "Auto-Report"-Button
 *
 * @exports
 *   selectSignificantArticles(articles: ClassifiedArticle[]): { significantArticles, totalClassified, totalDeep }
 *   generateAutoReport(significantArticles: SignificantArticle[], onChunk): Promise<string>
 *
 * @types
 *   SignificantArticle: {
 *     article: ClassifiedArticle,
 *     reasons: SignificanceReason[],
 *     totalScore: number
 *   }
 *   SignificanceReason: {
 *     type: "oepnv" | "transfer" | "foerder" | "markt" | "synergie" | "lvb" | "trend",
 *     label: string,
 *     score: number
 *   }
 */

import { normalizeKeyword } from "../utils/keywordUtils.js";
import { getAutoReportPrompt } from "../config/prompts.js";
import { getNvidiaApiKey } from "../stores/settingsStore.js";
import { API_CONFIG } from "../config/settings.js";

const MAX_ARTICLES = 15;
const MIN_ARTICLES = 3;

// Cycle through worker proxies
const WORKER_URLS = [
  "https://rss-proxy-1.philipp-thuering.workers.dev",
  "https://rss-proxy-2.philipp-thuering.workers.dev",
  "https://rss-proxy-3.philipp-thuering.workers.dev",
  "https://rss-proxy-4.philipp-thuering.workers.dev",
];
let proxyIndex = 0;
function nextProxy() {
  const url = WORKER_URLS[proxyIndex % WORKER_URLS.length];
  proxyIndex++;
  return url;
}

/**
 * Analyse articles and select the most significant ones.
 * Prefers deep-classified articles (with full content from Tiefenanalyse).
 * @param {ClassifiedArticle[]} articles - All articles to consider
 * @returns {{ significantArticles: SignificantArticle[], totalClassified: number, totalDeep: number }}
 */
export function selectSignificantArticles(articles) {
  // Only consider classified articles, prefer deep-classified
  const classified = articles.filter(a => a.scores && a.classifiedAt);
  const deepClassified = classified.filter(a => a.deepClassifiedAt);

  if (classified.length === 0) {
    return { significantArticles: [], totalClassified: 0, totalDeep: 0 };
  }

  // Use deep-classified if available, otherwise fall back to all classified
  const pool = deepClassified.length > 0 ? deepClassified : classified;

  // Build tag frequency map for trend detection
  const tagCounts = {};
  pool.forEach(a => {
    if (a.tags) {
      a.tags.forEach(tag => {
        const normalized = normalizeKeyword(tag);
        tagCounts[normalized] = (tagCounts[normalized] || 0) + 1;
      });
    }
  });
  const trendTags = new Set(
    Object.entries(tagCounts)
      .filter(([, count]) => count >= 3)
      .map(([tag]) => tag)
  );

  // Evaluate each article
  const evaluated = pool.map(article => {
    const reasons = [];
    const { scores } = article;

    if (scores.oepnv_direkt >= 7) {
      reasons.push({
        type: "oepnv",
        label: `Direkt relevant für den ÖPNV-Betrieb (Score: ${scores.oepnv_direkt})`,
        score: scores.oepnv_direkt,
      });
    }

    if (scores.tech_transfer >= 7) {
      reasons.push({
        type: "transfer",
        label: `Technologie-Transfer-Potenzial (Score: ${scores.tech_transfer})`,
        score: scores.tech_transfer,
      });
    }

    if (scores.foerder >= 6) {
      reasons.push({
        type: "foerder",
        label: `Fördermöglichkeit / regulatorisches Signal (Score: ${scores.foerder})`,
        score: scores.foerder,
      });
    }

    if (scores.markt >= 7) {
      reasons.push({
        type: "markt",
        label: `Wettbewerbs-/Marktbewegung (Score: ${scores.markt})`,
        score: scores.markt,
      });
    }

    if (article.synergies && article.synergies.length > 0) {
      article.synergies
        .filter(s => s.score >= 6)
        .forEach(s => {
          reasons.push({
            type: "synergie",
            label: `Synergie mit Projekt '${s.projectName}': ${s.relevance}`,
            score: s.score,
          });
        });
    }

    if (article.lvb_status === "in_planung" || article.lvb_status === "neu") {
      reasons.push({
        type: "lvb",
        label: `LVB-Bezug: Technologie ist bei der LVB ${article.lvb_status}`,
        score: 7,
      });
    }

    if (article.tags) {
      article.tags.forEach(tag => {
        const normalized = normalizeKeyword(tag);
        if (trendTags.has(normalized)) {
          reasons.push({
            type: "trend",
            label: `Trend-Signal: '${tag}' taucht in ${tagCounts[normalized]} aktuellen Artikeln auf`,
            score: 5,
          });
        }
      });
    }

    const highestScoreSum = Object.values(scores).reduce((sum, v) => sum + v, 0);
    const synergyBonus = (article.synergies || [])
      .filter(s => s.score >= 6)
      .reduce((sum, s) => sum + s.score, 0);
    const totalScore = highestScoreSum + synergyBonus;

    return { article, reasons, totalScore };
  });

  const significant = evaluated
    .filter(e => e.reasons.length > 0)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, MAX_ARTICLES);

  return {
    significantArticles: significant,
    totalClassified: classified.length,
    totalDeep: deepClassified.length,
  };
}

/**
 * Check if enough significant articles were found.
 * @param {SignificantArticle[]} significantArticles
 * @returns {{ sufficient: boolean, message?: string }}
 */
export function checkMinimumArticles(significantArticles) {
  if (significantArticles.length < MIN_ARTICLES) {
    return {
      sufficient: false,
      message: `Nur ${significantArticles.length} signifikante Artikel gefunden (Minimum: ${MIN_ARTICLES}). Keine ausreichend relevanten Artikel in dieser Runde.`,
    };
  }
  return { sufficient: true };
}

/**
 * Build the user message with full article content for the synthesized report.
 * @param {SignificantArticle[]} significantArticles
 * @returns {string}
 */
function buildUserMessage(significantArticles) {
  let message = `Erstelle einen thematisch gegliederten Wochenbericht über die folgenden ${significantArticles.length} als besonders relevant erkannten Artikel:\n\n`;

  significantArticles.forEach((item, index) => {
    const { article, reasons } = item;
    message += `--- Artikel ${index + 1} ---\n`;
    message += `Titel: ${article.title}\n`;
    message += `Quelle: ${article.source}\n`;
    message += `URL: ${article.url}\n`;
    message += `Datum: ${article.published}\n`;
    message += `Zusammenfassung: ${article.summary_de || ""}\n`;
    message += `Tags: ${(article.tags || []).join(", ")}\n`;
    message += `Scores: ÖV=${article.scores.oepnv_direkt}, TT=${article.scores.tech_transfer}, Förder=${article.scores.foerder}, Markt=${article.scores.markt}\n`;
    // Include full content if available (from deep classification)
    if (article.content && article.content.length > 500) {
      message += `Inhalt: ${article.content.substring(0, 4000)}\n`;
    }
    message += `Signifikanz-Gründe:\n`;
    reasons.forEach(r => {
      message += `- ${r.label}\n`;
    });
    if (article.synergies && article.synergies.length > 0) {
      article.synergies.forEach(s => {
        message += `- Synergie mit Projekt '${s.projectName}': ${s.relevance}\n`;
      });
    }
    message += "\n";
  });

  return message;
}

/**
 * Generate the auto-report directly via streaming API call.
 * @param {SignificantArticle[]} significantArticles
 * @param {Function} onChunk - Called with accumulated text on each chunk
 * @returns {Promise<string>} - Full generated markdown report
 */
export async function generateAutoReport(significantArticles, onChunk) {
  const apiKey = await getNvidiaApiKey();

  if (!significantArticles || significantArticles.length === 0) {
    throw new Error("Keine signifikanten Artikel ausgewählt.");
  }

  const systemPrompt = getAutoReportPrompt();
  const userMessage = buildUserMessage(significantArticles);

  if (onChunk) onChunk("");

  const proxy = nextProxy();
  const response = await fetch(`${proxy}/api/nvidia`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: API_CONFIG.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.5,
      max_tokens: 16384,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API Error ${response.status}: ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
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

  if (!fullText) throw new Error("Keine Antwort von der API erhalten.");
  return fullText.trim();
}
