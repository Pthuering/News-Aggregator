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

const MAX_CONTENT_LENGTH = 4000; // Max chars per article content (ARCHITECTURE.md Standard)

/**
 * Optimize content before classification by removing non-semantic elements.
 * Conservative approach: Only removes things that definitely don't carry meaning.
 * Preserves: all words (including stopwords), negations, technical terms, context.
 */
function optimizeContent(content) {
  if (!content || content.length < 500) return content; // Don't optimize short content
  
  let optimized = content;
  const originalLength = content.length;
  
  // 1. Remove HTML/Script/CSS blocks completely
  optimized = optimized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
  optimized = optimized.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
  optimized = optimized.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, ' ');
  optimized = optimized.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ');
  optimized = optimized.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ');
  
  // 2. Remove cookie banner and privacy notice patterns (common German phrases)
  const privacyPatterns = [
    /Diese\s+Website\s+verwendet\s+Cookies[\s\S]{0,500}?Akzeptieren/gi,
    /Wir\s+nutzen\s+Cookies[\s\S]{0,500}?Mehr\s+erfahren/gi,
    /Cookie-Einstellungen[\s\S]{0,300}?Datenschutz/gi,
    /Mit\s+der\s+Nutzung\s+unserer\s+Website[\s\S]{0,400}?Einverstanden/gi,
    /\[.*?Datenschutzerklärung.*?\]/gi,
    /Impressum\s*:\s*[^\n]{0,200}/gi,
    /©\s*\d{4}[^\n]{0,100}/gi,
  ];
  privacyPatterns.forEach(pattern => {
    optimized = optimized.replace(pattern, ' ');
  });
  
  // 3. Remove journalist filler phrases (don't carry semantic value)
  const fillerPatterns = [
    /wie\s+berichtet[.,]?/gi,
    /wie\s+mitgeteilt\s+wurde[.,]?/gi,
    /laut\s+Angaben[^.]{0,50}[.]/gi,
    /wie\s+hervorgeht[.,]?/gi,
    /so\s+das\s+Unternehmen[.,]?/gi,
    /wie\s+es\s+heißt[.,]?/gi,
    /es\s+ist\s+davon\s+auszugehen[.,]?/gi,
    /es\s+bleibt\s+abzuwarten[.,]?/gi,
    /das\s+soll[^.]{0,30}ermöglichen/gi,
    /\.\.\.\s*mehr\s*lesen/gi,
    /Weiterlesen[\s]*→?/gi,
    /Lesen\s+Sie\s+auch[\s\S]{0,200}/gi,
  ];
  fillerPatterns.forEach(pattern => {
    optimized = optimized.replace(pattern, ' ');
  });
  
  // 4. Remove marketing fluff adjectives (replace with space to preserve word boundaries)
  // Only standalone, not part of compound words
  const fluffWords = [
    /\bhervorragend\b/gi,
    /\bexzellent\b/gi,
    /\bbahnbrechend\b/gi,
    /\brevolutionär\b/gi,
    /\beinzigartig\b/gi,
    /\bmarktführend\b/gi,
    /\bworld-class\b/gi,
    /\bbest-in-class\b/gi,
    /\btop\b(?=\s+(quality|service|product))/gi,
  ];
  fluffWords.forEach(pattern => {
    optimized = optimized.replace(pattern, ' ');
  });
  
  // 5. Remove social media and sharing prompts
  optimized = optimized.replace(/Folgen\s+Sie\s+uns\s+auf[\s\S]{0,300}/gi, ' ');
  optimized = optimized.replace(/Teilen\s+Sie\s+diesen\s+Artikel[\s\S]{0,200}/gi, ' ');
  optimized = optimized.replace(/Artikel\s+teilen[\s\S]{0,200}/gi, ' ');
  
  // 6. Remove newsletter signup sections
  optimized = optimized.replace(/Newsletter[\s\S]{0,400}?anmelden/gi, ' ');
  optimized = optimized.replace(/Abonnieren\s+Sie[\s\S]{0,300}?Newsletter/gi, ' ');
  
  // 7. Collapse multiple whitespace
  optimized = optimized.replace(/\s+/g, ' ').trim();
  
  const savings = originalLength - optimized.length;
  const percent = Math.round((savings / originalLength) * 100);
  
  if (savings > 100) {
    console.log(`[Optimize] Reduced ${originalLength} → ${optimized.length} chars (${percent}% saved)`);
  }
  
  return optimized;
}

/**
 * Format articles for classification prompt
 */
