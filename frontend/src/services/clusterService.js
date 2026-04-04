/**
 * @module clusterService
 * @purpose Gruppiert ähnliche Artikel, erkennt Trend-Häufungen
 *
 * @reads    stores/articleStore.js → getAllArticles()
 * @writes   stores/articleStore.js → updateArticle() (clusterId)
 * @calledBy App.jsx → nach Klassifikation, oder separat
 *
 * @dataflow
 *   Alle klassifizierten Artikel laden → Tags + Titles vergleichen
 *   → Ähnliche Artikel zu Clustern gruppieren → clusterIds zuweisen
 *
 * @exports
 *   clusterArticles(): Promise<ClusterResult>
 *     → ClusterResult: { clusters: Cluster[], unclustered: number }
 *
 *   getTrendTimeline(tag: string, days: number): TrendPoint[]
 *     → Zählt Tag-Häufigkeit pro Woche über Zeitraum
 *     → TrendPoint: { week: string, count: number }
 *
 *   getBuzzingTopics(days: number): BuzzTopic[]
 *     → Tags die im Zeitraum überdurchschnittlich oft vorkommen
 *     → BuzzTopic: { tag: string, count: number, trend: "rising"|"stable"|"falling" }
 */

import { getAllArticles, updateArticle } from "../stores/articleStore.js";

const JACCARD_THRESHOLD = 0.5;
const TITLE_OVERLAP_THRESHOLD = 0.3;

/**
 * Calculate Jaccard similarity between two sets
 * @param {Set} setA
 * @param {Set} setB
 * @returns {number} 0-1 similarity score
 */
function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  
  return intersection.size / union.size;
}

/**
 * Calculate title similarity based on word overlap
 * @param {string} titleA
 * @param {string} titleB
 * @returns {number} 0-1 similarity score
 */
function titleSimilarity(titleA, titleB) {
  const normalize = (str) => str
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2);
  
  const wordsA = new Set(normalize(titleA));
  const wordsB = new Set(normalize(titleB));
  
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  
  return intersection.size / union.size;
}

/**
 * Generate cluster ID from sorted tags
 * @param {string[]} tags
 * @returns {string}
 */
function generateClusterId(tags) {
  const sorted = [...tags].sort().join("|");
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const char = sorted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `cluster_${Math.abs(hash).toString(36).substring(0, 8)}`;
}

/**
 * Calculate combined similarity score between two articles
 * @param {object} articleA
 * @param {object} articleB
 * @returns {number}
 */
function calculateSimilarity(articleA, articleB) {
  const tagsA = new Set(articleA.tags || []);
  const tagsB = new Set(articleB.tags || []);
  
  const jaccard = jaccardSimilarity(tagsA, tagsB);
  const titleSim = titleSimilarity(articleA.title, articleB.title);
  
  // Weighted combination: 70% tags, 30% title
  return jaccard * 0.7 + titleSim * 0.3;
}

/**
 * Cluster articles based on tag and title similarity
 * @returns {Promise<ClusterResult>}
 */
export async function clusterArticles() {
  const articles = await getAllArticles();
  const classifiedArticles = articles.filter(a => a.scores && a.tags);
  
  if (classifiedArticles.length === 0) {
    return { clusters: [], unclustered: 0 };
  }
  
  // Group articles into clusters
  const clusters = new Map(); // clusterId -> { id, tags: Set, articles: [] }
  const assigned = new Set();
  
  for (const article of classifiedArticles) {
    if (assigned.has(article.id)) continue;
    
    let bestCluster = null;
    let bestScore = 0;
    
    // Find best matching existing cluster
    for (const [clusterId, cluster] of clusters) {
      const articleTags = new Set(article.tags || []);
      const clusterTags = cluster.tags;
      
      const jaccard = jaccardSimilarity(articleTags, clusterTags);
      
      if (jaccard >= JACCARD_THRESHOLD && jaccard > bestScore) {
        bestCluster = cluster;
        bestScore = jaccard;
      }
    }
    
    if (bestCluster) {
      // Add to existing cluster
      bestCluster.articles.push(article);
      // Update cluster tags (union)
      for (const tag of article.tags || []) {
        bestCluster.tags.add(tag);
      }
      assigned.add(article.id);
      await updateArticle(article.id, { clusterId: bestCluster.id });
    } else {
      // Create new cluster
      const clusterId = generateClusterId(article.tags || []);
      const newCluster = {
        id: clusterId,
        tags: new Set(article.tags || []),
        articles: [article],
      };
      clusters.set(clusterId, newCluster);
      assigned.add(article.id);
      await updateArticle(article.id, { clusterId });
    }
  }
  
  // Check for cluster merges based on article-to-article similarity
  const clusterArray = Array.from(clusters.values());
  for (let i = 0; i < clusterArray.length; i++) {
    for (let j = i + 1; j < clusterArray.length; j++) {
      const clusterA = clusterArray[i];
      const clusterB = clusterArray[j];
      
      // Check if any articles across clusters are similar
      let shouldMerge = false;
      for (const artA of clusterA.articles) {
        for (const artB of clusterB.articles) {
          const sim = calculateSimilarity(artA, artB);
          if (sim >= JACCARD_THRESHOLD) {
            shouldMerge = true;
            break;
          }
        }
        if (shouldMerge) break;
      }
      
      if (shouldMerge) {
        // Merge B into A
        for (const article of clusterB.articles) {
          clusterA.articles.push(article);
          await updateArticle(article.id, { clusterId: clusterA.id });
        }
        for (const tag of clusterB.tags) {
          clusterA.tags.add(tag);
        }
        clusters.delete(clusterB.id);
        clusterArray.splice(j, 1);
        j--;
      }
    }
  }
  
  // Format result
  const resultClusters = Array.from(clusters.values()).map(c => ({
    id: c.id,
    name: generateClusterName(c.tags, c.articles.length),
    articleCount: c.articles.length,
    tags: Array.from(c.tags),
    articles: c.articles.map(a => a.id),
  }));
  
  const unclustered = classifiedArticles.length - assigned.size;
  
  return { clusters: resultClusters, unclustered };
}

