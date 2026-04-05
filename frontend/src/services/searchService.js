/**
 * @module searchService
 * @purpose Web-Recherche über DuckDuckGo + CORS Proxy + KI-Report
 *
 * @reads    stores/settingsStore.js → getNvidiaApiKey()
 * @reads    config/prompts.js → getSearchReportPrompt()
 * @calledBy components/OpenSearch.jsx
 *
 * @exports
 *   searchWeb(query, options, onProgress): Promise<WebResult[]>
 *   generateSearchReport(query, results, onChunk): Promise<string>
 */

import { getNvidiaApiKey } from "../stores/settingsStore.js";
import { getSearchRelevancePrompt, getSearchReportPrompt } from "../config/prompts.js";
import { API_CONFIG } from "../config/settings.js";

const PROXY_URLS = [
  "https://rss-proxy-1.philipp-thuering.workers.dev",
  "https://rss-proxy-2.philipp-thuering.workers.dev",
  "https://rss-proxy-3.philipp-thuering.workers.dev",
  "https://rss-proxy-4.philipp-thuering.workers.dev",
];

const DDG_BASE = "https://html.duckduckgo.com/html/";
const MAX_SEARCH_RESULTS = 25;
const MAX_PAGE_FETCH = 8;
const SCORE_BATCH_SIZE = 5;

/* ---------- proxy helpers ---------- */

let proxyIdx = 0;
function nextProxy() {
  return PROXY_URLS[proxyIdx++ % PROXY_URLS.length];
}

async function proxyFetch(url, proxy) {
  const p = proxy || nextProxy();
  const resp = await fetch(`${p}/?url=${encodeURIComponent(url)}`);
  if (!resp.ok) throw new Error(`Proxy ${resp.status}`);
  return resp.text();
}

/* ---------- DuckDuckGo HTML parsing ---------- */

function parseDDGResults(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const results = [];

  doc.querySelectorAll(".result").forEach((el) => {
    const linkEl = el.querySelector(".result__a");
    const snippetEl = el.querySelector(".result__snippet");
    if (!linkEl) return;

    let href = linkEl.getAttribute("href") || "";

    // DDG redirect: //duckduckgo.com/l/?uddg=ENCODED_URL&rut=…
    if (href.includes("uddg=")) {
      const m = href.match(/[?&]uddg=([^&]+)/);
      if (m) href = decodeURIComponent(m[1]);
    }
    if (!href.startsWith("http")) return;

    results.push({
      title: linkEl.textContent.trim(),
      url: href,
      snippet: snippetEl ? snippetEl.textContent.trim() : "",
    });
  });

  return results.slice(0, MAX_SEARCH_RESULTS);
}

/* ---------- page content extraction ---------- */

function extractPageContent(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Remove noise elements
  const noise =
    "script,style,nav,footer,header,aside,iframe,form,noscript,svg," +
    ".cookie,.banner,.ad,.sidebar,.menu,.navigation,.comments,.social";
  doc.querySelectorAll(noise).forEach((el) => el.remove());

  const main = doc.querySelector(
    "article, main, [role='main'], .article-body, .post-content, .entry-content, .content"
  );
  const text = (main || doc.body)?.textContent || "";
  return text.replace(/\s+/g, " ").trim().slice(0, 3000);
}

/* ---------- public API ---------- */

/**
 * Search the web via DuckDuckGo (through CORS proxy)
 * @param {string} query
 * @param {object} options - { dateFilter: "d"|"w"|"m"|"y"|null }
 * @param {function} onProgress - status string callback
 * @returns {Promise<Array<{title, url, snippet}>>}
 */
export async function searchWeb(query, options = {}, onProgress) {
  const { dateFilter = null } = options;

  if (onProgress) onProgress("Websuche wird durchgeführt…");

  const params = new URLSearchParams({ q: query, kl: "de-de" });
  if (dateFilter) params.set("df", dateFilter);

  const ddgUrl = `${DDG_BASE}?${params}`;
  const html = await proxyFetch(ddgUrl);
  const results = parseDDGResults(html);

  if (onProgress) onProgress(`${results.length} Ergebnisse gefunden`);
  return results;
}

/* ---------- LLM relevance scoring ---------- */

