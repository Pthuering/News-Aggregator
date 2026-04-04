/**
 * @module keywordUtils
 * @purpose Normalisiert Keywords/Tags über alle Stores hinweg und
 *          baut einen Cross-Reference-Index zur Laufzeit
 *
 * @reads    stores/articleStore.js → getAllArticles() → tags[]
 * @reads    stores/projectStore.js → getProjects() → technologies[], challenges[]
 *
 * @exports
 *   normalizeKeyword(keyword: string): string
 *   normalizeKeywords(keywords: string[]): string[]
 *   buildCrossReferenceIndex(): Promise<CrossRefIndex>
 *   findKeywordOverlap(articleTags: string[], projectTechs: string[]): string[]
 *   KEYWORD_ALIASES: Record<string, string>
 */

import { getAllArticles } from "../stores/articleStore.js";
import { getProjects } from "../stores/projectStore.js";

/**
 * Alias map for synonymous terms. Keys are normalized forms that map to canonical form.
 */
export const KEYWORD_ALIASES = {
  "elektrobus": "e-bus",
  "elektrischer-bus": "e-bus",
  "ki": "künstliche-intelligenz",
  "artificial-intelligence": "künstliche-intelligenz",
  "ai": "künstliche-intelligenz",
  "ml": "machine-learning",
  "maschinelles-lernen": "machine-learning",
  "iot": "internet-of-things",
  "öpnv": "nahverkehr",
  "autonomous": "autonomes-fahren",
  "autonom": "autonomes-fahren",
  "selbstfahrend": "autonomes-fahren",
  "echtzeit": "echtzeit-daten",
  "realtime": "echtzeit-daten",
  "real-time": "echtzeit-daten",
  "digital-twin": "digitaler-zwilling",
  "digital-twins": "digitaler-zwilling",
  "predictive-maintenance": "vorausschauende-wartung",
  "computer-vision": "computer-vision",
  "cv": "computer-vision",
  "nlp": "natural-language-processing",
  "llm": "large-language-model",
  "chatbot": "chatbot",
  "ev": "elektromobilität",
  "bev": "elektromobilität",
};

/**
 * Normalize a single keyword: lowercase, trim, resolve aliases
 * @param {string} keyword
 * @returns {string}
 */
export function normalizeKeyword(keyword) {
  if (!keyword || typeof keyword !== "string") return "";
  
  let normalized = keyword
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")       // spaces → hyphens
    .replace(/[_]+/g, "-")      // underscores → hyphens
    .replace(/-{2,}/g, "-")     // collapse multiple hyphens
    .replace(/^-|-$/g, "");     // trim leading/trailing hyphens

  // Resolve alias if exists
  if (KEYWORD_ALIASES[normalized]) {
    normalized = KEYWORD_ALIASES[normalized];
  }

  return normalized;
}

/**
 * Normalize an array of keywords, deduplicate
 * @param {string[]} keywords
 * @returns {string[]}
 */
export function normalizeKeywords(keywords) {
  if (!Array.isArray(keywords)) return [];
  
  const seen = new Set();
  const result = [];
  
  for (const kw of keywords) {
    const normalized = normalizeKeyword(kw);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  
  return result;
}

/**
 * Find overlapping keywords between two sets (after normalization)
 * @param {string[]} setA - e.g. article tags
 * @param {string[]} setB - e.g. project technologies
 * @returns {string[]} - normalized keywords present in both
 */
export function findKeywordOverlap(setA, setB) {
  const normalizedA = new Set(normalizeKeywords(setA || []));
  const normalizedB = new Set(normalizeKeywords(setB || []));
  
  const overlap = [];
  for (const kw of normalizedA) {
    if (normalizedB.has(kw)) {
      overlap.push(kw);
    }
  }
  return overlap;
}

/**
 * Build a cross-reference index across all keyword sources.
 * Returns a Map: keyword → { articles: id[], projects: id[], lvb: id[] }
 * @returns {Promise<Map<string, {articles: string[], projects: string[], lvb: string[]}>>}
 */
export async function buildCrossReferenceIndex() {
  const index = new Map();

  const addToIndex = (keyword, source, id) => {
    const normalized = normalizeKeyword(keyword);
    if (!normalized) return;
    
    if (!index.has(normalized)) {
      index.set(normalized, { articles: [], projects: [], lvb: [] });
    }
    const entry = index.get(normalized);
    if (!entry[source].includes(id)) {
      entry[source].push(id);
    }
  };

  // Articles
  const articles = await getAllArticles();
  for (const article of articles) {
    if (article.tags) {
      for (const tag of article.tags) {
        addToIndex(tag, "articles", article.id);
      }
    }
  }

  // Projects
  const projects = await getProjects();
  for (const project of projects) {
    if (project.technologies) {
      for (const tech of project.technologies) {
        addToIndex(tech, "projects", project.id);
      }
    }
    if (project.challenges) {
      for (const challenge of project.challenges) {
        addToIndex(challenge, "projects", project.id);
      }
    }
  }

  // LVB Knowledge (optional, if store exists)
  try {
    const modulePath = "../stores/lvbKnowledgeStore.js";
    const mod = await import(/* @vite-ignore */ modulePath);
    const lvbEntries = await mod.getAllLVBKnowledge();
    for (const entry of lvbEntries) {
      if (entry.technologies) {
        for (const tech of entry.technologies) {
          addToIndex(tech, "lvb", entry.id);
        }
      }
    }
  } catch {
    // lvbKnowledgeStore not yet implemented — skip
  }

  return index;
}

export default {
  normalizeKeyword,
  normalizeKeywords,
  findKeywordOverlap,
  buildCrossReferenceIndex,
  KEYWORD_ALIASES,
};