/**
 * Generate a human-readable cluster name from tags
 * @param {Set} tags
 * @param {number} count
 * @returns {string}
 */
function generateClusterName(tags, count) {
  const tagArray = Array.from(tags);
  // Sort by relevance - shorter, more specific tags first
  tagArray.sort((a, b) => a.length - b.length);
  
  // Take top 3 tags for the name
  const topTags = tagArray.slice(0, 3);
  return topTags.join(" / ");
}

/**
 * Get ISO week string from date
 * @param {Date} date
 * @returns {string} "2026-W14"
 */
function getWeekString(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
}

/**
 * Get trend timeline for a specific tag
 * @param {string} tag
 * @param {number} days
 * @returns {TrendPoint[]}
 */
export function getTrendTimeline(tag, days = 84) {
  return new Promise(async (resolve) => {
    const articles = await getAllArticles();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const filtered = articles.filter(a => {
      if (!a.tags?.includes(tag)) return false;
      const pubDate = new Date(a.published);
      return pubDate >= cutoffDate;
    });
    
    // Group by week
    const weekCounts = new Map();
    for (const article of filtered) {
      const week = getWeekString(new Date(article.published));
      weekCounts.set(week, (weekCounts.get(week) || 0) + 1);
    }
    
    // Fill in missing weeks with 0
    const result = [];
    const now = new Date();
    for (let i = 0; i < Math.ceil(days / 7); i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const week = getWeekString(d);
      result.unshift({
        week,
        count: weekCounts.get(week) || 0,
      });
    }
    
    resolve(result);
  });
}

/**
 * Get buzzing topics (trending tags)
 * @param {number} days
 * @returns {BuzzTopic[]}
 */
export function getBuzzingTopics(days = 30) {
  return new Promise(async (resolve) => {
    const articles = await getAllArticles();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const recentArticles = articles.filter(a => {
      const pubDate = new Date(a.published);
      return pubDate >= cutoffDate && a.tags;
    });
    
    // Count all tags
    const tagCounts = new Map();
    for (const article of recentArticles) {
      for (const tag of article.tags || []) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    
    if (tagCounts.size === 0) {
      resolve([]);
      return;
    }
    
    // Calculate average
    const counts = Array.from(tagCounts.values());
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    
    // Compare with previous period for trend
    const prevCutoff = new Date();
    prevCutoff.setDate(prevCutoff.getDate() - days * 2);
    const prevArticles = articles.filter(a => {
      const pubDate = new Date(a.published);
      return pubDate >= prevCutoff && pubDate < cutoffDate && a.tags;
    });
    
    const prevTagCounts = new Map();
    for (const article of prevArticles) {
      for (const tag of article.tags || []) {
        prevTagCounts.set(tag, (prevTagCounts.get(tag) || 0) + 1);
      }
    }
    
    // Build result with trend indicator
    const result = [];
    for (const [tag, count] of tagCounts) {
      const prevCount = prevTagCounts.get(tag) || 0;
      let trend = "stable";
      
      if (count > avg * 2 && count > prevCount * 1.5) {
        trend = "rising";
      } else if (count < prevCount * 0.5) {
        trend = "falling";
      }
      
      result.push({ tag, count, trend });
    }
    
    // Sort by count descending
    result.sort((a, b) => b.count - a.count);
    
    resolve(result);
  });
}

export default {
  clusterArticles,
  getTrendTimeline,
  getBuzzingTopics,
};
