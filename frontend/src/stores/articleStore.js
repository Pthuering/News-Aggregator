/**
 * @module articleStore
 * @purpose IndexedDB-Zugriff für Artikel (CRUD + Queries)
 *
 * @reads    nichts (ist selbst die Datenquelle)
 * @writes   nichts (ist selbst die Datenquelle)
 * @calledBy services/feedService.js → saveArticles(), articleExists()
 * @calledBy services/classifyService.js → getUnclassified(), updateArticle()
 * @calledBy services/matchService.js → updateArticle() (synergies)
 * @calledBy components/ArticleList.jsx → getAllArticles(), getByFilter()
 * @calledBy components/ArticleDetail.jsx → updateArticle() (notes, bookmark)
 * @calledBy components/Settings.jsx → exportAll(), importAll()
 *
 * @dataflow  Empfängt Artikel von Services → speichert in IndexedDB
 *            → liefert an Components für Anzeige
 *
 * @exports
 *   initDB(): Promise<void> – DB initialisieren (beim App-Start)
 *   saveArticles(articles: RawArticle[]): Promise<number> – gibt Anzahl neuer zurück
 *   articleExists(id: string): Promise<boolean>
 *   getArticleById(id: string): Promise<EnrichedArticle|null>
 *   getAllArticles(): Promise<EnrichedArticle[]>
 *   getUnclassifiedArticles(): Promise<RawArticle[]> – wo scores undefined
 *   updateArticle(id: string, partial: object): Promise<void>
 *   getArticlesByFilter(filter: FilterCriteria): Promise<EnrichedArticle[]>
 *   exportAll(): Promise<EnrichedArticle[]> – für JSON-Backup
 *   importAll(articles: EnrichedArticle[]): Promise<void> – überschreibt alles
 *
 * @errors  Bei DB-Fehlern: Error werfen, Caller behandelt
 */

import { openDB } from "idb";

const DB_NAME = "trend-radar";
const DB_VERSION = 1;
const STORE_NAME = "articles";

let db = null;

/**
 * Initialize the database
 * @returns {Promise<void>}
 */
export async function initDB() {
  if (db) return;

  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        // Create indexes for filtering
        store.createIndex("published", "published", { unique: false });
        store.createIndex("source", "source", { unique: false });
        store.createIndex("bookmarked", "bookmarked", { unique: false });
        store.createIndex("sourceCategory", "sourceCategory", { unique: false });
      }
    },
  });
}

/**
 * Save articles to the database
 * @param {RawArticle[]} articles - Articles to save
 * @returns {Promise<number>} - Number of new articles saved
 */
export async function saveArticles(articles) {
  if (!db) await initDB();

  let newCount = 0;
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  for (const article of articles) {
    const exists = await store.get(article.id);
    if (!exists) {
      // New article - initialize with default values
      const enrichedArticle = {
        ...article,
        scores: undefined,
        tags: undefined,
        summary_de: undefined,
        reasoning: undefined,
        classifiedAt: undefined,
        synergies: [],
        clusterId: null,
        bookmarked: false,
        userNotes: null,
      };
      await store.put(enrichedArticle);
      newCount++;
    }
  }

  await tx.done;
  return newCount;
}

/**
 * Check if an article exists
 * @param {string} id - Article ID
 * @returns {Promise<boolean>}
 */
export async function articleExists(id) {
  if (!db) await initDB();
  const article = await db.get(STORE_NAME, id);
  return !!article;
}

/**
 * Get article by ID
 * @param {string} id - Article ID
 * @returns {Promise<EnrichedArticle|null>}
 */
export async function getArticleById(id) {
  if (!db) await initDB();
  return db.get(STORE_NAME, id);
}

/**
 * Get all articles
 * @returns {Promise<EnrichedArticle[]>}
 */
export async function getAllArticles() {
  if (!db) await initDB();
  return db.getAll(STORE_NAME);
}

/**
 * Get unclassified articles (no scores)
 * @returns {Promise<RawArticle[]>}
 */
export async function getUnclassifiedArticles() {
  if (!db) await initDB();
  const all = await db.getAll(STORE_NAME);
  return all.filter((a) => !a.scores);
}

/**
 * Update an article partially
 * @param {string} id - Article ID
 * @param {object} partial - Fields to update
 * @returns {Promise<void>}
 */
export async function updateArticle(id, partial) {
  if (!db) await initDB();

  const existing = await db.get(STORE_NAME, id);
  if (!existing) {
    throw new Error(`Article with id ${id} not found`);
  }

  await db.put(STORE_NAME, { ...existing, ...partial });
}

/**
 * FilterCriteria type:
 * {
 *   minScores: { oepnv_direkt?, tech_transfer?, foerder?, markt? },
 *   tags: string[],
 *   sourceCategories: string[],
 *   bookmarkedOnly: boolean,
 *   searchText: string,
 *   onlyClassified: boolean
 * }
 */

/**
 * Get articles by filter criteria
 * @param {object} filter - Filter criteria
 * @returns {Promise<EnrichedArticle[]>}
 */
export async function getArticlesByFilter(filter = {}) {
  if (!db) await initDB();

  let articles = await db.getAll(STORE_NAME);

  // Filter by minimum scores
  if (filter.minScores) {
    articles = articles.filter((a) => {
      if (!a.scores) return false;
      for (const [key, minValue] of Object.entries(filter.minScores)) {
        if ((a.scores[key] || 0) < minValue) return false;
      }
      return true;
    });
  }

  // Filter by tags (must have at least one)
  if (filter.tags && filter.tags.length > 0) {
    articles = articles.filter(
      (a) => a.tags && a.tags.some((tag) => filter.tags.includes(tag))
    );
  }

  // Filter by source categories
  if (filter.sourceCategories && filter.sourceCategories.length > 0) {
    articles = articles.filter((a) =>
      filter.sourceCategories.includes(a.sourceCategory)
    );
  }

  // Filter by bookmarked only
  if (filter.bookmarkedOnly) {
    articles = articles.filter((a) => a.bookmarked);
  }

  // Filter by search text (title + summary_de)
  if (filter.searchText) {
    const lowerSearch = filter.searchText.toLowerCase();
    articles = articles.filter(
      (a) =>
        a.title.toLowerCase().includes(lowerSearch) ||
        (a.summary_de && a.summary_de.toLowerCase().includes(lowerSearch)) ||
        a.content.toLowerCase().includes(lowerSearch)
    );
  }

  // Filter by classified only
  if (filter.onlyClassified) {
    articles = articles.filter((a) => a.scores !== undefined);
  }

  return articles;
}

/**
 * Export all articles (for backup)
 * @returns {Promise<EnrichedArticle[]>}
 */
export async function exportAll() {
  if (!db) await initDB();
  return db.getAll(STORE_NAME);
}

/**
 * Import articles (restores from backup, overwrites existing)
 * @param {EnrichedArticle[]} articles - Articles to import
 * @returns {Promise<void>}
 */
export async function importAll(articles) {
  if (!db) await initDB();

  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  // Clear existing
  await store.clear();

  // Import all
  for (const article of articles) {
    await store.put(article);
  }

  await tx.done;
}

/**
 * Clear all articles
 * @returns {Promise<void>}
 */
export async function clearArticles() {
  if (!db) await initDB();
  await db.clear(STORE_NAME);
}

export default {
  initDB,
  saveArticles,
  articleExists,
  getArticleById,
  getAllArticles,
  getUnclassifiedArticles,
  updateArticle,
  getArticlesByFilter,
  exportAll,
  importAll,
  clearArticles,
};
