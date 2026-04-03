/**
 * @module classifyService
 * @purpose Multi-Lens-Klassifikation von Artikeln via NVIDIA API (Parallel)
 *
 * Nutzt 4 parallele Worker-Instanzen für 4x Geschwindigkeit
 *
 * @exports
 *   classifyNew(): Promise<ClassifyResult>
 *   classifySingle(article: RawArticle): Promise<ClassifiedArticle>
 */

import { getClassifyPrompt } from "../config/prompts.js";
import { API_CONFIG, CLASSIFY_CONFIG } from "../config/settings.js";
import { getNvidiaApiKey } from "../stores/settingsStore.js";
import { getUnclassifiedArticles, updateArticle } from "../stores/articleStore.js";

// 4 Worker-URLs für parallele Verarbeitung
const WORKER_URLS = [
  "https://rss-proxy-1.philipp-thuering.workers.dev",
  "https://rss-proxy-2.philipp-thuering.workers.dev",
  "https://rss-proxy-3.philipp-thuering.workers.dev",
  "https://rss-proxy-4.philipp-thuering.workers.dev",
];

const PARALLEL_WORKERS = 4;

/**
 * Make API call via specific worker
 */
async function callNvidiaApiViaWorker(workerUrl, apiKey, body) {
  console.log(`[Classify] Calling worker: ${workerUrl}/api/nvidia`);
  console.log(`[Classify] Request body:`, { model: body.model, messages: body.messages.length, max_tokens: body.max_tokens });
  
  const response = await fetch(`${workerUrl}/api/nvidia`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  console.log(`[Classify] Worker response status: ${response.status}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Classify] Worker error: ${errorText}`);
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * Split array into N chunks
 */
function splitIntoChunks(array, numChunks) {
  const chunks = [];
  const chunkSize = Math.ceil(array.length / numChunks);
  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSize;
    const end = start + chunkSize;
    const chunk = array.slice(start, end);
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
  }
  return chunks;
}

/**
 * Classify all unclassified articles using parallel workers
 */
export async function classifyNew(onProgress) {
  const apiKey = await getNvidiaApiKey();
  if (!apiKey) {
    throw new Error("NVIDIA API key not configured. Please add it in Settings.");
  }

  const articles = await getUnclassifiedArticles();
  console.log(`[Classify] Found ${articles.length} unclassified articles`);

  if (articles.length === 0) {
    return { classified: 0, failed: 0, errors: [] };
  }

  // Show article lengths for debugging
  articles.forEach((a, i) => {
    console.log(`[Classify] Article ${i + 1}: "${a.title.substring(0, 50)}..." - Content length: ${a.content.length} chars`);
  });

  // Split articles into chunks for parallel processing
  const chunks = splitIntoChunks(articles, PARALLEL_WORKERS);
  console.log(`[Classify] Split into ${chunks.length} chunks for ${PARALLEL_WORKERS} workers`);
  chunks.forEach((chunk, i) => {
    console.log(`[Classify] Chunk ${i + 1}: ${chunk.length} articles`);
  });
  
  const totalArticles = articles.length;
  let processedCount = 0;
  
  // Track progress per worker
  const progressPerWorker = new Array(chunks.length).fill(0);

  const updateProgress = (workerIndex, count) => {
    progressPerWorker[workerIndex] = count;
    const totalProcessed = progressPerWorker.reduce((a, b) => a + b, 0);
    if (onProgress) {
      onProgress({ current: totalProcessed, total: totalArticles });
    }
  };

  // Process chunks in parallel
  const workerPromises = chunks.map(async (chunk, workerIndex) => {
    const workerUrl = WORKER_URLS[workerIndex % WORKER_URLS.length];
    const results = [];
    
    // Further split chunk into batches of 5
    const batchSize = CLASSIFY_CONFIG.batchSize;
    const batches = [];
    for (let i = 0; i < chunk.length; i += batchSize) {
      batches.push(chunk.slice(i, i + batchSize));
    }

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      try {
        const batchResults = await classifyBatchWithWorker(workerUrl, apiKey, batch);
        
        // Update each article
        for (let j = 0; j < batch.length; j++) {
          const article = batch[j];
          const result = batchResults[j];

          if (result) {
            await updateArticle(article.id, {
              scores: result.scores,
              tags: result.tags,
              summary_de: result.summary_de,
              reasoning: result.reasoning,
              classifiedAt: new Date().toISOString(),
            });
            results.push({ success: true, articleId: article.id });
          } else {
            results.push({ success: false, articleId: article.id, error: "No result" });
          }
        }
        
        updateProgress(workerIndex, (i + 1) * batch.length);
      } catch (error) {
        const isTokenError = error.message?.includes("token") || 
                            error.message?.includes("too long") || 
                            error.message?.includes("context length");
        
        // If token error and batch has multiple articles, try individually
        if (isTokenError && batch.length > 1) {
          console.log(`[Classify] Token error on batch, trying ${batch.length} articles individually`);
          
          for (const article of batch) {
            try {
              const singleResults = await classifyBatchWithWorker(workerUrl, apiKey, [article]);
              if (singleResults[0]) {
                await updateArticle(article.id, {
                  scores: singleResults[0].scores,
                  tags: singleResults[0].tags,
                  summary_de: singleResults[0].summary_de,
                  reasoning: singleResults[0].reasoning,
                  classifiedAt: new Date().toISOString(),
                });
                results.push({ success: true, articleId: article.id });
              } else {
                results.push({ success: false, articleId: article.id, error: "No result" });
              }
            } catch (singleError) {
              console.error(`[Classify] Individual article failed:`, article.id, singleError.message);
              results.push({ success: false, articleId: article.id, error: singleError.message });
            }
          }
        } else {
          // Mark all articles in failed batch as failed
          for (const article of batch) {
            results.push({ success: false, articleId: article.id, error: error.message });
          }
        }
        updateProgress(workerIndex, (i + 1) * batch.length);
      }

      // Small pause between batches to be nice to the API
      if (i < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    
    return results;
  });

  // Wait for all workers to complete
  const allResults = await Promise.all(workerPromises);
  
  // Flatten results
  const flatResults = allResults.flat();
  const classified = flatResults.filter(r => r.success).length;
  const failed = flatResults.filter(r => !r.success).length;
  const errors = flatResults
    .filter(r => !r.success && r.error)
    .map(r => r.error);

  return { classified, failed, errors };
}

/**
 * Classify a batch using a specific worker
 */
async function classifyBatchWithWorker(workerUrl, apiKey, articles) {
  console.log(`[Classify] Worker ${workerUrl}: Processing batch of ${articles.length} articles`);
  
  const systemPrompt = getClassifyPrompt();
  const userMessage = formatArticlesForClassification(articles);

  // Calculate approximate tokens (rough estimate: 1 token ≈ 4 chars)
  const approxTokens = Math.ceil((systemPrompt.length + userMessage.length) / 4);
  console.log(`[Classify] Approximate prompt size: ${approxTokens} tokens`);

  const body = {
    model: API_CONFIG.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: API_CONFIG.maxTokens,
    temperature: 0.3,
  };

  const maxRetries = 3;
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[Classify] Worker ${workerUrl}: API call attempt ${attempt + 1}/${maxRetries}`);
      const data = await callNvidiaApiViaWorker(workerUrl, apiKey, body);
      console.log(`[Classify] Worker ${workerUrl}: API call successful`);
      
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error("Empty response from API");
      }

      console.log(`[Classify] Worker ${workerUrl}: Response length: ${content.length} chars`);
      return parseClassificationResponse(content, articles.length);
    } catch (error) {
      lastError = error;
      console.error(`[Classify] Worker ${workerUrl}: Attempt ${attempt + 1} failed:`, error.message);

      const shouldRetry =
        error.message?.includes("429") ||
        error.message?.includes("500") ||
        error.message?.includes("529") ||
        error.message?.includes("network") ||
        error.message?.includes("timeout") ||
        error.message?.includes("CORS");

      if (shouldRetry && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        console.log(`[Classify] Worker ${workerUrl}: Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

/**
 * Classify a single article (uses first worker)
 */
export async function classifySingle(article) {
  const apiKey = await getNvidiaApiKey();
  if (!apiKey) {
    throw new Error("NVIDIA API key not configured. Please add it in Settings.");
  }

  const results = await classifyBatchWithWorker(WORKER_URLS[0], apiKey, [article]);
  
  if (!results[0]) {
    throw new Error("Failed to classify article");
  }

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

const MAX_CONTENT_LENGTH = 2000; // Max chars per article content

/**
 * Format articles for classification prompt
 */
function formatArticlesForClassification(articles) {
  console.log(`[Classify] Formatting ${articles.length} articles, max ${MAX_CONTENT_LENGTH} chars each`);
  
  if (articles.length === 1) {
    const a = articles[0];
    const content = a.content.substring(0, MAX_CONTENT_LENGTH);
    console.log(`[Classify] Single article content length: ${content.length} chars`);
    return `Bewerte folgenden Artikel:

Titel: ${a.title}
Quelle: ${a.source}
Datum: ${a.published}
Inhalt: ${content}`;
  }

  let message = `Bewerte folgende Artikel. Gib ein JSON-Array zurück, ein Objekt pro Artikel, in derselben Reihenfolge.\n\n`;

  articles.forEach((a, i) => {
    const content = a.content.substring(0, MAX_CONTENT_LENGTH);
    console.log(`[Classify] Article ${i + 1} content length: ${content.length} chars`);
    message += `--- Artikel ${i + 1} ---\n`;
    message += `Titel: ${a.title}\n`;
    message += `Quelle: ${a.source}\n`;
    message += `Datum: ${a.published}\n`;
    message += `Inhalt: ${content}\n\n`;
  });

  return message;
}

/**
 * Parse the classification response
 */
function parseClassificationResponse(content, expectedCount) {
  console.log(`[Classify] Parsing response for ${expectedCount} expected results`);
  try {
    let cleanContent = content.replace(/```json|```/g, "").trim();
    console.log(`[Classify] Cleaned content (first 200 chars): ${cleanContent.substring(0, 200)}...`);

    let results;
    if (cleanContent.startsWith("[")) {
      results = JSON.parse(cleanContent);
      console.log(`[Classify] Parsed array with ${results.length} results`);
    } else if (cleanContent.startsWith("{")) {
      results = [JSON.parse(cleanContent)];
      console.log(`[Classify] Parsed single object`);
    } else {
      throw new Error("Invalid JSON format - doesn't start with [ or {");
    }

    if (results.length !== expectedCount) {
      console.warn(`[Classify] Warning: Expected ${expectedCount} results, got ${results.length}`);
    }

    return results.map((r, i) => {
      console.log(`[Classify] Result ${i + 1}: scores=${JSON.stringify(r.scores)}, tags=${r.tags?.length || 0}`);
      return {
        scores: r.scores || { oepnv_direkt: 0, tech_transfer: 0, foerder: 0, markt: 0 },
        tags: r.tags || [],
        summary_de: r.summary_de || "",
        reasoning: r.reasoning || "",
      };
    });
  } catch (error) {
    console.error("[Classify] Failed to parse classification response:", content.substring(0, 500));
    throw new Error("Invalid classification response: " + error.message);
  }
}

export default {
  classifyNew,
  classifySingle,
};
