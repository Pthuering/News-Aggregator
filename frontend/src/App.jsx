/**
 * @module App
 * @purpose Main application shell for Trend Radar with feed ingest, classification,
 *          project management, synergy matching, and keyword intelligence
 */

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { initDB, getAllArticles, getUnclassifiedArticles, updateArticle } from "./stores/articleStore.js";
import { fetchAllFeeds } from "./services/feedService.js";
import { classifyNew, deepClassify } from "./services/classifyService.js";
import { matchNewArticles } from "./services/matchService.js";
import { clusterArticles } from "./services/clusterService.js";
import { selectSignificantArticles, checkMinimumArticles, generateAutoReport } from "./services/autoReportService.js";
import { downloadReport, copyReportToClipboard } from "./services/reportService.js";
import { getProjects } from "./stores/projectStore.js";
import Settings from "./components/Settings.jsx";
import FilterBar, { INITIAL_FILTERS } from "./components/FilterBar.jsx";
import ArticleDetail from "./components/ArticleDetail.jsx";
import ReportGenerator from "./components/ReportGenerator.jsx";
import ProjectManager from "./components/ProjectManager.jsx";
import KeywordOverview from "./components/KeywordOverview.jsx";
import Dashboard from "./components/Dashboard.jsx";
import DataManager from "./components/DataManager.jsx";
import FeedManager from "./components/FeedManager.jsx";
import OpenSearch from "./components/OpenSearch.jsx";
import PromptManager from "./components/PromptManager.jsx";
import { initSources } from "./stores/sourceStore.js";

