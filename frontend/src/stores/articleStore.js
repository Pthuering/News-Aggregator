/**
 * @module articleStore
 * @purpose IndexedDB storage for articles
 *
 * @reads    settings.js → database config
 * @writes   IndexedDB → articles store
 * @calledBy feedService.js → save fetched articles
 * @calledBy ArticleList.jsx → display articles
 * @calledBy classifyService.js → update classified articles
 *
 * @dataflow RawArticle/ClassifiedArticle/EnrichedArticle → IndexedDB → CRUD operations
 *
 * @exports
 *   initArticleStore(): Promise<void> – Initialize the database
 *   saveArticles(articles: RawArticle[]): Promise<void> – Save multiple articles
 *   getArticles(): Promise<EnrichedArticle[]> – Get all articles
 *   getArticleById(id: string): Promise<EnrichedArticle|null> – Get single article
 *   updateArticle(id: string, updates: Partial<EnrichedArticle>): Promise<void> – Update article
 *   deleteArticle(id: string): Promise<void> – Delete article
 *   clearArticles(): Promise<void> – Clear all articles
 *   getArticlesBySource(sourceId: string): Promise<EnrichedArticle[]> – Filter by source
 *
 * @errors Logs errors to console, throws for critical failures
 */

import { openDB } from "idb";
import { settings } from "../config/settings.js";

const DB_NAME = settings.database.name;
const DB_VERSION = settings.database.version;
const STORE_NAME = settings.database.stores.articles;

let db = null;

/**
 * Initialize the article store database
 * @returns {Promise<void>}
 */
export async function initArticleStore() {
  if (db) return;

  try {
    db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // Create articles store with id as keyPath
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          // Create indexes for common queries
          store.createIndex("source", "source", { unique: false });
          store.createIndex("sourceCategory", "sourceCategory", { unique: false });
          store.createIndex("published", "published", { unique: false });
          store.createIndex("bookmarked", "bookmarked", { unique: false });
        }
      },
    });
  } catch (error) {
    console.error("Failed to initialize article store:", error);
    throw error;
  }
}

/**
 * Save multiple articles to the database
 * @param {RawArticle[]} articles - Articles to save
 * @returns {Promise<void>}
 */
export async function saveArticles(articles) {
  if (!db) await initArticleStore();

  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  for (const article of articles) {
    // Check if article already exists
    const existing = await store.get(article.id);
    if (existing) {
      // Merge with existing data (preserve user edits)
      await store.put({ ...existing, ...article });
    } else {
      // New article - initialize with default values
      await store.put({
        ...article,
        synergies: [],
        clusterId: null,
        bookmarked: false,
        userNotes: null,
      });
    }
  }

  await tx.done;
}

/**
 * Get all articles from the database
 * @returns {Promise<EnrichedArticle[]>}
 */
export async function getArticles() {
  if (!db) await initArticleStore();
  return db.getAll(STORE_NAME);
}

/**
 * Get a single article by ID
 * @param {string} id - Article ID
 * @returns {Promise<EnrichedArticle|null>}
 */
export async function getArticleById(id) {
  if (!db) await initArticleStore();
  return db.get(STORE_NAME, id);
}

/**
 * Update specific fields of an article
 * @param {string} id - Article ID
 * @param {Partial<EnrichedArticle>} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateArticle(id, updates) {
  if (!db) await initArticleStore();

  const existing = await db.get(STORE_NAME, id);
  if (!existing) {
    throw new Error(`Article with id ${id} not found`);
  }

  await db.put(STORE_NAME, { ...existing, ...updates });
}

/**
 * Delete an article from the database
 * @param {string} id - Article ID
 * @returns {Promise<void>}
 */
export async function deleteArticle(id) {
  if (!db) await initArticleStore();
  await db.delete(STORE_NAME, id);
}

/**
 * Clear all articles from the database
 * @returns {Promise<void>}
 */
export async function clearArticles() {
  if (!db) await initArticleStore();
  await db.clear(STORE_NAME);
}

/**
 * Get articles filtered by source ID
 * @param {string} sourceId - Source identifier
 * @returns {Promise<EnrichedArticle[]>}
 */
export async function getArticlesBySource(sourceId) {
  if (!db) await initArticleStore();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const index = store.index("source");
  return index.getAll(sourceId);
}

/**
 * Get bookmarked articles
 * @returns {Promise<EnrichedArticle[]>}
 */
export async function getBookmarkedArticles() {
  if (!db) await initArticleStore();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const index = store.index("bookmarked");
  return index.getAll(true);
}

export default {
  initArticleStore,
  saveArticles,
  getArticles,
  getArticleById,
  updateArticle,
  deleteArticle,
  clearArticles,
  getArticlesBySource,
  getBookmarkedArticles,
};
