/**
 * @module classifyService
 * @purpose Multi-Lens-Klassifikation von Artikeln via NVIDIA API
 *
 * @reads    config/prompts.js → getClassifyPrompt()
 * @reads    config/settings.js → API_CONFIG, CLASSIFY_CONFIG
 * @reads    stores/settingsStore.js → getNvidiaApiKey()
 * @reads    stores/articleStore.js → getUnclassifiedArticles()
 * @writes   stores/articleStore.js → updateArticle() (scores, tags, summary, reasoning)
 * @calledBy App.jsx → nach feedService.fetchAllFeeds() oder separat per Button
 *
 * @dataflow
 *   getUnclassifiedArticles() → in Batches aufteilen
 *   → pro Batch: API-Call mit System-Prompt + Artikel-Inhalte
 *   → JSON-Response parsen → Scores pro Artikel extrahieren
 *   → updateArticle() für jeden Artikel
 *
 * @exports
 *   classifyNew(): Promise<ClassifyResult>
 *     → Klassifiziert alle noch nicht bewerteten Artikel
 *     → ClassifyResult: { classified: number, failed: number, errors: string[] }
 *
 *   classifySingle(article: RawArticle): Promise<ClassifiedArticle>
 *     → Einzelnen Artikel klassifizieren (z.B. für Nachklassifikation)
 *
 * @errors
 *   - Kein API-Key: Error werfen mit klarer Meldung
 *   - API-Fehler (Rate-Limit, Timeout): Retry 3x mit exponentiellem Backoff
 *   - JSON-Parse-Fehler: Artikel als "failed" zählen, weiter mit nächstem Batch
 *   - Einzelne Batch-Fehler stoppen NICHT den Gesamtprozess
 */

import OpenAI from "openai";
import { getClassifyPrompt } from "../config/prompts.js";
import { API_CONFIG, CLASSIFY_CONFIG } from "../config/settings.js";
import { getNvidiaApiKey } from "../stores/settingsStore.js";
import { getUnclassifiedArticles, updateArticle } from "../stores/articleStore.js";

/**
 * Get OpenAI client configured for NVIDIA API
 * @param {string} apiKey 
 * @returns {OpenAI}
 */
function getClient(apiKey) {
  return new OpenAI({
    apiKey: apiKey,
    baseURL: "https://integrate.api.nvidia.com/v1",
    dangerouslyAllowBrowser: true,
  });
}

/**
 * Classify all unclassified articles
 * @returns {Promise<{classified: number, failed: number, errors: string[]}>}
 */
