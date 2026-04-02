/**
 * @module sources
 * @purpose Liste aller RSS-Feed-Quellen als SourceConfig[]
 *
 * @reads    nichts
 * @writes   nichts
 * @calledBy services/feedService.js → iteriert über aktive Quellen
 * @calledBy components/Settings.jsx → zeigt/editiert Quellen
 *
 * @exports
 *   sources: SourceConfig[] – alle konfigurierten Quellen
 *   getActiveSources(): SourceConfig[] – nur active === true
 *   getSourcesByCategory(cat: string): SourceConfig[] – gefiltert nach Kategorie
 */

/**
 * @typedef {Object} SourceConfig
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {string} url - RSS feed URL
 * @property {string} type - Feed type ("rss")
 * @property {string} category - "branche"|"tech"|"foerder"|"startup"|"international"
 * @property {boolean} active - Whether this source is enabled
 */

export const sources = [
  // Kategorie "branche"
  {
    id: "nahverkehr-hamburg",
    name: "Nahverkehr Hamburg",
    url: "https://www.nahverkehrhamburg.de/feed/",
    type: "rss",
    category: "branche",
    active: true,
  },
  {
    id: "zukunft-mobilitaet",
    name: "Zukunft Mobilität",
    url: "https://www.zukunft-mobilitaet.net/feed/",
    type: "rss",
    category: "branche",
    active: true,
  },

  // Kategorie "international"
  {
    id: "cities-today",
    name: "Cities Today",
    url: "https://cities-today.com/feed/",
    type: "rss",
    category: "international",
    active: true,
  },

  // Kategorie "tech"
  {
    id: "heise-it",
    name: "Heise Online IT",
    url: "https://www.heise.de/rss/heise-atom.xml",
    type: "rss",
    category: "tech",
    active: true,
  },
  {
    id: "the-verge",
    name: "The Verge",
    url: "https://www.theverge.com/rss/index.xml",
    type: "rss",
    category: "tech",
    active: true,
  },

  // Kategorie "startup"
  {
    id: "eu-startups",
    name: "EU-Startups",
    url: "https://www.eu-startups.com/feed/",
    type: "rss",
    category: "startup",
    active: true,
  },
];

/**
 * Get only active sources
 * @returns {SourceConfig[]}
 */
export function getActiveSources() {
  return sources.filter((s) => s.active);
}

/**
 * Get sources filtered by category
 * @param {string} category - Category to filter by
 * @returns {SourceConfig[]}
 */
export function getSourcesByCategory(category) {
  return sources.filter((s) => s.category === category);
}

export default sources;
