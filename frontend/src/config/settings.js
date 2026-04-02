/**
 * @module settings
 * @purpose Application settings and configuration
 *
 * @dataflow Static configuration for app behavior and API endpoints
 *
 * @exports settings - Application settings object
 */

export const settings = {
  // CORS Proxy Configuration
  corsProxy: {
    // Cloudflare Worker URL for RSS feed proxying
    // Replace with your actual worker URL after deployment
    url: "https://your-worker.your-subdomain.workers.dev",
  },

  // Feed Fetch Configuration
  feed: {
    // Maximum articles to fetch per source
    maxArticlesPerSource: 20,
    // Maximum content length per article (characters)
    maxContentLength: 4000,
    // Request timeout in milliseconds
    timeoutMs: 10000,
  },

  // Anthropic API Configuration
  anthropic: {
    // API key is stored in settingsStore, not here
    model: "claude-sonnet-4-20250514",
    maxTokens: 4096,
    temperature: 0.3,
  },

  // UI Configuration
  ui: {
    // Default page size for article lists
    pageSize: 20,
    // Date format for display
    dateFormat: "de-DE",
  },

  // IndexedDB Configuration
  database: {
    name: "NewsAggregatorDB",
    version: 1,
    stores: {
      articles: "articles",
      projects: "projects",
      settings: "settings",
    },
  },
};

export default settings;
