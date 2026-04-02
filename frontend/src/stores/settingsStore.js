/**
 * @module settingsStore
 * @purpose Persistierte User-Einstellungen (API-Key, Filter-Defaults)
 *
 * @reads    nichts
 * @writes   nichts
 * @calledBy services/classifyService.js → getApiKey()
 * @calledBy services/matchService.js → getApiKey()
 * @calledBy services/reportService.js → getApiKey()
 * @calledBy components/FilterBar.jsx → getFilterDefaults()
 * @calledBy components/Settings.jsx → alle Funktionen
 *
 * @exports
 *   getApiKey(): string | null
 *   setApiKey(key: string): void
 *   getFilterDefaults(): FilterCriteria
 *   setFilterDefaults(filters: FilterCriteria): void
 *
 * @errors  Keine – localStorage wirft praktisch nie
 */

const STORAGE_KEY_API = "tr_apiKey";
const STORAGE_KEY_FILTERS = "tr_filterDefaults";

// Default filter criteria
const defaultFilterCriteria = {
  minScores: {},
  tags: [],
  sourceCategories: [],
  bookmarkedOnly: false,
  searchText: "",
  onlyClassified: false,
};

/**
 * Get NVIDIA API key
 * @returns {string | null}
 */
export function getApiKey() {
  return localStorage.getItem(STORAGE_KEY_API);
}

/**
 * Set NVIDIA API key
 * @param {string} key
 */
export function setApiKey(key) {
  localStorage.setItem(STORAGE_KEY_API, key);
}

/**
 * Get filter defaults
 * @returns {object}
 */
export function getFilterDefaults() {
  const stored = localStorage.getItem(STORAGE_KEY_FILTERS);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      return defaultFilterCriteria;
    }
  }
  return defaultFilterCriteria;
}

/**
 * Set filter defaults
 * @param {object} filters
 */
export function setFilterDefaults(filters) {
  localStorage.setItem(STORAGE_KEY_FILTERS, JSON.stringify(filters));
}

// Legacy functions for backward compatibility with existing code

export async function initSettingsStore() {
  // No initialization needed for localStorage
}

export async function getSetting(key) {
  if (key === "nvidiaApiKey") {
    return getApiKey() || "";
  }
  // For other settings, return from filter defaults or empty
  const defaults = getFilterDefaults();
  return defaults[key] || "";
}

export async function setSetting(key, value) {
  if (key === "nvidiaApiKey") {
    setApiKey(value);
  }
  // Other settings not stored in this simple version
}

export async function getAllSettings() {
  return {
    nvidiaApiKey: getApiKey() || "",
    theme: "system",
    sidebarCollapsed: false,
    autoFetchOnStartup: false,
    fetchIntervalMinutes: 60,
    autoClassify: false,
    classificationThreshold: 5,
    defaultReportLength: "mittel",
    defaultReportAudience: "fachabteilung",
    defaultReportFocus: "allgemein",
  };
}

export async function clearSettings() {
  localStorage.removeItem(STORAGE_KEY_API);
  localStorage.removeItem(STORAGE_KEY_FILTERS);
}

export async function hasNvidiaApiKey() {
  const key = getApiKey();
  return key && key.length > 0;
}

export async function getNvidiaApiKey() {
  return getApiKey() || "";
}

export async function setNvidiaApiKey(apiKey) {
  setApiKey(apiKey);
}

export default {
  getApiKey,
  setApiKey,
  getFilterDefaults,
  setFilterDefaults,
  // Legacy exports
  initSettingsStore,
  getSetting,
  setSetting,
  getAllSettings,
  clearSettings,
  hasNvidiaApiKey,
  getNvidiaApiKey,
  setNvidiaApiKey,
};
