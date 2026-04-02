/**
 * @module sources
 * @purpose RSS feed source configurations for the News Aggregator
 *
 * @dataflow Static configuration of news sources by category
 *
 * @exports SourceConfig[] - Array of RSS feed sources
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
  // Branche (Public Transport Sector)
  {
    id: "mobil-verbund",
    name: "Mobil.Verbünde",
    url: "https://www.mobil-verbund.de/rss.xml",
    type: "rss",
    category: "branche",
    active: true,
  },
  {
    id: "nahverkehr",
    name: "Nahverkehr",
    url: "https://www.nahverkehr.de/rss",
    type: "rss",
    category: "branche",
    active: true,
  },
  {
    id: "urban-transport",
    name: "Urban Transport Magazine",
    url: "https://www.urban-transport-magazine.com/feed/",
    type: "rss",
    category: "branche",
    active: true,
  },

  // Tech (Technology)
  {
    id: "heise-mobility",
    name: "Heise Mobility",
    url: "https://www.heise.de/rss/mobility.xml",
    type: "rss",
    category: "tech",
    active: true,
  },
  {
    id: "verkehrsrundschau-digital",
    name: "VerkehrsRundschau Digital",
    url: "https://www.verkehrsrundschau.de/rss/digital.xml",
    type: "rss",
    category: "tech",
    active: true,
  },

  // Förderung (Funding)
  {
    id: "bmdv-news",
    name: "BMDV News",
    url: "https://www.bmdv.bund.de/SharedDocs/DE/Artikel/News/rss.xml",
    type: "rss",
    category: "foerder",
    active: true,
  },
  {
    id: "foerderdatenbank",
    name: "Förderdatenbank",
    url: "https://www.foerderdatenbank.de/rss.xml",
    type: "rss",
    category: "foerder",
    active: true,
  },

  // Startup
  {
    id: "gruenderszene",
    name: "Gründerszene",
    url: "https://www.gruenderszene.de/rss",
    type: "rss",
    category: "startup",
    active: true,
  },
  {
    id: "deutsche-startups",
    name: "Deutsche Startups",
    url: "https://www.deutsche-startups.de/feed/",
    type: "rss",
    category: "startup",
    active: true,
  },

  // International
  {
    id: "urban-transport-international",
    name: "Urban Transport International",
    url: "https://www.urban-transport-magazine.com/feed/?lang=en",
    type: "rss",
    category: "international",
    active: true,
  },
  {
    id: "intelligent-transport",
    name: "Intelligent Transport",
    url: "https://www.intelligenttransport.com/feed/",
    type: "rss",
    category: "international",
    active: true,
  },
];

export default sources;
