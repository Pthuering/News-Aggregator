/**
 * @module sourceStore
 * @purpose IndexedDB-Zugriff für Feed-Quellen (CRUD + Migration)
 *
 * @reads    config/sources.js → Default-Quellen für Erstmigration
 * @writes   IndexedDB "sources" store
 * @calledBy services/feedService.js → getActiveSources()
 * @calledBy components/FeedManager.jsx → alle CRUD-Operationen
 *
 * @exports
 *   initSources(): Promise<void> – migriert Default-Quellen bei Erststart
 *   getAllSources(): Promise<Source[]>
 *   getActiveSources(): Promise<Source[]>
 *   getSourceById(id): Promise<Source|null>
 *   saveSource(source): Promise<void>
 *   updateSource(id, partial): Promise<void>
 *   deleteSource(id): Promise<void>
 *   getCategories(): Promise<string[]>
 */

import { getDB } from "./db.js";
import { sources as defaultSources } from "../config/sources.js";

const STORE_NAME = "sources";
const MIGRATED_KEY = "tr_sourcesMigrated";

/**
 * Initialize sources – migrate defaults on first run, add missing defaults on updates
 */
export async function initSources() {
  const db = await getDB();
  const migrated = localStorage.getItem(MIGRATED_KEY);

  if (!migrated) {
    // First run: seed all defaults if store is empty
    const count = await db.count(STORE_NAME);
    if (count === 0) {
      const tx = db.transaction(STORE_NAME, "readwrite");
      for (const src of defaultSources) {
        await tx.store.put({
          ...src,
          lastFetched: null,
          lastError: null,
          articleCount: 0,
          createdAt: new Date().toISOString(),
        });
      }
      await tx.done;
    }
  }

  // Always add missing defaults (handles new sources added after initial migration)
  const existing = await db.getAll(STORE_NAME);
  const existingIds = new Set(existing.map((s) => s.id));
  const missing = defaultSources.filter((s) => !existingIds.has(s.id));
  if (missing.length > 0) {
    const tx = db.transaction(STORE_NAME, "readwrite");
    for (const src of missing) {
      await tx.store.put({
        ...src,
        lastFetched: null,
        lastError: null,
        articleCount: 0,
        createdAt: new Date().toISOString(),
      });
    }
    await tx.done;
  }

  localStorage.setItem(MIGRATED_KEY, "1");
}

/**
 * Get all sources
 * @returns {Promise<Source[]>}
 */
export async function getAllSources() {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

/**
 * Get only active sources
 * @returns {Promise<Source[]>}
 */
export async function getActiveSources() {
  const all = await getAllSources();
  return all.filter((s) => s.active);
}

/**
 * Get source by ID
 * @param {string} id
 * @returns {Promise<Source|null>}
 */
export async function getSourceById(id) {
  const db = await getDB();
  return db.get(STORE_NAME, id);
}

/**
 * Save a new source or overwrite existing
 * @param {Source} source
 */
export async function saveSource(source) {
  const db = await getDB();
  await db.put(STORE_NAME, source);
}

/**
 * Update partial fields on a source
 * @param {string} id
 * @param {object} partial
 */
export async function updateSource(id, partial) {
  const db = await getDB();
  const existing = await db.get(STORE_NAME, id);
  if (!existing) throw new Error(`Source ${id} not found`);
  await db.put(STORE_NAME, { ...existing, ...partial });
}

/**
 * Delete a source
 * @param {string} id
 */
export async function deleteSource(id) {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

/**
 * Get unique categories from all sources
 * @returns {Promise<string[]>}
 */
export async function getCategories() {
  const all = await getAllSources();
  return [...new Set(all.map((s) => s.category))].sort();
}
