/**
 * @module matchService
 * @purpose Find synergies between articles and projects
 *
 * @reads    projectStore.js → getProjects()
 * @reads    prompts.js → synergyPrompt
 * @writes   articleStore.js → updateArticle() with synergies
 * @calledBy App.jsx → on match button
 * @calls    Anthropic API → for relevance scoring
 *
 * @dataflow Article + Projects → AI/Template → SynergyMatch[] → store
 *
 * @exports
 *   findSynergies(article: ClassifiedArticle): Promise<SynergyMatch[]>
 *   findAllSynergies(articles: ClassifiedArticle[]): Promise<void>
 *
 * @errors Returns empty array on API failure
 */

import { getProjects } from "../stores/projectStore.js";
import { updateArticle } from "../stores/articleStore.js";
import { synergyPrompt } from "../config/prompts.js";
import { getAnthropicApiKey } from "../stores/settingsStore.js";
import { settings } from "../config/settings.js";

/**
 * Find synergies between an article and all projects
 * @param {ClassifiedArticle} article - Article to analyze
 * @returns {Promise<SynergyMatch[]>} - Found synergies
 */
export async function findSynergies(article) {
  const apiKey = await getAnthropicApiKey();
  const projects = await getProjects();

  if (!apiKey || projects.length === 0) {
    return [];
  }

  const synergies = [];

  for (const project of projects) {
    try {
      const prompt = synergyPrompt
        .replace("{{title}}", article.title)
        .replace("{{summary}}", article.summary_de || article.content.substring(0, 500))
        .replace("{{tags}}", (article.tags || []).join(", "))
        .replace("{{projectName}}", project.name)
        .replace("{{projectDescription}}", project.description)
        .replace("{{technologies}}", (project.technologies || []).join(", "))
        .replace("{{challenges}}", (project.challenges || []).join(", "));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: settings.anthropic.model,
          max_tokens: 500,
          temperature: 0.3,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const content = data.content[0].text;

      let result;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          continue;
        }
      } catch (parseError) {
        continue;
      }

      // Only include if score is meaningful (> 3)
      if (result.score > 3) {
        synergies.push({
          projectId: project.id,
          projectName: project.name,
          relevance: result.relevance,
          score: result.score,
        });
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Failed to find synergy for project ${project.id}:`, error);
    }
  }

  // Sort by score descending
  synergies.sort((a, b) => b.score - a.score);

  // Update article with synergies
  await updateArticle(article.id, { synergies });

  return synergies;
}

/**
 * Find synergies for all unprocessed articles
 * @param {ClassifiedArticle[]} articles - Articles to process
 * @returns {Promise<void>}
 */
export async function findAllSynergies(articles) {
  for (const article of articles) {
    // Skip if already has synergies
    if (article.synergies && article.synergies.length > 0) {
      continue;
    }

    try {
      await findSynergies(article);
    } catch (error) {
      console.error(`Failed to find synergies for ${article.id}:`, error);
    }
  }
}

/**
 * Simple keyword-based synergy finder (fallback without AI)
 * @param {ClassifiedArticle} article - Article to analyze
 * @returns {Promise<SynergyMatch[]>}
 */
export async function findSynergiesSimple(article) {
  const projects = await getProjects();
  const synergies = [];

  const articleText = (
    article.title +
    " " +
    article.content +
    " " +
    (article.tags || []).join(" ")
  ).toLowerCase();

  for (const project of projects) {
    let score = 0;
    const matches = [];

    // Check technology matches
    for (const tech of project.technologies || []) {
      if (articleText.includes(tech.toLowerCase())) {
        score += 2;
        matches.push(tech);
      }
    }

    // Check challenge matches
    for (const challenge of project.challenges || []) {
      const words = challenge.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 3 && articleText.includes(word)) {
          score += 1;
        }
      }
    }

    // Check description keywords
    const descWords = project.description.toLowerCase().split(/\s+/);
    for (const word of descWords) {
      if (word.length > 5 && articleText.includes(word)) {
        score += 0.5;
      }
    }

    if (score >= 3) {
      synergies.push({
        projectId: project.id,
        projectName: project.name,
        relevance: `Übereinstimmungen: ${matches.join(", ") || "Allgemeine Themen"}`,
        score: Math.min(Math.round(score), 10),
      });
    }
  }

  synergies.sort((a, b) => b.score - a.score);

  if (synergies.length > 0) {
    await updateArticle(article.id, { synergies });
  }

  return synergies;
}

export default {
  findSynergies,
  findAllSynergies,
  findSynergiesSimple,
};
