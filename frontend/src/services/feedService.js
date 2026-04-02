/**
 * @module feedService
 * @purpose Fetch and parse RSS feeds via CORS proxy
 *
 * @reads    sources.js → feed URLs
 * @reads    settings.js → corsProxy URL, feed config
 * @writes   articleStore.js → save parsed articles
 * @calledBy App.jsx → on manual fetch trigger
 * @calls    hash.js → generateArticleId
 *
 * @dataflow RSS URL → CORS Proxy → XML → RawArticle[] → articleStore
 *
 * @exports
 *   fetchAllFeeds(): Promise<RawArticle[]> – Fetch all configured feeds
 *   fetchFeed(source: SourceConfig): Promise<RawArticle[]> – Fetch single feed
 *   parseRSS(xml: string, source: SourceConfig): RawArticle[] – Parse RSS XML
 *
 * @errors Returns empty array on fetch failure, logs to console
 */

import { sources } from "../config/sources.js";
import { settings } from "../config/settings.js";
import { generateArticleId } from "../utils/hash.js";
import { saveArticles } from "../stores/articleStore.js";

/**
 * Fetches all active RSS feeds
 * @returns {Promise<RawArticle[]>} - All fetched articles
 */
export async function fetchAllFeeds() {
  const activeSources = sources.filter((s) => s.active);
  const allArticles = [];

  for (const source of activeSources) {
    try {
      const articles = await fetchFeed(source);
      allArticles.push(...articles);
    } catch (error) {
      console.error(`Failed to fetch feed ${source.name}:`, error);
    }
  }

  // Save all articles to IndexedDB
  if (allArticles.length > 0) {
    await saveArticles(allArticles);
  }

  return allArticles;
}

/**
 * Fetches a single RSS feed
 * @param {SourceConfig} source - Feed source configuration
 * @returns {Promise<RawArticle[]>} - Parsed articles
 */
export async function fetchFeed(source) {
  const proxyUrl = settings.corsProxy.url;
  const targetUrl = encodeURIComponent(source.url);
  const fetchUrl = `${proxyUrl}?url=${targetUrl}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    settings.feed.timeoutMs
  );

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

    const xml = await response.text();
    return parseRSS(xml, source);
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`Error fetching ${source.name}:`, error);
    throw error;
  }
}

/**
 * Parses RSS XML into RawArticle objects
 * @param {string} xml - RSS XML content
 * @param {SourceConfig} source - Source configuration
 * @returns {RawArticle[]} - Parsed articles
 */
export function parseRSS(xml, source) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");

  // Check for parsing errors
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error("XML parsing error: " + parserError.textContent);
  }

  const items = doc.querySelectorAll("item");
  const articles = [];

  for (let i = 0; i < Math.min(items.length, settings.feed.maxArticlesPerSource); i++) {
    const item = items[i];
    
    const title = getTextContent(item, "title") || "Untitled";
    const link = getTextContent(item, "link") || "";
    const pubDate = getTextContent(item, "pubDate") || new Date().toISOString();
    const description = getTextContent(item, "description") || "";
    const contentEncoded = item.getElementsByTagNameNS(
      "http://purl.org/rss/1.0/modules/content/",
      "encoded"
    )[0]?.textContent || "";
    
    // Use content:encoded if available, otherwise description
    let content = contentEncoded || description;
    
    // Strip HTML tags and limit length
    content = stripHtml(content);
    if (content.length > settings.feed.maxContentLength) {
      content = content.substring(0, settings.feed.maxContentLength) + "...";
    }

    const article = {
      id: awaitGenerateId(link || title + pubDate),
      title: title.trim(),
      url: link.trim(),
      source: source.name,
      sourceCategory: source.category,
      published: new Date(pubDate).toISOString(),
      content: content.trim(),
      fetchedAt: new Date().toISOString(),
    };

    articles.push(article);
  }

  return articles;
}

/**
 * Helper to get text content from XML element
 * @param {Element} parent - Parent element
 * @param {string} tagName - Tag name to find
 * @returns {string|null} - Text content or null
 */
function getTextContent(parent, tagName) {
  const element = parent.querySelector(tagName);
  return element ? element.textContent : null;
}

/**
 * Strip HTML tags from text
 * @param {string} html - HTML string
 * @returns {string} - Plain text
 */
function stripHtml(html) {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

/**
 * Generate ID synchronously (wrapper for async hash)
 * @param {string} input - Input string
 * @returns {string} - Generated ID
 */
function awaitGenerateId(input) {
  // Simple hash for synchronous use
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, "0");
}

/**
 * Fetch a single feed by source ID
 * @param {string} sourceId - Source ID
 * @returns {Promise<RawArticle[]>}
 */
export async function fetchFeedById(sourceId) {
  const source = sources.find((s) => s.id === sourceId);
  if (!source) {
    throw new Error(`Source with id ${sourceId} not found`);
  }
  return fetchFeed(source);
}

/**
 * Get fetch status for all sources
 * @returns {Promise<Object[]>} - Status per source
 */
export async function getFetchStatus() {
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    active: source.active,
    category: source.category,
    lastFetched: null, // Could be enhanced to track last fetch time
  }));
}

export default {
  fetchAllFeeds,
  fetchFeed,
  fetchFeedById,
  parseRSS,
  getFetchStatus,
};
