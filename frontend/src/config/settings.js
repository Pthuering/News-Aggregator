/**
 * @module settings
 * @purpose Zentrale App-Konfiguration (Proxy-URL, API-Config, Defaults)
 *
 * @reads    stores/settingsStore.js → user-konfigurierte Werte (API-Key)
 * @writes   nichts
 * @calledBy services/feedService.js → getProxyUrl()
 * @calledBy services/classifyService.js → API_CONFIG
 *
 * @exports
 *   getProxyUrl(): string – URL des CORS-Proxy Workers
 *   API_CONFIG: { model, maxTokens } – NVIDIA API Defaults
 *   CLASSIFY_CONFIG: { batchSize, maxContentLength } – Klassifikations-Params
 */

// CORS Proxy URL
const PROXY_URL = "https://rss-proxy.philipp-thuering.workers.dev";

/**
 * Get the CORS proxy URL
 * @returns {string}
 */
export function getProxyUrl() {
  return PROXY_URL;
}

/**
 * NVIDIA API configuration
 */
export const API_CONFIG = {
  model: "z-ai/glm4.7",
  maxTokens: 1500,
};

/**
 * Classification configuration
 */
export const CLASSIFY_CONFIG = {
  batchSize: 5,
  maxContentLength: 4000,
};

export default {
  getProxyUrl,
  API_CONFIG,
  CLASSIFY_CONFIG,
};
