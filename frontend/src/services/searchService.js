/**
 * @module searchService
 * @purpose KI-gestützte Themenrecherche über vorhandene Artikel
 *
 * @reads    stores/articleStore.js → getAllArticles()
 * @reads    stores/settingsStore.js → getNvidiaApiKey()
 * @reads    config/prompts.js → getSearchRelevancePrompt(), getSearchReportPrompt()
 * @calledBy components/OpenSearch.jsx
 *
 * @exports
 *   searchArticles(query, options): Promise<SearchResult[]>
 *   generateSearchReport(query, results, onChunk): Promise<string>
 */

import { getAllArticles } from "../stores/articleStore.js";
import { getNvidiaApiKey } from "../stores/settingsStore.js";
import { getSearchRelevancePrompt, getSearchReportPrompt } from "../config/prompts.js";
import { API_CONFIG } from "../config/settings.js";

const WORKER_URL = "https://rss-proxy-1.philipp-thuering.workers.dev";
const BATCH_SIZE = 3; // articles per LLM call for relevance scoring

/**
 * Pre-filter articles by keyword overlap (cheap, no API call)
 */
function preFilter(articles, query, maxDays) {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  let pool = articles;

  // Date filter
  if (maxDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxDays);
    pool = pool.filter((a) => new Date(a.published) >= cutoff);
  }

  // Score each article by keyword overlap
  return pool
    .map((article) => {
      const text = [
        article.title || "",
        article.summary_de || "",
        article.description || "",
        ...(article.tags || []),
      ]
        .join(" ")
        .toLowerCase();

      let hits = 0;
      for (const term of terms) {
        if (text.includes(term)) hits++;
      }
      return { article, hits };
    })
    .filter((r) => r.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map((r) => r.article);
}

/**
 * Call NVIDIA API for relevance scoring of a batch
 */
async function scoreBatch(apiKey, query, articles) {
  const prompt = getSearchRelevancePrompt();

  const articleList = articles
    .map(
      (a, i) =>
        `[${i}] "${a.title}" (${a.source}, ${a.published?.split("T")[0] || "?"})${
          a.summary_de ? "\n    " + a.summary_de.slice(0, 200) : ""
        }`
    )
    .join("\n");

  const userMsg = `Suchanfrage: "${query}"\n\nArtikel:\n${articleList}`;

  const response = await fetch(`${WORKER_URL}/api/nvidia`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: API_CONFIG.model,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: userMsg },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API Error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const content =
    data.choices?.[0]?.message?.content ||
    data.choices?.[0]?.message?.reasoning_content ||
    "";

  // Extract JSON from potential markdown wrapper
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
}

/**
 * Search articles by query using keyword pre-filter + LLM relevance scoring
 * @param {string} query - Search query
 * @param {object} options - { maxDays, minRelevance }
 * @param {function} onProgress - Progress callback (current, total)
 * @returns {Promise<Array<{article, relevance, reasoning}>>}
 */
export async function searchArticles(query, options = {}, onProgress) {
  const { maxDays = null, minRelevance = 4 } = options;

  const apiKey = await getNvidiaApiKey();
  if (!apiKey) {
    throw new Error("Kein API-Key vorhanden. Bitte in den Einstellungen hinterlegen.");
  }

  // 1. Get all articles and pre-filter by keyword
  const allArticles = await getAllArticles();
  const candidates = preFilter(allArticles, query, maxDays);

  if (candidates.length === 0) {
    return [];
  }

  // Limit to top 30 candidates for API scoring
  const toScore = candidates.slice(0, 30);
  const results = [];

  // 2. Score in batches via LLM
  const batches = [];
  for (let i = 0; i < toScore.length; i += BATCH_SIZE) {
    batches.push(toScore.slice(i, i + BATCH_SIZE));
  }

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    if (onProgress) onProgress(bi * BATCH_SIZE, toScore.length);

    try {
      const scores = await scoreBatch(apiKey, query, batch);
      for (const s of scores) {
        if (s.relevance >= minRelevance && batch[s.articleIndex]) {
          results.push({
            article: batch[s.articleIndex],
            relevance: s.relevance,
            reasoning: s.reasoning || "",
          });
        }
      }
    } catch (err) {
      console.warn(`Batch ${bi} scoring failed:`, err);
    }
  }

  if (onProgress) onProgress(toScore.length, toScore.length);

  // 3. Sort by relevance descending
  results.sort((a, b) => b.relevance - a.relevance);
  return results;
}

/**
 * Generate a structured report from search results (streaming)
 * @param {string} query - Original search query
 * @param {Array} results - Search results with articles
 * @param {function} onChunk - Streaming callback with accumulated text
 * @returns {Promise<string>} - Final markdown report
 */
export async function generateSearchReport(query, results, onChunk) {
  const apiKey = await getNvidiaApiKey();
  if (!apiKey) {
    throw new Error("Kein API-Key vorhanden.");
  }

  const systemPrompt = getSearchReportPrompt(query);

  // Build context from top results
  const topResults = results.slice(0, 20);
  let userMsg = `Recherche-Ergebnis für: "${query}"\n\n`;
  userMsg += `${topResults.length} relevante Artikel gefunden:\n\n`;

  topResults.forEach((r, i) => {
    userMsg += `--- Artikel ${i + 1} (Relevanz: ${r.relevance}/10) ---\n`;
    userMsg += `Titel: ${r.article.title}\n`;
    userMsg += `Quelle: ${r.article.source}\n`;
    userMsg += `Datum: ${r.article.published?.split("T")[0] || "?"}\n`;
    if (r.article.summary_de) {
      userMsg += `Zusammenfassung: ${r.article.summary_de}\n`;
    }
    if (r.article.tags?.length) {
      userMsg += `Tags: ${r.article.tags.join(", ")}\n`;
    }
    userMsg += `Relevanz-Grund: ${r.reasoning}\n\n`;
  });

  const response = await fetch(`${WORKER_URL}/api/nvidia`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: API_CONFIG.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
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
        // skip
      }
    }
  }

  // Fallback for non-streaming responses
  if (!fullText) {
    try {
      const data = JSON.parse(buffer || "{}");
      fullText = data.choices?.[0]?.message?.content || 
                 data.choices?.[0]?.message?.reasoning_content || "";
    } catch {
      // ignore
    }
  }

  if (!fullText) throw new Error("Keine Antwort von der API erhalten.");
  return fullText.trim();
}
