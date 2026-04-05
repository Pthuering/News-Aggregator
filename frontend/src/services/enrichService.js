/**
 * @module enrichService
 * @purpose Reichert Artikel mit Hintergrund-Infos zu Entities an
 *
 * @reads    config/prompts.js → getEnrichPrompt()
 * @reads    stores/settingsStore.js → getNvidiaApiKey()
 * @writes   stores/articleStore.js → updateArticle() (enrichment-Feld)
 * @calledBy components/ArticleDetail.jsx → Button "Mehr Kontext"
 *
 * @dataflow
 *   Artikel → API-Call → Hintergrund-Infos
 *   → als enrichment-String im Artikel speichern
 *
 * @exports
 *   enrichArticle(article: ClassifiedArticle): Promise<string>
 *     → Gibt Enrichment-Text zurück (1-2 Sätze pro Entity)
 */

import { getEnrichPrompt } from "../config/prompts.js";
import { API_CONFIG } from "../config/settings.js";
import { getNvidiaApiKey } from "../stores/settingsStore.js";
import { updateArticle } from "../stores/articleStore.js";

const WORKER_URL = "https://rss-proxy-1.philipp-thuering.workers.dev";

/**
 * Enrich a single article with background info on entities.
 * Saves result to article store and returns the enrichment text.
 * @param {object} article - The article to enrich
 * @returns {Promise<string>} Markdown enrichment text
 */
export async function enrichArticle(article) {
  const apiKey = await getNvidiaApiKey();
  if (!apiKey) {
    throw new Error("NVIDIA API key not configured. Please add it in Settings.");
  }

  const systemPrompt = getEnrichPrompt();
  const userMessage = `**Titel:** ${article.title}\n\n**Inhalt:**\n${article.content}`;

  const body = {
    model: API_CONFIG.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: 0.3,
  };

  console.log(`[Enrich] Calling API for article: "${article.title.substring(0, 50)}..."`);
  console.log(`[Enrich] Content length: ${userMessage.length} chars`);

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
    console.error(`[Enrich] API error ${response.status}:`, errorText);
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  console.log(`[Enrich] API response:`, JSON.stringify(data).substring(0, 500));
  const enrichment = data.choices?.[0]?.message?.content?.trim();

  if (!enrichment) {
    throw new Error("Empty response from API");
  }

  // Save enrichment to article store
  await updateArticle(article.id, { enrichment });

  return enrichment;
}
