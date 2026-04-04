/**
 * @module matchService
 * @purpose Prüft Artikel gegen interne Projekte auf Synergien
 *
 * @reads    config/prompts.js  getMatchPrompt()
 * @reads    stores/projectStore.js  getProjectsAsContext(), getProjects()
 * @reads    stores/settingsStore.js  getNvidiaApiKey()
 * @reads    utils/keywordUtils.js  findKeywordOverlap(), normalizeKeywords()
 * @writes   stores/articleStore.js  updateArticle() (synergies-Feld)
 * @calledBy App.jsx  nach classifyService, oder separat per Button
 *
 * @exports
 *   matchNewArticles(onProgress): Promise<MatchResult>
 *   matchSingle(article): Promise<SynergyMatch[]>
 */

import { getMatchPrompt } from "../config/prompts.js";
import { API_CONFIG } from "../config/settings.js";
import { getProjects, getProjectsAsContext } from "../stores/projectStore.js";
import { getNvidiaApiKey } from "../stores/settingsStore.js";
import { getAllArticles, updateArticle } from "../stores/articleStore.js";
import { findKeywordOverlap } from "../utils/keywordUtils.js";

const WORKER_URL = "https://rss-proxy-1.philipp-thuering.workers.dev";
const BATCH_SIZE = 3;
const MAX_RETRIES = 2;

/**
 * Call NVIDIA API via worker proxy
 */
async function callApi(apiKey, systemPrompt, userMessage) {
  const body = {
    model: API_CONFIG.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: 0.3,
  };

  const response = await fetch(`${WORKER_URL}/api/nvidia`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content in API response");
  }
  return content;
}

/**
 * Parse JSON from API response (handles markdown-wrapped JSON)
 */
function parseJsonResponse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      return JSON.parse(match[1].trim());
    }
    const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    throw new Error("Could not parse JSON from response");
  }
}

/**
 * Check if an article should be sent for AI matching (keyword prefilter)
 */
function shouldAiMatch(article, projects) {
  if (article.scores) {
    if (article.scores.oepnv_direkt >= 6 || article.scores.tech_transfer >= 6) {
      return { match: true, reason: "high-score" };
    }
  }

  if (article.lvb_status) {
    return { match: true, reason: "lvb-status" };
  }

  const articleTags = article.tags || [];
  for (const project of projects) {
    const allProjectKeywords = [
      ...(project.technologies || []),
      ...(project.challenges || []),
    ];
    const overlap = findKeywordOverlap(articleTags, allProjectKeywords);
    if (overlap.length > 0) {
      return { match: true, reason: "keyword-overlap", keywords: overlap };
    }
  }

  return { match: false };
}

/**
 * Build user message for a batch of articles
 */
function buildUserMessage(articles) {
  return articles.map((item, idx) => {
    const a = item.article;
    const overlapInfo = item.overlappingKeywords?.length > 0
      ? `\nKeyword-Overlap mit Projekten: ${item.overlappingKeywords.join(", ")}`
      : "";
    
    return `--- Artikel ${idx + 1} ---
Titel: ${a.title}
Zusammenfassung: ${a.summary_de || a.content?.substring(0, 500) || "keine"}
Tags: ${(a.tags || []).join(", ") || "keine"}
Scores: OeV=${a.scores?.oepnv_direkt || 0}, TT=${a.scores?.tech_transfer || 0}${overlapInfo}`;
  }).join("\n\n");
}

/**
 * Match a single article against all projects (always AI, no prefilter)
 */
export async function matchSingle(article) {
  const apiKey = await getNvidiaApiKey();
  if (!apiKey) throw new Error("Kein API-Key konfiguriert");

  const projects = await getProjects();
  if (projects.length === 0) return [];

  const projectsContext = await getProjectsAsContext();
  const systemPrompt = getMatchPrompt(projectsContext);
  
  const allProjectKeywords = projects.flatMap(p => [
    ...(p.technologies || []),
    ...(p.challenges || []),
  ]);
  const overlap = findKeywordOverlap(article.tags || [], allProjectKeywords);

  const userMessage = buildUserMessage(
    [{ article, overlappingKeywords: overlap }]
  );

  const responseText = await callApi(apiKey, systemPrompt, userMessage);
  const parsed = parseJsonResponse(responseText);

  const result = Array.isArray(parsed) ? parsed[0] : parsed;
  const synergies = (result.synergies || []).filter(s => s.score >= 4);

  await updateArticle(article.id, { synergies });
  return synergies;
}

/**
 * Match all unprocessed articles with keyword prefilter + AI
 */
export async function matchNewArticles(onProgress) {
  const apiKey = await getNvidiaApiKey();
  if (!apiKey) throw new Error("Kein API-Key konfiguriert");

  const projects = await getProjects();
  if (projects.length === 0) {
    return { matched: 0, synergiesFound: 0, skipped: 0, errors: ["Keine Projekte angelegt."] };
  }

  const projectsContext = await getProjectsAsContext();
  const systemPrompt = getMatchPrompt(projectsContext);

  const allArticles = await getAllArticles();
  const unmatched = allArticles.filter(a => a.scores && a.synergies === undefined);

  if (unmatched.length === 0) {
    return { matched: 0, synergiesFound: 0, skipped: 0, errors: [] };
  }

  const toMatch = [];
  const toSkip = [];

  for (const article of unmatched) {
    const check = shouldAiMatch(article, projects);
    if (check.match) {
      toMatch.push({ article, overlappingKeywords: check.keywords || [] });
    } else {
      toSkip.push(article);
    }
  }

  for (const article of toSkip) {
    await updateArticle(article.id, { synergies: [] });
  }

  const total = toMatch.length;
  let matched = 0;
  let synergiesFound = 0;
  const errors = [];

  if (onProgress) onProgress({ current: 0, total, skipped: toSkip.length });

  for (let i = 0; i < toMatch.length; i += BATCH_SIZE) {
    const batch = toMatch.slice(i, i + BATCH_SIZE);
    const userMessage = buildUserMessage(batch);

    let responseText = null;
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[Match] Retry ${attempt}/${MAX_RETRIES}`);
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
        responseText = await callApi(apiKey, systemPrompt, userMessage);
        break;
      } catch (err) {
        lastError = err;
        console.error(`[Match] Batch error (attempt ${attempt + 1}):`, err.message);
      }
    }

    if (!responseText) {
      for (const item of batch) {
        await updateArticle(item.article.id, { synergies: [] });
        errors.push(`Fehler bei "${item.article.title}": ${lastError?.message}`);
      }
      matched += batch.length;
      if (onProgress) onProgress({ current: matched, total, skipped: toSkip.length });
      continue;
    }

    try {
      const parsed = parseJsonResponse(responseText);
      const results = Array.isArray(parsed) ? parsed : [parsed];

      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const result = results[j] || { synergies: [] };
        const synergies = (result.synergies || []).filter(s => s.score >= 4);
        synergies.sort((a, b) => b.score - a.score);
        await updateArticle(item.article.id, { synergies });
        synergiesFound += synergies.length;
      }
    } catch (parseErr) {
      console.error("[Match] Parse error:", parseErr.message);
      for (const item of batch) {
        await updateArticle(item.article.id, { synergies: [] });
      }
      errors.push(`Parse-Fehler: ${parseErr.message}`);
    }

    matched += batch.length;
    if (onProgress) onProgress({ current: matched, total, skipped: toSkip.length });

    if (i + BATCH_SIZE < toMatch.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return { matched, synergiesFound, skipped: toSkip.length, errors };
}

export default {
  matchNewArticles,
  matchSingle,
};