export async function classifyNew() {
  const apiKey = await getNvidiaApiKey();
  if (!apiKey) {
    throw new Error("NVIDIA API key not configured. Please add it in Settings.");
  }

  const client = getClient(apiKey);
  const articles = await getUnclassifiedArticles();

  if (articles.length === 0) {
    return { classified: 0, failed: 0, errors: [] };
  }

  // Split into batches
  const batchSize = CLASSIFY_CONFIG.batchSize;
  const batches = [];
  for (let i = 0; i < articles.length; i += batchSize) {
    batches.push(articles.slice(i, i + batchSize));
  }

  let classified = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    try {
      const results = await classifyBatch(client, batch);
      
      // Update each article with results
      for (let j = 0; j < batch.length; j++) {
        const article = batch[j];
        const result = results[j];

        if (result) {
          await updateArticle(article.id, {
            scores: result.scores,
            tags: result.tags,
            summary_de: result.summary_de,
            reasoning: result.reasoning,
            classifiedAt: new Date().toISOString(),
          });
          classified++;
        } else {
          failed++;
          errors.push(`Article ${article.id}: No result`);
        }
      }
    } catch (error) {
      failed += batch.length;
      errors.push(`Batch ${i + 1}/${batches.length}: ${error.message}`);
    }

    // Pause between batches to avoid rate limiting
    if (i < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return { classified, failed, errors };
}

/**
 * Classify a batch of articles
 * @param {OpenAI} client 
 * @param {RawArticle[]} articles 
 * @returns {Promise<Array>}
 */
async function classifyBatch(client, articles) {
  const systemPrompt = getClassifyPrompt();
  const userMessage = formatArticlesForClassification(articles);

  const maxRetries = 3;
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model: API_CONFIG.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: API_CONFIG.maxTokens * articles.length,
        temperature: 0.3,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from API");
      }

      return parseClassificationResponse(content, articles.length);
    } catch (error) {
      lastError = error;

      // Retry on rate limit or server errors
      const shouldRetry =
        error.status === 429 ||
        error.status === 500 ||
        error.status === 529 ||
        error.message?.includes("network") ||
        error.message?.includes("timeout");

      if (shouldRetry && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

/**
 * Classify a single article
 * @param {RawArticle} article - Article to classify
 * @returns {Promise<ClassifiedArticle>}
 */
export async function classifySingle(article) {
  const apiKey = await getNvidiaApiKey();
  if (!apiKey) {
    throw new Error("NVIDIA API key not configured. Please add it in Settings.");
  }

  const client = getClient(apiKey);
  const systemPrompt = getClassifyPrompt();
  const userMessage = formatArticlesForClassification([article]);

  const completion = await client.chat.completions.create({
    model: API_CONFIG.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: API_CONFIG.maxTokens,
    temperature: 0.3,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from API");
  }

  const results = parseClassificationResponse(content, 1);
  if (!results[0]) {
    throw new Error("Failed to classify article");
  }

  // Update article in store
  await updateArticle(article.id, {
    scores: results[0].scores,
    tags: results[0].tags,
    summary_de: results[0].summary_de,
    reasoning: results[0].reasoning,
    classifiedAt: new Date().toISOString(),
  });

  return {
    ...article,
    ...results[0],
    classifiedAt: new Date().toISOString(),
  };
}

/**
 * Format articles for classification prompt
 * @param {RawArticle[]} articles 
 * @returns {string}
 */
function formatArticlesForClassification(articles) {
  if (articles.length === 1) {
    const a = articles[0];
    return `Bewerte folgenden Artikel:

Titel: ${a.title}
Quelle: ${a.source}
Datum: ${a.published}
Inhalt: ${a.content.substring(0, 2000)}`;
  }

  // Multiple articles
  let message = `Bewerte folgende Artikel. Gib ein JSON-Array zurück, ein Objekt pro Artikel, in derselben Reihenfolge.\n\n`;

  articles.forEach((a, i) => {
    message += `--- Artikel ${i + 1} ---\n`;
    message += `Titel: ${a.title}\n`;
    message += `Quelle: ${a.source}\n`;
    message += `Datum: ${a.published}\n`;
    message += `Inhalt: ${a.content.substring(0, 2000)}\n\n`;
  });

  return message;
}

/**
 * Parse the classification response
 * @param {string} content - API response content
 * @param {number} expectedCount - Expected number of results
 * @returns {Array}
 */
function parseClassificationResponse(content, expectedCount) {
  try {
    // Remove markdown backticks if present
    let cleanContent = content.replace(/```json|```/g, "").trim();

    let results;
    if (cleanContent.startsWith("[")) {
      // Array response
      results = JSON.parse(cleanContent);
    } else if (cleanContent.startsWith("{")) {
      // Single object response
      results = [JSON.parse(cleanContent)];
    } else {
      throw new Error("Invalid JSON format");
    }

    // Validate results
    return results.map((r) => ({
      scores: r.scores || { oepnv_direkt: 0, tech_transfer: 0, foerder: 0, markt: 0 },
      tags: r.tags || [],
      summary_de: r.summary_de || "",
      reasoning: r.reasoning || "",
    }));
  } catch (error) {
    console.error("Failed to parse classification response:", content);
    throw new Error("Invalid classification response: " + error.message);
  }
}

export default {
  classifyNew,
  classifySingle,
};