function App() {
  const [articles, setArticles] = useState([]);
  const [unclassifiedCount, setUnclassifiedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [classifyProgress, setClassifyProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState(null);
  const [classifyResult, setClassifyResult] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [selectedArticleIds, setSelectedArticleIds] = useState([]);
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  const [activeTab, setActiveTab] = useState("articles"); // "articles" | "projects" | "keywords" | "data"
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchProgress, setMatchProgress] = useState({ current: 0, total: 0, skipped: 0 });
  const [matchResult, setMatchResult] = useState(null);
  const [clusterResult, setClusterResult] = useState(null);
  const [clusterLoading, setClusterLoading] = useState(false);
  const [projectCount, setProjectCount] = useState(0);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  const [logMessages, setLogMessages] = useState([]);
  const logRef = useRef(null);
  const [autoReportPreview, setAutoReportPreview] = useState(null); // { significantArticles, totalClassified }
  const [autoReport, setAutoReport] = useState(null); // generated markdown text
  const [autoReportLoading, setAutoReportLoading] = useState(false);
  const [autoReportError, setAutoReportError] = useState(null);
  const [autoReportCopied, setAutoReportCopied] = useState(false);

  const addLog = useCallback((type, message) => {
    const entry = { type, message, time: new Date().toLocaleTimeString("de-DE") };
    setLogMessages(prev => [...prev, entry]);
  }, []);

  // Auto-scroll log panel
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logMessages]);

  // Initialize DB and check API key on mount
  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    await initDB();
    await initSources();
    await loadArticles();
    await loadProjectCount();
    setInitialized(true);
  };

  // Load articles from store
  const loadArticles = async () => {
    const all = await getAllArticles();
    // Sort by date descending (newest first), unclassified last
    all.sort((a, b) => {
      if (a.scores && !b.scores) return -1;
      if (!a.scores && b.scores) return 1;
      return new Date(b.published) - new Date(a.published);
    });
    setArticles(all);

    // Count unclassified
    const unclassified = await getUnclassifiedArticles();
    setUnclassifiedCount(unclassified.length);

    // Count unmatched (have scores but no synergies)
    const unmatched = all.filter(a => a.scores && a.synergies === undefined);
    setUnmatchedCount(unmatched.length);
  };



  // Load project count
  const loadProjectCount = async () => {
    const projects = await getProjects();
    setProjectCount(projects.length);
  };

  // Handle feed update button
  const handleFetchFeeds = async () => {
    setLoading(true);
    setResult(null);
    addLog("info", "🔄 Feeds werden aktualisiert...");

    try {
      const ingestResult = await fetchAllFeeds();
      setResult(ingestResult);
      addLog("success", `✅ Feeds: ${ingestResult.newCount} neue Artikel geladen`);
      if (ingestResult.errors.length > 0) {
        ingestResult.errors.forEach(err => {
          addLog("error", `❌ Feed ${err.source}: ${err.error}`);
        });
      }
      await loadArticles();
    } catch (error) {
      setResult({
        newCount: 0,
        skipped: 0,
        errors: [{ source: "Allgemein", error: error.message }],
      });
      addLog("error", `❌ Feed-Fehler: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle classification button
  const handleClassify = async () => {
    if (unclassifiedCount === 0) return;

    setClassifyLoading(true);
    setClassifyResult(null);
    setClassifyProgress({ current: 0, total: unclassifiedCount });
    addLog("info", `🔄 Klassifikation gestartet (${unclassifiedCount} Artikel)...`);

    try {
      // Pass 1: Quick classify from RSS snippets
      const result = await classifyNew((progress) => {
        setClassifyProgress(progress);
      });
      
      addLog("success", `✅ Vorklassifikation: ${result.classified} klassifiziert, ${result.failed} fehlgeschlagen`);
      
      // Log short-content articles
      if (result.details) {
        const emptyArticles = result.details.filter(d => d.contentLength === 0);
        if (emptyArticles.length > 0) {
          addLog("warn", `⚠️ ${emptyArticles.length} Artikel ohne Inhalt (0 Zeichen):`);
          emptyArticles.forEach(d => {
            addLog("detail", `   "${d.title?.substring(0, 60)}..." — 0 Zeichen`);
          });
        }
        const failedDetails = result.details.filter(d => !d.success);
        if (failedDetails.length > 0) {
          addLog("warn", `⚠️ ${failedDetails.length} fehlgeschlagene Artikel:`);
          failedDetails.forEach(d => {
            addLog("detail", `   "${d.title?.substring(0, 60)}..." — ${d.error}`);
          });
        }
      }
      
      // Pass 2: Deep classify high-scoring articles with full text
      addLog("info", "🔄 Tiefenanalyse gestartet (Score ≥ 5)...");
      setClassifyProgress({ current: 0, total: 0 });
      const deepResult = await deepClassify((progress) => {
        setClassifyProgress({ current: progress.current, total: progress.total, phase: "deep" });
      });
      
      addLog("success", `✅ Tiefenanalyse: ${deepResult.deepClassified} analysiert, ${deepResult.failed} fehlgeschlagen, ${deepResult.skipped} übersprungen`);
      
      // Log deep classify details
      if (deepResult.details) {
        const fetchFailed = deepResult.details.filter(d => !d.success && d.error?.startsWith("Fetch"));
        const tooShort = deepResult.details.filter(d => !d.success && d.contentLength !== undefined && d.contentLength < 100);
        if (fetchFailed.length > 0) {
          addLog("warn", `⚠️ ${fetchFailed.length} Artikel konnten nicht geladen werden:`);
          fetchFailed.forEach(d => {
            addLog("detail", `   "${d.title?.substring(0, 60)}..." — ${d.error}`);
          });
        }
        if (tooShort.length > 0) {
          addLog("warn", `⚠️ ${tooShort.length} Artikel mit zu wenig extrahiertem Text:`);
          tooShort.forEach(d => {
            addLog("detail", `   "${d.title?.substring(0, 60)}..." — ${d.contentLength} Zeichen`);
          });
        }
        const deepSuccess = deepResult.details.filter(d => d.success);
        if (deepSuccess.length > 0) {
          addLog("info", `📊 Tiefenanalyse-Details:`);
          deepSuccess.forEach(d => {
            addLog("detail", `   "${d.title?.substring(0, 60)}..." — ${d.contentLength} Zeichen`);
          });
        }
      }
      
      setClassifyResult({
        ...result,
        deepClassified: deepResult.deepClassified,
        deepFailed: deepResult.failed,
        deepSkipped: deepResult.skipped,
      });
      await loadArticles();
    } catch (error) {
      setClassifyResult({
        classified: 0,
        failed: unclassifiedCount,
        errors: [error.message],
      });
      addLog("error", `❌ Klassifikation fehlgeschlagen: ${error.message}`);
    } finally {
      setClassifyLoading(false);
      setClassifyProgress({ current: 0, total: 0 });
    }
  };

  // Handle synergy matching button
  const handleMatch = async () => {
    if (projectCount === 0 || unmatchedCount === 0) return;

    setMatchLoading(true);
    setMatchResult(null);
    setMatchProgress({ current: 0, total: 0, skipped: 0 });
    addLog("info", `🔄 Synergy-Matching gestartet (${unmatchedCount} Artikel)...`);

    try {
      const result = await matchNewArticles((progress) => {
        setMatchProgress(progress);
      });
      setMatchResult(result);
      addLog("success", `✅ Matching: ${result.matched} Synergien gefunden, ${result.skipped} übersprungen`);
      if (result.errors?.length > 0) {
        result.errors.forEach(e => addLog("error", `❌ Match-Fehler: ${e}`));
      }
      await loadArticles();
    } catch (error) {
      setMatchResult({
        matched: 0,
        synergiesFound: 0,
        skipped: 0,
        errors: [error.message],
      });
      addLog("error", `❌ Matching fehlgeschlagen: ${error.message}`);
    } finally {
      setMatchLoading(false);
      setMatchProgress({ current: 0, total: 0, skipped: 0 });
    }
  };

  // Handle clustering
  const handleCluster = async () => {
    setClusterLoading(true);
    setClusterResult(null);
    addLog("info", "🔄 Clustering gestartet...");
    try {
      const result = await clusterArticles();
      setClusterResult(result);
      addLog("success", `✅ Clustering: ${result.clusters.length} Cluster erkannt, ${result.unclustered} nicht zugeordnet`);
      await loadArticles();
    } catch (error) {
      setClusterResult({ clusters: [], unclustered: 0, error: error.message });
      addLog("error", `❌ Clustering fehlgeschlagen: ${error.message}`);
    } finally {
      setClusterLoading(false);
    }
  };

  // Handle auto-report: select significant articles and show preview
  const handleAutoReport = () => {
    const { significantArticles, totalClassified, totalDeep } = selectSignificantArticles(articles);
    const check = checkMinimumArticles(significantArticles);
    
    if (!check.sufficient) {
      setAutoReportPreview({ significantArticles, totalClassified, totalDeep, warning: check.message });
    } else {
      setAutoReportPreview({ significantArticles, totalClassified, totalDeep, warning: null });
    }
  };

  // Launch auto-report generation directly with streaming
  const handleAutoReportGenerate = async () => {
    const items = autoReportPreview.significantArticles;
    setAutoReportPreview(null);
    setAutoReport("");
    setAutoReportLoading(true);
    setAutoReportError(null);

    try {
      const result = await generateAutoReport(items, (text) => {
        setAutoReport(text);
      });
      setAutoReport(result);
    } catch (err) {
      setAutoReportError(err.message || "Auto-Report fehlgeschlagen");
    } finally {
      setAutoReportLoading(false);
    }
  };

  // Download auto-report
  const handleAutoReportDownload = () => {
    if (!autoReport) return;
    const filename = `trend-radar-auto-report-${new Date().toISOString().split('T')[0]}.md`;
    downloadReport(autoReport, filename);
  };

  // Copy auto-report
  const handleAutoReportCopy = async () => {
    if (!autoReport) return;
    const ok = await copyReportToClipboard(autoReport);
    if (ok) {
      setAutoReportCopied(true);
      setTimeout(() => setAutoReportCopied(false), 2000);
    }
  };

  // Handle full pipeline: feeds → classify → match → cluster
  const handleFullRun = async () => {
    // Step 1: Feeds
    setLoading(true);
    setResult(null);
    setClassifyResult(null);
    setMatchResult(null);
    setClusterResult(null);
    setLogMessages([]);
    addLog("info", "🚀 Komplett-Durchlauf gestartet...");

    try {
      const feedResult = await fetchAllFeeds();
      setResult(feedResult);
      addLog("success", `✅ Feeds: ${feedResult.newCount} neue Artikel`);
      if (feedResult.errors.length > 0) {
        feedResult.errors.forEach(err => addLog("error", `❌ Feed ${err.source}: ${err.error}`));
      }
      await loadArticles();
    } catch (error) {
      setResult({ newCount: 0, skipped: 0, errors: [{ source: "Allgemein", error: error.message }] });
      addLog("error", `❌ Feed-Fehler: ${error.message}`);
      setLoading(false);
      return;
    }
    setLoading(false);

    // Step 2: Classify (if there's anything to classify and API key is set)
    const unclassified = await getUnclassifiedArticles();
    if (unclassified.length > 0) {
      setClassifyLoading(true);
      setClassifyProgress({ current: 0, total: unclassified.length });
      addLog("info", `🔄 Klassifikation (${unclassified.length} Artikel)...`);
      try {
        const cResult = await classifyNew((progress) => setClassifyProgress(progress));
        addLog("success", `✅ Vorklassifikation: ${cResult.classified} ok, ${cResult.failed} fehlgeschlagen`);
        
        // Log short-content and failed from first pass
        if (cResult.details) {
          const emptyArticles = cResult.details.filter(d => d.contentLength === 0);
          if (emptyArticles.length > 0) {
            addLog("warn", `⚠️ ${emptyArticles.length} Artikel ohne Inhalt (0 Zeichen):`);
            emptyArticles.forEach(d => addLog("detail", `   "${d.title?.substring(0, 60)}..." — 0 Zeichen`));
          }
          const failedDetails = cResult.details.filter(d => !d.success);
          if (failedDetails.length > 0) {
            addLog("warn", `⚠️ ${failedDetails.length} fehlgeschlagene Artikel:`);
            failedDetails.forEach(d => addLog("detail", `   "${d.title?.substring(0, 60)}..." — ${d.error}`));
          }
        }
        
        // Deep classify
        addLog("info", "🔄 Tiefenanalyse (Score ≥ 5)...");
        setClassifyProgress({ current: 0, total: 0 });
        const deepResult = await deepClassify((progress) => {
          setClassifyProgress({ current: progress.current, total: progress.total, phase: "deep" });
        });
        
        addLog("success", `✅ Tiefenanalyse: ${deepResult.deepClassified} analysiert, ${deepResult.failed} fehlgeschlagen`);
        if (deepResult.details) {
          const fetchFailed = deepResult.details.filter(d => !d.success && d.error?.startsWith("Fetch"));
          if (fetchFailed.length > 0) {
            addLog("warn", `⚠️ ${fetchFailed.length} Artikel nicht ladbar:`);
            fetchFailed.forEach(d => addLog("detail", `   "${d.title?.substring(0, 60)}..." — ${d.error}`));
          }
          const tooShort = deepResult.details.filter(d => !d.success && d.contentLength !== undefined && d.contentLength < 100);
          if (tooShort.length > 0) {
            addLog("warn", `⚠️ ${tooShort.length} Artikel mit zu wenig Text:`);
            tooShort.forEach(d => addLog("detail", `   "${d.title?.substring(0, 60)}..." — ${d.contentLength} Zeichen`));
          }
        }
        
        setClassifyResult({
          ...cResult,
          deepClassified: deepResult.deepClassified,
          deepFailed: deepResult.failed,
          deepSkipped: deepResult.skipped,
        });
        await loadArticles();
      } catch (error) {
        setClassifyResult({ classified: 0, failed: unclassified.length, errors: [error.message] });
        addLog("error", `❌ Klassifikation: ${error.message}`);
      }
      setClassifyLoading(false);
      setClassifyProgress({ current: 0, total: 0 });
    }

    // Step 3: Match (if projects exist and unmatched articles)
    const allAfterClassify = await getAllArticles();
    const unmatchedAfter = allAfterClassify.filter(a => a.scores && a.synergies === undefined);
    const projectsNow = await getProjects();
    if (projectsNow.length > 0 && unmatchedAfter.length > 0) {
      setMatchLoading(true);
      setMatchProgress({ current: 0, total: 0, skipped: 0 });
      addLog("info", `🔄 Matching (${unmatchedAfter.length} Artikel, ${projectsNow.length} Projekte)...`);
      try {
        const mResult = await matchNewArticles((progress) => setMatchProgress(progress));
        setMatchResult(mResult);
        addLog("success", `✅ Matching: ${mResult.matched} Synergien, ${mResult.skipped} übersprungen`);
        if (mResult.errors?.length > 0) {
          mResult.errors.forEach(e => addLog("error", `❌ ${e}`));
        }
        await loadArticles();
      } catch (error) {
        setMatchResult({ matched: 0, synergiesFound: 0, skipped: 0, errors: [error.message] });
        addLog("error", `❌ Matching: ${error.message}`);
      }
      setMatchLoading(false);
      setMatchProgress({ current: 0, total: 0, skipped: 0 });
    }

    // Step 4: Cluster
    setClusterLoading(true);
    addLog("info", "🔄 Clustering...");
    try {
      const clResult = await clusterArticles();
      setClusterResult(clResult);
      addLog("success", `✅ Clustering: ${clResult.clusters.length} Cluster, ${clResult.unclustered} nicht zugeordnet`);
      await loadArticles();
    } catch (error) {
      addLog("error", `❌ Clustering: ${error.message}`);
    }
    setClusterLoading(false);
    addLog("success", "🏁 Komplett-Durchlauf abgeschlossen");
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get score color
  const getScoreColor = (score) => {
    if (score <= 3) return "bg-gray-100 text-gray-700";
    if (score <= 6) return "bg-yellow-100 text-yellow-800";
    return "bg-green-100 text-green-800";
  };

  // Collect unique tags from all articles
  const availableTags = useMemo(() => {
    const tagSet = new Set();
    articles.forEach((a) => {
      if (a.tags) a.tags.forEach((t) => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }, [articles]);

  // Bookmark toggle handler for list items
  const handleBookmarkToggle = async (e, article) => {
    e.stopPropagation();
    e.preventDefault();
    const updated = { ...article, bookmarked: !article.bookmarked };
    await updateArticle(article.id, { bookmarked: updated.bookmarked });
    // Update local state
    setArticles(prev => prev.map(a => a.id === article.id ? updated : a));
  };

  // Filter + sort logic driven by FilterBar state
  const filteredArticles = useMemo(() => {
    let result = [...articles];

    // Text search
    if (filters.search) {
      const lower = filters.search.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(lower) ||
          (a.content && a.content.toLowerCase().includes(lower)) ||
          (a.summary_de && a.summary_de.toLowerCase().includes(lower)) ||
          (a.tags && a.tags.some((t) => t.toLowerCase().includes(lower)))
      );
    }

    // Category filter
    if (filters.category !== "all") {
      result = result.filter((a) => a.sourceCategory === filters.category);
    }

    // Classified only
    if (filters.classifiedOnly) {
      result = result.filter((a) => a.classifiedAt && a.scores);
    }

    // Bookmarked only (only filter if explicitly enabled and there are bookmarked articles)
    if (filters.bookmarkedOnly) {
      result = result.filter((a) => a.bookmarked === true);
    }

    // Synergies only
    if (filters.synergiesOnly) {
      result = result.filter((a) => a.synergies && a.synergies.length > 0);
    }

    // Project filter (filter by specific project synergy)
    if (filters.project && filters.project !== "all") {
      result = result.filter((a) => 
        a.synergies?.some((s) => s.projectId === filters.project)
      );
    }

    // Cluster filter
    if (filters.clusterId) {
      result = result.filter((a) => a.clusterId === filters.clusterId);
    }

    // Per-lens score ranges
    if (filters.scores) {
      result = result.filter((a) => {
        if (!a.scores) return true; // don't hide unscored articles via score filter
        return Object.entries(filters.scores).every(([lens, { min, max }]) => {
          const val = a.scores[lens];
          if (val === undefined) return true;
          return val >= min && val <= max;
        });
      });
    }

    // Tag filter
    if (filters.tags && filters.tags.length > 0) {
      result = result.filter((a) => {
        if (!a.tags || a.tags.length === 0) return false;
        if (filters.tagMatch === "all") {
          return filters.tags.every((t) => a.tags.includes(t));
        }
        return filters.tags.some((t) => a.tags.includes(t));
      });
    }

    // Date range
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      result = result.filter((a) => new Date(a.published) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((a) => new Date(a.published) <= to);
    }

    // Sorting
    const sortBy = filters.sortBy || "newest";
    result.sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return new Date(a.published) - new Date(b.published);
        case "relevance": {
          const sumA = a.scores ? Object.values(a.scores).reduce((s, v) => s + v, 0) : 0;
          const sumB = b.scores ? Object.values(b.scores).reduce((s, v) => s + v, 0) : 0;
          return sumB - sumA;
        }
        case "score_oepnv":
          return (b.scores?.oepnv_direkt || 0) - (a.scores?.oepnv_direkt || 0);
        case "score_tech":
          return (b.scores?.tech_transfer || 0) - (a.scores?.tech_transfer || 0);
        case "score_foerder":
          return (b.scores?.foerder || 0) - (a.scores?.foerder || 0);
        case "score_markt":
          return (b.scores?.markt || 0) - (a.scores?.markt || 0);
        default: // newest
          return new Date(b.published) - new Date(a.published);
      }
    });

    return result;
  }, [articles, filters]);

  // Article counts for FilterBar
  const articleCounts = useMemo(() => ({
    total: articles.length,
    filtered: filteredArticles.length,
    unclassified: articles.filter(a => !a.scores).length,
  }), [articles, filteredArticles.length]);

  // Handle article click - open detail view
  const handleArticleClick = (article) => {
    setSelectedArticle(article);
    window.scrollTo(0, 0);
  };

  // Handle back from detail view
  const handleBackToList = () => {
    setSelectedArticle(null);
  };

  // Handle article update from detail view
  const handleArticleUpdate = (updated) => {
    setArticles(prev => prev.map(a => a.id === updated.id ? updated : a));
    setSelectedArticle(updated);
  };

  // Toggle article selection for report
  const handleToggleSelection = (e, articleId) => {
    e.stopPropagation();
    setSelectedArticleIds(prev => 
      prev.includes(articleId)
        ? prev.filter(id => id !== articleId)
        : [...prev, articleId]
    );
  };

  // Clear selection when opening report generator
  const handleOpenReportGenerator = () => {
    setShowReportGenerator(true);
  };

  // Close report generator and optionally clear selection
  const handleCloseReportGenerator = () => {
    setShowReportGenerator(false);
    setSelectedArticleIds([]);

  };

  if (!initialized) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Initialisiere...</div>
      </div>
    );
  }

  // Detail view
  if (selectedArticle) {
    return (
      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleBackToList}
                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  ← Zurück
                </button>
                <h1 className="text-xl font-bold text-gray-900">Artikel-Detail</h1>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                Einstellungen
              </button>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ArticleDetail
            article={selectedArticle}
            onClose={handleBackToList}
            onUpdate={handleArticleUpdate}
          />
        </main>

        {/* Settings Modal */}
        {showSettings && (
          <div 
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ 
              zIndex: 9999, 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)'
            }}
            onClick={() => setShowSettings(false)}
          >
            <div 
              className="bg-white rounded-lg shadow-2xl w-full"
              style={{ maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <Settings onClose={() => { setShowSettings(false); }} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <h1 className="text-2xl font-bold text-gray-900">Trend Radar</h1>
              {/* Tab Navigation */}
              <nav className="flex gap-1">
                {[
                  { id: "dashboard", label: "Dashboard" },
                  { id: "articles", label: "Artikel" },
                  { id: "projects", label: "Projekte" },
                  { id: "keywords", label: "Keywords" },
                  { id: "search", label: "Recherche" },
                  { id: "sources", label: "Quellen" },
                  { id: "prompts", label: "Prompts" },
                  { id: "data", label: "Daten" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={activeTab === tab.id ? { backgroundColor: '#2563eb', color: '#fff' } : { backgroundColor: '#f3f4f6', color: '#374151' }}
                    className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
            <button
              onClick={() => {
                console.log("Settings clicked");
                setShowSettings(true);
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Einstellungen
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* === PROJECTS TAB === */}
        {activeTab === "projects" && (
          <ProjectManager onClose={() => { setActiveTab("articles"); loadProjectCount(); }} />
        )}

        {/* === DASHBOARD TAB === */}
        {activeTab === "dashboard" && (
          <Dashboard
            articles={articles}
            onNavigate={(nav) => {
              if (nav.type === "tag") {
                setFilters((prev) => ({ ...prev, tags: [nav.value], tagMatch: "any" }));
                setActiveTab("articles");
              } else if (nav.type === "cluster") {
                setFilters((prev) => ({ ...prev, clusterId: nav.value }));
                setActiveTab("articles");
              } else if (nav.type === "project") {
                setFilters((prev) => ({ ...prev, project: nav.value, synergiesOnly: true }));
                setActiveTab("articles");
              }
            }}
          />
        )}

        {/* === KEYWORDS TAB === */}
        {activeTab === "keywords" && (
          <KeywordOverview
            articles={articles}
            onArticleClick={handleArticleClick}
          />
        )}

        {/* === SOURCES TAB === */}
        {activeTab === "sources" && (
          <FeedManager />
        )}

        {/* === SEARCH TAB === */}
        {activeTab === "search" && (
          <OpenSearch />
        )}

        {/* === DATA TAB === */}
        {activeTab === "data" && (
          <DataManager
            onDataChange={loadArticles}
          />
        )}

        {/* === PROMPTS TAB === */}
        {activeTab === "prompts" && (
          <PromptManager />
        )}

        {/* === ARTICLES TAB === */}
        {activeTab === "articles" && (<>
        {/* Action buttons + Filter Bar */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleFetchFeeds}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Lädt..." : "Feeds aktualisieren"}
            </button>

            <button
              onClick={handleClassify}
              disabled={classifyLoading || unclassifiedCount === 0}
              title={
                unclassifiedCount === 0
                  ? "Keine unklassifizierten Artikel"
                  : ""
              }
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {classifyLoading
                ? classifyProgress.phase === "deep"
                  ? `Tiefenanalyse... (${classifyProgress.current}/${classifyProgress.total})`
                  : `Klassifiziere... (${classifyProgress.current}/${classifyProgress.total})`
                : `Klassifizieren (${unclassifiedCount})`}
            </button>

            <button
              onClick={handleMatch}
              disabled={matchLoading || projectCount === 0 || unmatchedCount === 0}
              title={
                projectCount === 0
                  ? "Erst Projekte anlegen (Tab 'Projekte')"
                  : unmatchedCount === 0
                  ? "Keine ungematchten Artikel"
                  : ""
              }
              style={matchLoading ? {} : { backgroundColor: '#0d9488' }}
              className="px-4 py-2 text-white rounded-md hover:opacity-90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {matchLoading
                ? `Synergien... (${matchProgress.current}/${matchProgress.total})`
                : `Synergien prüfen (${unmatchedCount})`}
            </button>

            <button
              onClick={handleCluster}
              disabled={clusterLoading || articles.filter(a => a.tags).length === 0}
              title={articles.filter(a => a.tags).length === 0 ? "Erst Artikel klassifizieren" : "Ähnliche Artikel gruppieren"}
              style={clusterLoading ? {} : { backgroundColor: '#d97706' }}
              className="px-4 py-2 text-white rounded-md hover:opacity-90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {clusterLoading ? "Clustere..." : "Clustern"}
            </button>

            <button
              onClick={handleOpenReportGenerator}
              disabled={selectedArticleIds.length === 0}
              title={selectedArticleIds.length === 0 ? "Erst Artikel per Checkbox auswählen" : ""}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
            >
              Report erstellen{selectedArticleIds.length > 0 ? ` (${selectedArticleIds.length})` : ""}
            </button>

            <button
              onClick={handleAutoReport}
              disabled={articles.filter(a => a.scores).length === 0}
              title={articles.filter(a => a.scores).length === 0 ? "Keine klassifizierten Artikel vorhanden" : "Signifikanteste Artikel automatisch auswählen und Report erstellen"}
              className={
                `px-4 py-2 rounded-md transition-colors text-white ` +
                (articles.filter(a => a.scores).length === 0
                  ? "bg-green-300 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700 cursor-pointer")
              }
            >
              Auto-Report
            </button>

            <button
              onClick={handleFullRun}
              disabled={loading || classifyLoading || matchLoading || clusterLoading}
              title="Feeds aktualisieren → Klassifizieren → Synergien prüfen → Clustern"
              style={loading || classifyLoading || matchLoading || clusterLoading ? {} : { backgroundColor: '#7c3aed' }}
              className="px-4 py-2 text-white rounded-md hover:opacity-90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading || classifyLoading || matchLoading || clusterLoading ? "Läuft..." : "Komplett-Durchlauf"}
            </button>
          </div>

          {/* FilterBar */}
          <FilterBar
            filters={{ ...filters, articleCounts }}
            onFilterChange={setFilters}
            availableTags={availableTags}
            className="mt-4 shadow-sm"
          />
        </div>

        {/* Unified Log Panel */}
        {logMessages.length > 0 && (
          <div className="mb-4 bg-gray-900 rounded-lg shadow overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
              <span className="text-xs font-mono text-gray-400">Protokoll</span>
              <button
                onClick={() => setLogMessages([])}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Löschen
              </button>
            </div>
            <div
              ref={logRef}
              className="px-4 py-3 max-h-64 overflow-y-auto font-mono text-xs leading-relaxed space-y-0.5"
            >
              {logMessages.map((entry, idx) => (
                <div
                  key={idx}
                  className={
                    entry.type === "error" ? "text-red-400" :
                    entry.type === "warn" ? "text-yellow-400" :
                    entry.type === "success" ? "text-green-400" :
                    entry.type === "detail" ? "text-gray-500" :
                    "text-gray-300"
                  }
                >
                  <span className="text-gray-600 mr-2">{entry.time}</span>
                  {entry.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Article list */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              Artikel ({filteredArticles.length})
              {filteredArticles.length !== articles.length && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  von {articles.length}
                </span>
              )}
              {unclassifiedCount > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({unclassifiedCount} unklassifiziert)
                </span>
              )}
            </h2>
          </div>

          {filteredArticles.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Noch keine Artikel. Klicke "Feeds aktualisieren" um zu starten.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {filteredArticles.map((article) => (
                <li
                  key={article.id}
                  onClick={() => handleArticleClick(article)}
                  className={`p-4 hover:bg-gray-50 cursor-pointer ${
                    !article.scores ? "opacity-70" : ""
                  }`}
                >
                  <div className="block">
                    {/* Title + Selection + Bookmark */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedArticleIds.includes(article.id)}
                          onChange={(e) => handleToggleSelection(e, article.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="text-sm font-medium text-blue-600 hover:text-blue-800">
                          {article.title}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleBookmarkToggle(e, article)}
                        className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                          article.bookmarked ? 'text-yellow-500' : 'text-gray-300'
                        }`}
                        title={article.bookmarked ? "Lesezeichen entfernen" : "Lesezeichen setzen"}
                      >
                        <span className="text-lg">★</span>
                      </button>
                    </div>

                    {/* Meta info */}
                    <div className="mt-1 text-sm text-gray-500">
                      {article.source} · {formatDate(article.published)}
                      {!article.scores && (
                        <span className="ml-2 text-gray-400">(unklassifiziert)</span>
                      )}
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="ml-2 text-blue-500 hover:text-blue-700"
                        title="Original öffnen"
                      >
                        ↗
                      </a>
                    </div>

                    {/* Summary */}
                    {article.summary_de && (
                      <div className="mt-2 text-sm text-gray-600 line-clamp-2">
                        {article.summary_de}
                      </div>
                    )}

                    {/* Deadline Banner */}
                    {article.deadline && article.deadline.date && (() => {
                      const days = Math.ceil((new Date(article.deadline.date) - new Date()) / 86400000);
                      if (days < -30) return null; // hide long-past deadlines
                      const color = days < 0 ? "bg-gray-100 text-gray-500 border-gray-300"
                        : days <= 30 ? "bg-red-50 text-red-700 border-red-300"
                        : days <= 60 ? "bg-orange-50 text-orange-700 border-orange-300"
                        : "bg-green-50 text-green-700 border-green-300";
                      return (
                        <div className={`mt-2 px-3 py-1.5 rounded border text-xs font-medium ${color}`}>
                          ⏰ Frist: {new Date(article.deadline.date).toLocaleDateString("de-DE")}
                          {days >= 0 ? ` (${days} Tage)` : " (abgelaufen)"}
                          {article.deadline.label && ` – ${article.deadline.label}`}
                        </div>
                      );
                    })()}

                    {/* Tags */}
                    {article.tags && article.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {article.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Score badges */}
                    {article.scores && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${getScoreColor(
                            article.scores.oepnv_direkt
                          )}`}
                        >
                          ÖV: {article.scores.oepnv_direkt}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${getScoreColor(
                            article.scores.tech_transfer
                          )}`}
                        >
                          TT: {article.scores.tech_transfer}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${getScoreColor(
                            article.scores.foerder
                          )}`}
                        >
                          FÖ: {article.scores.foerder}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${getScoreColor(
                            article.scores.markt
                          )}`}
                        >
                          MA: {article.scores.markt}
                        </span>
                        {/* Synergy badge */}
                        {article.synergies && article.synergies.length > 0 && (
                          <span
                            className="px-2 py-0.5 text-xs rounded-full"
                            style={{ backgroundColor: '#ccfbf1', color: '#0d9488' }}
                            title={article.synergies.map(s => `${s.projectId}: ${s.score}/10`).join(', ')}
                          >
                            🔗 {article.synergies.length}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        </>)}
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ 
            zIndex: 9999, 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)'
          }}
          onClick={() => setShowSettings(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-2xl w-full"
            style={{ maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <Settings onClose={() => { setShowSettings(false); }} />
          </div>
        </div>
      )}

      {/* Auto-Report Preview Dialog */}
      {autoReportPreview && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{
            zIndex: 9999,
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)'
          }}
          onClick={() => setAutoReportPreview(null)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl w-full flex flex-col"
            style={{ maxWidth: '700px', maxHeight: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Auto-Report Vorschau</h2>
              <button
                onClick={() => setAutoReportPreview(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-5 space-y-4">
              <div className="text-sm text-gray-600">
                {autoReportPreview.significantArticles.length} signifikante Artikel gefunden
                (von {autoReportPreview.totalClassified} klassifizierten, {autoReportPreview.totalDeep} tiefenanalysiert)
              </div>

              {autoReportPreview.warning && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                  {autoReportPreview.warning}
                </div>
              )}

              {/* Article list with significance badges */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {autoReportPreview.significantArticles.map((item) => (
                  <div key={item.article.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-sm font-medium text-gray-900">{item.article.title}</div>
                    <div className="text-xs text-gray-500 mt-1">{item.article.source}</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.reasons.map((reason, idx) => {
                        const colors = {
                          oepnv: "bg-blue-100 text-blue-800",
                          transfer: "bg-purple-100 text-purple-800",
                          foerder: "bg-green-100 text-green-800",
                          markt: "bg-orange-100 text-orange-800",
                          synergie: "bg-teal-100 text-teal-800",
                          lvb: "bg-indigo-100 text-indigo-800",
                          trend: "bg-pink-100 text-pink-800",
                        };
                        const typeLabels = {
                          oepnv: "ÖV",
                          transfer: "Transfer",
                          foerder: "Förder",
                          markt: "Markt",
                          synergie: "Synergie",
                          lvb: "LVB",
                          trend: "Trend",
                        };
                        return (
                          <span
                            key={idx}
                            className={`px-2 py-0.5 text-xs rounded-full ${colors[reason.type] || "bg-gray-100 text-gray-700"}`}
                            title={reason.label}
                          >
                            {typeLabels[reason.type] || reason.type}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setAutoReportPreview(null)}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleAutoReportGenerate}
                disabled={autoReportPreview.significantArticles.length === 0}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Report generieren ({autoReportPreview.significantArticles.length} Artikel)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Generator Modal */}
      {showReportGenerator && (
        <ReportGenerator
          articleIds={selectedArticleIds}
          onClose={handleCloseReportGenerator}
        />
      )}

      {/* Auto-Report Result Modal */}
      {(autoReport !== null || autoReportLoading) && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{
            zIndex: 9999,
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: '#f3f4f6',
          }}
          onClick={() => { if (!autoReportLoading) { setAutoReport(null); setAutoReportError(null); } }}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full flex flex-col"
            style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {autoReportLoading ? "Auto-Report wird generiert..." : "Auto-Report"}
              </h2>
              <div className="flex items-center gap-2">
                {!autoReportLoading && autoReport && (
                  <>
                    <button
                      onClick={handleAutoReportCopy}
                      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      {autoReportCopied ? "Kopiert!" : "Kopieren"}
                    </button>
                    <button
                      onClick={handleAutoReportDownload}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Als Markdown speichern
                    </button>
                  </>
                )}
                <button
                  onClick={() => { setAutoReport(null); setAutoReportError(null); }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              {autoReportLoading && (
                <div className="text-sm text-gray-500 flex items-center gap-2 mb-4">
                  <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #d1d5db', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  Report wird generiert...
                </div>
              )}

              {autoReportError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
                  {autoReportError}
                </div>
              )}

              {autoReport && (
                <div
                  className="prose max-w-none bg-gray-50 p-4 rounded-lg border border-gray-200"
                  style={{ whiteSpace: 'pre-wrap', minHeight: autoReportLoading ? '200px' : undefined }}
                  dangerouslySetInnerHTML={{
                    __html: autoReport
                      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
                      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-5 mb-3">$1</h2>')
                      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em>$1</em>')
                      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">$1</a>')
                      .replace(/^\- (.*$)/gim, '<li class="ml-4">$1</li>')
                      .replace(/\n/g, '<br />')
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