function formatArticlesForClassification(articles) {
  console.log(`[Classify] Formatting ${articles.length} articles, max ${MAX_CONTENT_LENGTH} chars each`);
  
  // Pre-process articles with content optimization
  const processedArticles = articles.map((a, i) => {
    const optimized = optimizeContent(a.content);
    const truncated = optimized.substring(0, MAX_CONTENT_LENGTH);
    console.log(`[Classify] Article ${i + 1} optimized: ${a.content.length} → ${optimized.length} → ${truncated.length} chars`);
    return {
      ...a,
      content: truncated
    };
  });
  
  if (processedArticles.length === 1) {
    const a = processedArticles[0];
    return `Bewerte folgenden Artikel:

Titel: ${a.title}
Quelle: ${a.source}
Datum: ${a.published}
Inhalt: ${a.content}`;
  }

  let message = `Bewerte folgende Artikel. Gib ein JSON-Array zurück, ein Objekt pro Artikel, in derselben Reihenfolge.\n\n`;

  processedArticles.forEach((a, i) => {
    message += `--- Artikel ${i + 1} ---\n`;
    message += `Titel: ${a.title}\n`;
    message += `Quelle: ${a.source}\n`;
    message += `Datum: ${a.published}\n`;
    message += `Inhalt: ${a.content}\n\n`;
  });

  return message;
}

/**
 * Repair common JSON errors from LLM outputs
 * Fixes: missing quotes around keys/values, trailing commas, unquoted strings
 */
function repairJson(jsonString) {
  let repaired = jsonString;
  
  // Remove markdown code blocks
  repaired = repaired.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  
  // Extract JSON array or object if surrounded by text
  const arrayMatch = repaired.match(/\[[\s\S]*\]/);
  const objectMatch = repaired.match(/\{[\s\S]*\}/);
  
  if (arrayMatch && repaired.includes("[")) {
    repaired = arrayMatch[0];
  } else if (objectMatch && repaired.includes("{")) {
    repaired = objectMatch[0];
  }
  
  // Fix 1: Add quotes around unquoted object keys (word: → "word":)
  repaired = repaired.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  
  // Fix 2: Add quotes around string values that aren't quoted
  // Match: "key": value (where value is not a number, boolean, null, or quoted string)
  // This is tricky - we target common patterns like reasoning: text without quotes
  
  // Fix unquoted strings in known fields (reasoning, summary_de)
  // Pattern: "reasoning": some text without quotes until newline or comma or }
  repaired = repaired.replace(/("reasoning"\s*:\s*)([^"\[\{\]\}\d][^,\n\}]*)($|[,\n\}])/g, function(match, p1, p2, p3) {
    const trimmed = p2.trim();
    // Don't quote if it's already a quoted string, number, boolean, null
    if (/^".*"$/.test(trimmed) || /^\d+$/.test(trimmed) || /^(true|false|null)$/.test(trimmed)) {
      return match;
    }
    return p1 + '"' + trimmed.replace(/"/g, '\\"') + '"' + p3;
  });
  
  repaired = repaired.replace(/("summary_de"\s*:\s*)([^"\[\{\]\}\d][^,\n\}]*)($|[,\n\}])/g, function(match, p1, p2, p3) {
    const trimmed = p2.trim();
    if (/^".*"$/.test(trimmed) || /^\d+$/.test(trimmed) || /^(true|false|null)$/.test(trimmed)) {
      return match;
    }
    return p1 + '"' + trimmed.replace(/"/g, '\\"') + '"' + p3;
  });
  
  // Fix 3: Remove trailing commas before } or ]
  repaired = repaired.replace(/,\s*([}\]])/g, "$1");
  
  // Fix 4: Replace single quotes with double quotes (but escape existing double quotes first)
  // This is risky, so we do it carefully
  repaired = repaired.replace(/'/g, '"');
  
  // Fix 5: Fix escaped newlines in strings
  repaired = repaired.replace(/\n/g, "\\n");
  
  return repaired;
}

/**
 * Parse the classification response with repair fallback
 */
function parseClassificationResponse(content, expectedCount) {
  console.log(`[Classify] Parsing response for ${expectedCount} expected results`);
  
  // First try: direct parse
  try {
    const result = tryParseJson(content);
    console.log(`[Classify] Direct parse successful`);
    return validateAndFormatResults(result, expectedCount);
  } catch (directError) {
    console.log(`[Classify] Direct parse failed: ${directError.message}`);
  }
  
  // Second try: repair and parse
  console.log(`[Classify] Attempting JSON repair...`);
  const repaired = repairJson(content);
  console.log(`[Classify] Repaired JSON (first 200 chars): ${repaired.substring(0, 200)}...`);
  
  try {
    const result = tryParseJson(repaired);
    console.log(`[Classify] Repair successful!`);
    return validateAndFormatResults(result, expectedCount);
  } catch (repairError) {
    console.error(`[Classify] Repair also failed: ${repairError.message}`);
    console.error(`[Classify] Original content:`, content.substring(0, 500));
    throw new Error("Invalid classification response: " + repairError.message);
  }
}

/**
 * Try to parse JSON, handling both arrays and single objects
 */
function tryParseJson(content) {
  let cleanContent = content.replace(/```json|```/g, "").trim();
  
  if (cleanContent.startsWith("[")) {
    return JSON.parse(cleanContent);
  } else if (cleanContent.startsWith("{")) {
    return [JSON.parse(cleanContent)];
  } else {
    throw new Error("Invalid JSON format - doesn't start with [ or {");
  }
}

/**
 * Validate and format parsed results
 */
function validateAndFormatResults(results, expectedCount) {
  if (!Array.isArray(results)) {
    results = [results];
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
}

export default {
  classifyNew,
  classifySingle,
};
