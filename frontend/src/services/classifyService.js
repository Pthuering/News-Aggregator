/**
 * @module classifyService
 * @purpose Classify articles using NVIDIA API (via OpenAI client)
 *
 * @reads    settingsStore.js → getNvidiaApiKey()
 * @reads    prompts.js → classificationPrompt
 * @writes   articleStore.js → updateArticle() with classification
 * @calledBy App.jsx → on classify button
 *
 * @dataflow Article → NVIDIA API → ClassifiedArticle → store
 *
 * @exports
 *   classifyArticle(article: RawArticle): Promise<ClassifiedArticle>
 *   classifyArticles(articles: RawArticle[]): Promise<ClassifiedArticle[]>
 *
 * @errors Throws if API key missing, handles API errors gracefully
 */

import OpenAI from "openai";
import { getNvidiaApiKey } from "../stores/settingsStore.js";
import { classificationPrompt } from "../config/prompts.js";
import { API_CONFIG, CLASSIFY_CONFIG } from "../config/settings.js";
import { updateArticle } from "../stores/articleStore.js";

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
 * Classify a single article using NVIDIA API
 * @param {RawArticle} article - Article to classify
 * @returns {Promise<ClassifiedArticle>} - Classified article
 */
export async function classifyArticle(article) {
  const apiKey = await getNvidiaApiKey();
  if (!apiKey) {
    throw new Error("NVIDIA API key not configured. Please add it in Settings.");
  }

  const client = getClient(apiKey);

  // Prepare prompt
  const prompt = classificationPrompt
    .replace("{{title}}", article.title)
    .replace("{{source}}", article.source)
    .replace("{{content}}", article.content.substring(0, CLASSIFY_CONFIG.maxContentLength));

  try {
    const completion = await client.chat.completions.create({
      model: API_CONFIG.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: API_CONFIG.maxTokens,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from API");
    }

    // Parse JSON response
    let classification;
    try {
      classification = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse classification:", content);
      throw new Error("Invalid classification response from API");
    }

    // Create classified article
    const classifiedArticle = {
      ...article,
      scores: classification.scores || {
        oepnv_direkt: 0,
        tech_transfer: 0,
        foerder: 0,
        markt: 0,
      },
      tags: classification.tags || [],
      summary_de: classification.summary_de || "",
      reasoning: classification.reasoning || "",
      classifiedAt: new Date().toISOString(),
    };

    // Update in store
    await updateArticle(article.id, {
      scores: classifiedArticle.scores,
      tags: classifiedArticle.tags,
      summary_de: classifiedArticle.summary_de,
      reasoning: classifiedArticle.reasoning,
      classifiedAt: classifiedArticle.classifiedAt,
    });

    return classifiedArticle;
  } catch (error) {
    console.error("Classification failed:", error);
    throw error;
  }
}

/**
 * Classify multiple articles
 * @param {RawArticle[]} articles - Articles to classify
 * @returns {Promise<ClassifiedArticle[]>}
 */
export async function classifyArticles(articles) {
  const results = [];
  const batchSize = CLASSIFY_CONFIG.batchSize;

  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);

    for (const article of batch) {
      try {
        // Skip already classified articles
        if (article.classifiedAt) {
          results.push(article);
          continue;
        }

        const classified = await classifyArticle(article);
        results.push(classified);
      } catch (error) {
        console.error(`Failed to classify article ${article.id}:`, error);
        results.push(article);
      }
    }

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < articles.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}

export default {
  classifyArticle,
  classifyArticles,
};
