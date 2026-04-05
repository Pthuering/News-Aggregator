/**
 * @module feedService
 * @purpose Holt RSS-Feeds via CORS-Proxy, parst XML, normalisiert zu RawArticle[]
 *
 * @reads    config/sources.js → getActiveSources()
 * @reads    config/settings.js → getProxyUrl()
 * @calls    stores/articleStore.js → saveArticles(), articleExists()
 * @calls    utils/hash.js → hashString()
 * @calledBy App.jsx → Button "Feeds aktualisieren"
 *
 * @dataflow
 *   getActiveSources() → pro Quelle: fetch(proxyUrl + feedUrl)
 *   → XML parsen (DOMParser) → Einträge normalisieren zu RawArticle
 *   → Deduplizieren gegen articleStore → saveArticles()
 *
 * @exports
 *   fetchAllFeeds(): Promise<IngestResult>
 *     → Holt alle aktiven Feeds, speichert neue Artikel
 *     → IngestResult: { newCount: number, skipped: number, errors: SourceError[] }
 *
 *   fetchSingleFeed(source: SourceConfig): Promise<RawArticle[]>
 *     → Einzelner Feed, gibt geparste Artikel zurück ohne zu speichern
 *
 * @errors
 *   - Timeout pro Feed: 10s, dann SourceError und weiter zum nächsten
 *   - XML-Parse-Fehler: SourceError, Feed wird übersprungen
 *   - Einzelne Feed-Fehler stoppen NICHT den Gesamtprozess
 */

import { getActiveSources as getActiveSourcesFromStore, updateSource } from "../stores/sourceStore.js";
import { getProxyUrl } from "../config/settings.js";
import { saveArticles, clearArticles } from "../stores/articleStore.js";
import { hashString } from "../utils/hash.js";

const FETCH_TIMEOUT = 10000; // 10 seconds

/**
 * Fetch all active feeds
 * @returns {Promise<{newCount: number, skipped: number, errors: Array}>}
 */
export async function fetchAllFeeds() {
  const sources = await getActiveSourcesFromStore();
  const results = {
    newCount: 0,
    skipped: 0,
    errors: [],
  };

  // Clear all existing articles before fetching fresh ones
  await clearArticles();

  // Fetch all feeds in parallel
  const fetchPromises = sources.map(async (source) => {
    try {
      const articles = await fetchSingleFeed(source);
      // Update source tracking
      await updateSource(source.id, {
        lastFetched: new Date().toISOString(),
        lastError: null,
        articleCount: articles.length,
      });
      return { source, articles, error: null };
    } catch (error) {
      // Track error on the source
      await updateSource(source.id, {
        lastError: error.message,
      }).catch(() => {});
      return { source, articles: [], error };
    }
  });

  const settled = await Promise.allSettled(fetchPromises);

  // Process results
  for (const result of settled) {
    if (result.status === "fulfilled") {
      const { source, articles, error } = result.value;

      if (error) {
        results.errors.push({
          source: source.name,
          error: error.message,
        });
        continue;
      }

      results.newCount += articles.length;

      // Save articles
      if (articles.length > 0) {
        await saveArticles(articles);
      }
    } else {
      results.errors.push({
        source: "unknown",
        error: result.reason?.message || "Unknown error",
      });
    }
  }

  return results;
}

/**
 * Fetch and parse a single feed
 * @param {SourceConfig} source - Feed source
 * @returns {Promise<RawArticle[]>}
 */
export async function fetchSingleFeed(source) {
  const proxyUrl = getProxyUrl();
  const targetUrl = encodeURIComponent(source.url);
  const fetchUrl = `${proxyUrl}?url=${targetUrl}`;

  // Fetch with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const xmlText = await response.text();

    // Detect non-XML responses (e.g. HTML error pages from proxy)
    const trimmed = xmlText.trimStart();
    if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
      throw new Error(`Feed returned HTML instead of XML (${source.url})`);
    }

    return parseFeed(xmlText, source);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error("Timeout after 10s");
    }
    throw error;
  }
}