async function scoreBatch(apiKey, query, items) {
  const prompt = getSearchRelevancePrompt();
  const list = items
    .map(
      (r, i) =>
        `[${i}] "${r.title}"\n    URL: ${r.url}\n    ${(r.content || r.snippet || "").slice(0, 400)}`
    )
    .join("\n");

  const userMsg = `Suchanfrage: "${query}"\n\nErgebnisse:\n${list}`;

  const response = await fetch(`${nextProxy()}/api/nvidia`, {
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

  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
}

/**
 * Score web results for relevance using LLM.
 * Fetches page content first, then scores in batches.
 * @param {string} query
 * @param {Array<{title, url, snippet}>} results - raw DDG results
 * @param {function} onProgress - (statusMsg: string) callback
 * @returns {Promise<Array<{title, url, snippet, content, relevance, reasoning}>>}
 */
export async function scoreResults(query, results, onProgress) {
  const apiKey = await getNvidiaApiKey();
  if (!apiKey) throw new Error("Kein API-Key vorhanden. Bitte in den Einstellungen hinterlegen.");

  /* 1 — fetch page contents in parallel */
  if (onProgress) onProgress("Seiteninhalte werden geladen…");
  const toFetch = results.slice(0, MAX_PAGE_FETCH);
  const settled = await Promise.allSettled(
    toFetch.map((r) =>
      proxyFetch(r.url)
        .then((html) => ({ ...r, content: extractPageContent(html) }))
        .catch(() => ({ ...r, content: "" }))
    )
  );
  const enriched = settled
    .filter((s) => s.status === "fulfilled")
    .map((s) => s.value);

  // Add remaining results without content
  const remaining = results.slice(MAX_PAGE_FETCH).map((r) => ({ ...r, content: "" }));
  const all = [...enriched, ...remaining];

  /* 2 — score in batches */
  const scored = [];
  const batches = [];
  for (let i = 0; i < all.length; i += SCORE_BATCH_SIZE) {
    batches.push(all.slice(i, i + SCORE_BATCH_SIZE));
  }

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    if (onProgress)
      onProgress(`KI bewertet Ergebnisse… (${bi * SCORE_BATCH_SIZE + 1}–${Math.min((bi + 1) * SCORE_BATCH_SIZE, all.length)} / ${all.length})`);

    try {
      const scores = await scoreBatch(apiKey, query, batch);
      for (const s of scores) {
        if (batch[s.articleIndex]) {
          scored.push({
            ...batch[s.articleIndex],
            relevance: s.relevance,
            reasoning: s.reasoning || "",
          });
        }
      }
    } catch (err) {
      console.warn(`Batch ${bi} scoring failed:`, err);
      // Still include unscored items
      for (const item of batch) {
        if (!scored.some((s) => s.url === item.url)) {
          scored.push({ ...item, relevance: -1, reasoning: "" });
        }
      }
    }
  }

  scored.sort((a, b) => b.relevance - a.relevance);
  return scored;
}

/**
 * Generate a structured report from web search results (streaming).
 * Fetches page content for the top results before calling the LLM.
 * @param {string} query
 * @param {Array<{title, url, snippet}>} results
 * @param {function} onChunk - streaming callback with accumulated text
 * @returns {Promise<string>}
 */
export async function generateSearchReport(query, results, onChunk) {
  const apiKey = await getNvidiaApiKey();
  if (!apiKey) throw new Error("Kein API-Key vorhanden.");

  // If results already have content (from scoring), use directly;
  // otherwise fetch page content now.
  const hasContent = results.some((r) => r.content);
  let enriched;
  let remaining;

  if (hasContent) {
    enriched = results.slice(0, 20);
    remaining = [];
  } else {
    const toFetch = results.slice(0, MAX_PAGE_FETCH);
    if (onChunk) onChunk("_Seiteninhalte werden geladen…_\n");

    const settled = await Promise.allSettled(
      toFetch.map((r) =>
        proxyFetch(r.url)
          .then((html) => ({ ...r, content: extractPageContent(html) }))
          .catch(() => ({ ...r, content: "" }))
      )
    );
    enriched = settled
      .filter((s) => s.status === "fulfilled")
      .map((s) => s.value);
    remaining = results.slice(MAX_PAGE_FETCH);
  }

  /* build user message */
  let userMsg = `Web-Recherche für: "${query}"\n`;
  userMsg += `${results.length} Suchergebnisse insgesamt.\n\n`;

  enriched.forEach((r, i) => {
    userMsg += `--- Quelle ${i + 1}`;
    if (r.relevance != null && r.relevance >= 0) userMsg += ` (Relevanz: ${r.relevance}/10)`;
    userMsg += ` ---\n`;
    userMsg += `Titel: ${r.title}\n`;
    userMsg += `URL: ${r.url}\n`;
    userMsg += `Snippet: ${r.snippet}\n`;
    if (r.content) {
      userMsg += `Seiteninhalt (Auszug): ${r.content.slice(0, 2000)}\n`;
    }
    if (r.reasoning) {
      userMsg += `Relevanz-Grund: ${r.reasoning}\n`;
    }
    userMsg += "\n";
  });

  if (remaining.length > 0) {
    userMsg += "\nWeitere Ergebnisse (nur Snippet):\n";
    remaining.forEach((r, i) => {
      userMsg += `${enriched.length + i + 1}. "${r.title}" – ${r.snippet}\n`;
    });
  }

  /* 3 — stream report from LLM */
  if (onChunk) onChunk("");

  const systemPrompt = getSearchReportPrompt(query);
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
      fullText =
        data.choices?.[0]?.message?.content ||
        data.choices?.[0]?.message?.reasoning_content ||
        "";
    } catch {
      // ignore
    }
  }

  if (!fullText) throw new Error("Keine Antwort von der API erhalten.");
  return fullText.trim();
}
