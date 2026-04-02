/**
 * @module classifyService
 * @purpose Classify articles using Anthropic API
 *
 * @reads    settingsStore.js → getAnthropicApiKey()
 * @reads    prompts.js → classificationPrompt
 * @writes   articleStore.js → updateArticle() with classification
 * @calledBy App.jsx → on classify button
 *
 * @dataflow Article → Anthropic API → ClassifiedArticle → store
 *
 * @exports
 *   classifyArticle(article: RawArticle): Promise<ClassifiedArticle>
 *   classifyArticles(articles: RawArticle[]): Promise<ClassifiedArticle[]>
 *
 * @errors Throws if API key missing, handles API errors gracefully
 */

import { getAnthropicApiKey } from "../stores/settingsStore.js";
import { classificationPrompt } from "../config/prompts.js";
import { updateArticle } from "../stores/articleStore.js";
import { settings } from "../config/settings.js";

/**
 * Classify a single article using Anthropic API
 * @param {RawArticle} article - Article to classify
 * @returns {Promise<ClassifiedArticle>} - Classified article
 */
export async function classifyArticle(article) {
  const apiKey = await getAnthropicApiKey();
  if (!apiKey) {
    throw new Error("Anthropic API key not configured. Please add it in Settings.");
  }

  // Prepare prompt
  const prompt = classificationPrompt
    .replace("{{title}}", article.title)
    .replace("{{source}}", article.source)
    .replace("{{content}}", article.content.substring(0, 2000));

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: settings.anthropic.model,
        max_tokens: settings.anthropic.maxTokens,
        temperature: settings.anthropic.temperature,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "API request failed");
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Parse JSON response
    let classification;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        classification = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse classification:", content);
      throw new Error("Invalid classification response from API");
    }

    // Create classified article
    const classifiedArticle = {
      ...article,
      scores: classification.scores,
      tags: classification.tags,
      summary_de: classification.summary_de,
      reasoning: classification.reasoning,
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
  
  for (const article of articles) {
    try {
      // Skip already classified articles
      if (article.classifiedAt) {
        results.push(article);
        continue;
      }

      const classified = await classifyArticle(article);
      results.push(classified);
      
      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Failed to classify article ${article.id}:`, error);
      results.push(article);
    }
  }

  return results;
}

export default {
  classifyArticle,
  classifyArticles,
};
