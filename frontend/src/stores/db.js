/**
 * @module db
 * @purpose Zentrale IndexedDB-Verbindung für alle Stores
 *
 * @reads    nichts
 * @writes   IndexedDB → erstellt/migriert Object-Stores
 * @calledBy stores/articleStore.js → getDB()
 * @calledBy stores/projectStore.js → getDB()
 *
 * @exports
 *   getDB(): Promise<IDBPDatabase> – gibt die initialisierte DB zurück
 */

import { openDB } from "idb";

const DB_NAME = "trend-radar";
const DB_VERSION = 2;

let dbPromise = null;

/**
 * Get (or initialize) the shared database connection.
 * Creates all object stores in one upgrade transaction.
 * @returns {Promise<IDBPDatabase>}
 */
export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // v1 → articles store
        if (!db.objectStoreNames.contains("articles")) {
          const store = db.createObjectStore("articles", { keyPath: "id" });
          store.createIndex("published", "published", { unique: false });
          store.createIndex("source", "source", { unique: false });
          store.createIndex("bookmarked", "bookmarked", { unique: false });
          store.createIndex("sourceCategory", "sourceCategory", { unique: false });
        }

        // v2 → projects store
        if (!db.objectStoreNames.contains("projects")) {
          db.createObjectStore("projects", { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}
