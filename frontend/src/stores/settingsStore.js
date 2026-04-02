/**
 * @module settingsStore
 * @purpose IndexedDB storage for user settings including API keys
 *
 * @reads    settings.js → database config
 * @writes   IndexedDB → settings store
 * @calledBy Settings.jsx → read/write settings
 * @calledBy classifyService.js → read NVIDIA API key
 *
 * @dataflow Settings → IndexedDB → CRUD operations
 *
 * @exports
 *   initSettingsStore(): Promise<void> – Initialize the database
 *   getSetting(key: string): Promise<any> – Get a setting value
 *   setSetting(key: string, value: any): Promise<void> – Set a setting value
 *   getAllSettings(): Promise<Object> – Get all settings
 *   clearSettings(): Promise<void> – Clear all settings
 *   getNvidiaApiKey(): Promise<string> – Get NVIDIA API key
 *   setNvidiaApiKey(apiKey: string): Promise<void> – Set NVIDIA API key
 *
 * @errors Logs errors to console, throws for critical failures
 */

import { openDB } from "idb";

const DB_NAME = "NewsAggregatorDB";
const DB_VERSION = 1;
const STORE_NAME = "settings";

let db = null;

// Default settings
const defaultSettings = {
  // NVIDIA API Key (user must set this)
  nvidiaApiKey: "",
  // UI preferences
  theme: "system",
  sidebarCollapsed: false,
  // Feed preferences
  autoFetchOnStartup: false,
  fetchIntervalMinutes: 60,
  // Classification preferences
  autoClassify: false,
  classificationThreshold: 5,
  // Report preferences
  defaultReportLength: "mittel",
  defaultReportAudience: "fachabteilung",
  defaultReportFocus: "allgemein",
};

/**
 * Initialize the settings store database
 * @returns {Promise<void>}
 */
export async function initSettingsStore() {
  if (db) return;

  try {
    db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      },
    });

    // Initialize default settings if not present
    await initDefaultSettings();
  } catch (error) {
    console.error("Failed to initialize settings store:", error);
    throw error;
  }
}

/**
 * Initialize default settings
 * @returns {Promise<void>}
 */
async function initDefaultSettings() {
  for (const [key, value] of Object.entries(defaultSettings)) {
    const existing = await db.get(STORE_NAME, key);
    if (existing === undefined) {
      await db.put(STORE_NAME, { key, value });
    }
  }
}

/**
 * Get a setting value
 * @param {string} key - Setting key
 * @returns {Promise<any>} - Setting value
 */
export async function getSetting(key) {
  if (!db) await initSettingsStore();
  const result = await db.get(STORE_NAME, key);
  return result ? result.value : defaultSettings[key];
}

/**
 * Set a setting value
 * @param {string} key - Setting key
 * @param {any} value - Setting value
 * @returns {Promise<void>}
 */
export async function setSetting(key, value) {
  if (!db) await initSettingsStore();
  await db.put(STORE_NAME, { key, value });
}

/**
 * Get all settings
 * @returns {Promise<Object>} - All settings as key-value object
 */
export async function getAllSettings() {
  if (!db) await initSettingsStore();
  const allEntries = await db.getAll(STORE_NAME);
  const settings = {};
  for (const entry of allEntries) {
    settings[entry.key] = entry.value;
  }
  // Merge with defaults for any missing keys
  return { ...defaultSettings, ...settings };
}

/**
 * Clear all settings
 * @returns {Promise<void>}
 */
export async function clearSettings() {
  if (!db) await initSettingsStore();
  await db.clear(STORE_NAME);
  // Re-initialize defaults
  await initDefaultSettings();
}

/**
 * Check if NVIDIA API key is configured
 * @returns {Promise<boolean>}
 */
export async function hasNvidiaApiKey() {
  const key = await getSetting("nvidiaApiKey");
  return key && key.length > 0;
}

/**
 * Get NVIDIA API key
 * @returns {Promise<string>}
 */
export async function getNvidiaApiKey() {
  return getSetting("nvidiaApiKey");
}

/**
 * Set NVIDIA API key
 * @param {string} apiKey
 * @returns {Promise<void>}
 */
export async function setNvidiaApiKey(apiKey) {
  return setSetting("nvidiaApiKey", apiKey);
}

export default {
  initSettingsStore,
  getSetting,
  setSetting,
  getAllSettings,
  clearSettings,
  hasNvidiaApiKey,
  getNvidiaApiKey,
  setNvidiaApiKey,
};
