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
import { getUnclassifiedArticles, getAllArticles, updateArticle } from "../stores/articleStore.js";
import { normalizeKeywords } from "../utils/keywordUtils.js";

// 4 Worker-URLs für parallele Verarbeitung
const WORKER_URLS = [
  "https://rss-proxy-1.philipp-thuering.workers.dev",
  "https://rss-proxy-2.philipp-thuering.workers.dev",
  "https://rss-proxy-3.philipp-thuering.workers.dev",
  "https://rss-proxy-4.philipp-thuering.workers.dev",
];

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
 * Classify all unclassified articles using sequential batches
 */
export async function classifyNew(onProgress) {
  const apiKey = await getNvidiaApiKey();

  const articles = await getUnclassifiedArticles();
  console.log(`[Classify] Found ${articles.length} unclassified articles`);

  if (articles.length === 0) {
    return { classified: 0, failed: 0, errors: [] };
  }

  const totalArticles = articles.length;
  const batchSize = CLASSIFY_CONFIG.batchSize;
  const results = [];

  // Build batches
  const batches = [];
  for (let i = 0; i < articles.length; i += batchSize) {
    batches.push(articles.slice(i, i + batchSize));
  }
  console.log(`[Classify] Processing ${batches.length} batches sequentially (batch size ${batchSize})`);

  // Process batches sequentially, rotating through workers
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const workerUrl = WORKER_URLS[i % WORKER_URLS.length];
    console.log(`[Classify] Batch ${i + 1}/${batches.length} → ${workerUrl}`);

    try {
      const batchResults = await classifyBatchWithWorker(workerUrl, apiKey, batch);

      for (let j = 0; j < batch.length; j++) {
        const article = batch[j];
        const result = batchResults[j];

        if (result) {
          await updateArticle(article.id, {
            scores: result.scores,
            tags: normalizeKeywords(result.tags),
            summary_de: result.summary_de,
            reasoning: result.reasoning,
            deadline: result.deadline || null,
            classifiedAt: new Date().toISOString(),
          });
          results.push({ success: true, articleId: article.id, title: article.title, contentLength: article.content?.length || 0, scores: result.scores });
        } else {
          results.push({ success: false, articleId: article.id, title: article.title, contentLength: article.content?.length || 0, error: "No result" });
        }
      }
    } catch (error) {
      const isTokenError = error.message?.includes("token") ||
                          error.message?.includes("too long") ||
                          error.message?.includes("context length");

      if (isTokenError && batch.length > 1) {
        console.log(`[Classify] Token error on batch, trying ${batch.length} articles individually`);
        for (const article of batch) {
          try {
            const singleResults = await classifyBatchWithWorker(workerUrl, apiKey, [article]);
            if (singleResults[0]) {
              await updateArticle(article.id, {
                scores: singleResults[0].scores,
                tags: normalizeKeywords(singleResults[0].tags),
                summary_de: singleResults[0].summary_de,
                reasoning: singleResults[0].reasoning,
                deadline: singleResults[0].deadline || null,
                classifiedAt: new Date().toISOString(),
              });
              results.push({ success: true, articleId: article.id, title: article.title, contentLength: article.content?.length || 0, scores: singleResults[0].scores });
            } else {
              results.push({ success: false, articleId: article.id, title: article.title, contentLength: article.content?.length || 0, error: "No result" });
            }
          } catch (singleError) {
            console.error(`[Classify] Individual article failed:`, article.id, singleError.message);
            results.push({ success: false, articleId: article.id, title: article.title, contentLength: article.content?.length || 0, error: singleError.message });
          }
          // Pause between individual retries
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } else {
        for (const article of batch) {
          results.push({ success: false, articleId: article.id, title: article.title, contentLength: article.content?.length || 0, error: error.message });
        }
      }
    }

    // Update progress after each batch
    if (onProgress) {
      onProgress({ current: Math.min((i + 1) * batchSize, totalArticles), total: totalArticles });
    }

    // Pause between batches to respect rate limits
    if (i < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  const classified = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const errors = results
    .filter(r => !r.success && r.error)
    .map(r => r.error);

  return { classified, failed, errors, details: results };
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
    temperature: 0.3,
    max_tokens: 16384,
  };

  const maxRetries = 3;
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[Classify] Worker ${workerUrl}: API call attempt ${attempt + 1}/${maxRetries}`);
      const data = await callNvidiaApiViaWorker(workerUrl, apiKey, body);
      console.log(`[Classify] Worker ${workerUrl}: API call successful`);
      
      const msg = data.choices[0]?.message;
      // Use content only — reasoning_content is the model's thinking, not the answer
      const content = (msg?.content || "").trim();
      
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

  const results = await classifyBatchWithWorker(WORKER_URLS[0], apiKey, [article]);
  
  if (!results[0]) {
    throw new Error("Failed to classify article");
  }

  await updateArticle(article.id, {
    scores: results[0].scores,
    tags: normalizeKeywords(results[0].tags),
    summary_de: results[0].summary_de,
    reasoning: results[0].reasoning,
    deadline: results[0].deadline || null,
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
  }

  // Content has surrounding text (e.g. reasoning_content with thinking)
  // Try to extract JSON array or object
  const arrMatch = cleanContent.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrMatch) {
    return JSON.parse(arrMatch[0]);
  }
  const objMatch = cleanContent.match(/\{[\s\S]*?\}/);
  if (objMatch) {
    return [JSON.parse(objMatch[0])];
  }

  throw new Error("Invalid JSON format - no JSON found in response");
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
      deadline: r.deadline || null,
    };
  });
}

/**
 * Deep classification threshold – articles with any score >= this get full-text re-classification
 */
const DEEP_CLASSIFY_THRESHOLD = 5;

/**
 * Fetch full article text from URL via CORS proxy
 */
async function fetchArticleFullText(articleUrl, workerUrl) {
  const proxyUrl = `${workerUrl}?url=${encodeURIComponent(articleUrl)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(proxyUrl, {
      signal: controller.signal,
      headers: { Accept: "text/html, */*" },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    return extractTextFromHtml(html);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error("Timeout fetching article");
    }
    throw error;
  }
}

/**
 * Extract readable text from HTML, focusing on article content
 */
function extractTextFromHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Remove non-content elements
  const removeTags = ["script", "style", "nav", "footer", "header", "aside", "iframe", "noscript", "svg", "form"];
  removeTags.forEach(tag => {
    doc.querySelectorAll(tag).forEach(el => el.remove());
  });

  // Remove common non-content classes/ids
  const removeSelectors = [
    "[class*='cookie']", "[class*='banner']", "[class*='popup']",
    "[class*='sidebar']", "[class*='comment']", "[class*='share']",
    "[class*='social']", "[class*='newsletter']", "[class*='advert']",
    "[class*='widget']", "[class*='related']", "[class*='recommend']",
    "[id*='cookie']", "[id*='banner']", "[id*='popup']",
    "[id*='sidebar']", "[id*='comment']", "[id*='share']",
  ];
  removeSelectors.forEach(sel => {
    try { doc.querySelectorAll(sel).forEach(el => el.remove()); } catch {}
  });

  // Try to find article content first (common article containers)
  const articleSelectors = [
    "article", "[role='main']", "main",
    ".post-content", ".article-content", ".entry-content",
    ".article-body", ".story-body", ".content-body",
    ".article__body", ".post__content",
  ];

  for (const sel of articleSelectors) {
    const el = doc.querySelector(sel);
    if (el && el.textContent.trim().length > 200) {
      return cleanExtractedText(el.textContent);
    }
  }

  // Fallback: use body
  const body = doc.querySelector("body");
  return body ? cleanExtractedText(body.textContent) : "";
}

/**
 * Clean extracted text: collapse whitespace, remove boilerplate
 */
function cleanExtractedText(text) {
  let cleaned = text
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();

  // Truncate to a generous limit for full-text analysis
  if (cleaned.length > 32000) {
    cleaned = cleaned.substring(0, 32000) + "...";
  }

  return cleaned;
}

/**
 * Get max score across all 4 lenses
 */
function getMaxScore(scores) {
  if (!scores) return 0;
  return Math.max(
    scores.oepnv_direkt || 0,
    scores.tech_transfer || 0,
    scores.foerder || 0,
    scores.markt || 0
  );
}

/**
 * Second-pass deep classification: fetches full article content for high-scoring articles
 * and re-classifies them with the complete text.
 * Only processes articles where any score >= DEEP_CLASSIFY_THRESHOLD from the first pass.
 */
export async function deepClassify(onProgress) {
  const apiKey = await getNvidiaApiKey();

  // Find articles that passed the first-pass threshold
  const allArticles = await getAllArticles();
  const candidates = allArticles.filter(a =>
    a.scores && getMaxScore(a.scores) >= DEEP_CLASSIFY_THRESHOLD && !a.deepClassifiedAt
  );

  console.log(`[DeepClassify] Found ${candidates.length} articles with max score >= ${DEEP_CLASSIFY_THRESHOLD}`);

  if (candidates.length === 0) {
    return { deepClassified: 0, failed: 0, skipped: 0, errors: [] };
  }

  const results = [];

  // Process articles one-by-one (each needs its own full-text fetch)
  for (let i = 0; i < candidates.length; i++) {
    const article = candidates[i];
    const workerUrl = WORKER_URLS[i % WORKER_URLS.length];

    if (onProgress) {
      onProgress({ current: i, total: candidates.length });
    }

    // Step 1: Fetch full article text
    let fullText;
    try {
      console.log(`[DeepClassify] ${i + 1}/${candidates.length} Fetching: ${article.url}`);
      fullText = await fetchArticleFullText(article.url, workerUrl);
    } catch (fetchError) {
      console.warn(`[DeepClassify] Failed to fetch ${article.url}: ${fetchError.message}`);
      results.push({ success: false, articleId: article.id, title: article.title, contentLength: 0, error: `Fetch failed: ${fetchError.message}` });
      await new Promise(r => setTimeout(r, 500));
      continue;
    }

    if (!fullText || fullText.length < 100) {
      console.warn(`[DeepClassify] Insufficient content from ${article.url} (${fullText?.length || 0} chars)`);
      results.push({ success: false, articleId: article.id, title: article.title, contentLength: fullText?.length || 0, error: `Nur ${fullText?.length || 0} Zeichen extrahiert` });
      continue;
    }

    console.log(`[DeepClassify] Got ${fullText.length} chars for "${article.title.substring(0, 50)}..."`);

    // Step 2: Re-classify with full text
    try {
      // Build a single-article object with full content
      const enrichedArticle = { ...article, content: fullText };
      const batchResults = await classifyBatchWithWorker(workerUrl, apiKey, [enrichedArticle]);

      if (batchResults[0]) {
        await updateArticle(article.id, {
          content: fullText,
          scores: batchResults[0].scores,
          tags: normalizeKeywords(batchResults[0].tags),
          summary_de: batchResults[0].summary_de,
          reasoning: batchResults[0].reasoning,
          deadline: batchResults[0].deadline || null,
          classifiedAt: new Date().toISOString(),
          deepClassifiedAt: new Date().toISOString(),
        });
        console.log(`[DeepClassify] Re-classified: ${JSON.stringify(batchResults[0].scores)}`);
        results.push({ success: true, articleId: article.id, title: article.title, contentLength: fullText.length, scores: batchResults[0].scores });
      } else {
        results.push({ success: false, articleId: article.id, title: article.title, contentLength: fullText.length, error: "Keine Ergebnisse von Re-Klassifikation" });
      }
    } catch (classifyError) {
      console.error(`[DeepClassify] Classification failed for ${article.id}: ${classifyError.message}`);
      results.push({ success: false, articleId: article.id, title: article.title, contentLength: fullText?.length || 0, error: classifyError.message });
    }

    // Pause between articles to respect rate limits
    if (i < candidates.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (onProgress) {
    onProgress({ current: candidates.length, total: candidates.length });
  }

  const deepClassified = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const errors = results.filter(r => !r.success && r.error).map(r => r.error);

  return { deepClassified, failed, skipped: allArticles.length - candidates.length, errors, details: results };
}

export default {
  classifyNew,
  classifySingle,
  deepClassify,
};