/**
 * Parse RSS or Atom feed XML
 * @param {string} xmlText - XML content
 * @param {SourceConfig} source - Source config
 * @returns {Promise<RawArticle[]>}
 */
async function parseFeed(xmlText, source) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");

  // Check for parsing errors
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error("XML parsing error");
  }

  // Detect feed type
  const rootTag = doc.documentElement.tagName.toLowerCase();
  const isAtom = rootTag === "feed";
  const isRss = rootTag === "rss";

  if (!isAtom && !isRss) {
    throw new Error("Unknown feed format");
  }

  const items = isAtom
    ? doc.querySelectorAll("entry")
    : doc.querySelectorAll("item");

  const articles = [];

  for (const item of items) {
    try {
      const article = isAtom
        ? parseAtomEntry(item, source)
        : parseRssItem(item, source);

      if (article) {
        // Generate ID from URL
        article.id = await hashString(article.url);
        article.fetchedAt = new Date().toISOString();
        articles.push(article);
      }
    } catch (e) {
      // Skip invalid entries
      console.warn("Failed to parse entry:", e.message);
    }
  }

  return articles;
}

/**
 * Parse RSS 2.0 item
 * @param {Element} item - RSS item element
 * @param {SourceConfig} source - Source config
 * @returns {RawArticle|null}
 */
function parseRssItem(item, source) {
  const title = getTextContent(item, "title") || "Untitled";
  const link = getTextContent(item, "link") || "";
  const pubDate = getTextContent(item, "pubDate") || new Date().toISOString();

  // Get content from description or content:encoded
  let content =
    item.getElementsByTagNameNS("http://purl.org/rss/1.0/modules/content/", "encoded")[0]
      ?.textContent ||
    getTextContent(item, "description") ||
    "";

  content = stripHtml(content);
  content = truncate(content, 4000);

  if (!link) return null;

  return {
    id: "", // Will be filled later
    title: title.trim(),
    url: link.trim(),
    source: source.name,
    sourceCategory: source.category,
    published: normalizeDate(pubDate),
    content: content.trim(),
    fetchedAt: "", // Will be filled later
  };
}

/**
 * Parse Atom entry
 * @param {Element} entry - Atom entry element
 * @param {SourceConfig} source - Source config
 * @returns {RawArticle|null}
 */
function parseAtomEntry(entry, source) {
  const title = getTextContent(entry, "title") || "Untitled";

  // Get link href attribute
  let link = "";
  const linkEl = entry.querySelector("link");
  if (linkEl) {
    link = linkEl.getAttribute("href") || "";
  }

  const published =
    getTextContent(entry, "published") ||
    getTextContent(entry, "updated") ||
    new Date().toISOString();

  // Get content from summary or content
  let content =
    getTextContent(entry, "content") ||
    getTextContent(entry, "summary") ||
    "";

  content = stripHtml(content);
  content = truncate(content, 4000);

  if (!link) return null;

  return {
    id: "", // Will be filled later
    title: title.trim(),
    url: link.trim(),
    source: source.name,
    sourceCategory: source.category,
    published: normalizeDate(published),
    content: content.trim(),
    fetchedAt: "", // Will be filled later
  };
}

/**
 * Get text content of an element
 * @param {Element} parent - Parent element
 * @param {string} tagName - Tag name
 * @returns {string|null}
 */
function getTextContent(parent, tagName) {
  const el = parent.querySelector(tagName);
  return el ? el.textContent : null;
}

/**
 * Strip HTML tags from text
 * @param {string} html - HTML string
 * @returns {string}
 */
function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "");
}

/**
 * Truncate string to max length
 * @param {string} str - String to truncate
 * @param {number} maxLength - Max length
 * @returns {string}
 */
function truncate(str, maxLength) {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength) + "...";
}

/**
 * Normalize date to ISO-8601
 * @param {string} dateStr - Date string
 * @returns {string}
 */
function normalizeDate(dateStr) {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return new Date().toISOString();
    }
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export default {
  fetchAllFeeds,
  fetchSingleFeed,
};
