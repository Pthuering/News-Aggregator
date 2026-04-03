/**
 * @module App
 * @purpose Main application shell for Trend Radar with feed ingest and classification
 *
 * Kontext: Phase 2d - Wire classify to UI
 */

import { useState, useEffect } from "react";
import { initDB, getAllArticles, getUnclassifiedArticles } from "./stores/articleStore.js";
import { fetchAllFeeds } from "./services/feedService.js";
import { classifyNew } from "./services/classifyService.js";
import { getNvidiaApiKey } from "./stores/settingsStore.js";
import Settings from "./components/Settings.jsx";

function App() {
  const [articles, setArticles] = useState([]);
  const [unclassifiedCount, setUnclassifiedCount] = useState(0);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [classifyProgress, setClassifyProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState(null);
  const [classifyResult, setClassifyResult] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize DB and check API key on mount
  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    await initDB();
    await loadArticles();
    await checkApiKey();
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
  };

  // Check if API key is set
  const checkApiKey = async () => {
    const key = await getNvidiaApiKey();
    setHasApiKey(!!key);
  };

  // Handle feed update button
  const handleFetchFeeds = async () => {
    setLoading(true);
    setResult(null);

    try {
      const ingestResult = await fetchAllFeeds();
      setResult(ingestResult);
      await loadArticles();
    } catch (error) {
      setResult({
        newCount: 0,
        skipped: 0,
        errors: [{ source: "Allgemein", error: error.message }],
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle classification button
  const handleClassify = async () => {
    if (!hasApiKey || unclassifiedCount === 0) return;

    setClassifyLoading(true);
    setClassifyResult(null);
    setClassifyProgress({ current: 0, total: unclassifiedCount });

    try {
      // Simulate progress (since classifyNew doesn't report progress yet)
      const progressInterval = setInterval(() => {
        setClassifyProgress((prev) => ({
          ...prev,
          current: Math.min(prev.current + 1, prev.total),
        }));
      }, 2000);

      const result = await classifyNew();
      clearInterval(progressInterval);
      setClassifyResult(result);
      await loadArticles();
    } catch (error) {
      setClassifyResult({
        classified: 0,
        failed: unclassifiedCount,
        errors: [error.message],
      });
    } finally {
      setClassifyLoading(false);
      setClassifyProgress({ current: 0, total: 0 });
    }
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

  if (!initialized) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Initialisiere...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold text-gray-900">Trend Radar</h1>
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
        {/* Action buttons */}
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={handleFetchFeeds}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Lädt..." : "Feeds aktualisieren"}
          </button>

          <button
            onClick={handleClassify}
            disabled={classifyLoading || !hasApiKey || unclassifiedCount === 0}
            title={
              !hasApiKey
                ? "API-Key in Einstellungen hinterlegen"
                : unclassifiedCount === 0
                ? "Keine unklassifizierten Artikel"
                : ""
            }
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {classifyLoading
              ? `Klassifiziere... (${classifyProgress.current}/${classifyProgress.total})`
              : `Klassifizieren (${unclassifiedCount})`}
          </button>
        </div>

        {/* Feed result summary */}
        {result && (
          <div className="mb-4 p-4 bg-white rounded-lg shadow">
            <div className="text-sm text-gray-700">
              <span className="font-medium">{result.newCount}</span> neue Artikel
              {result.skipped > 0 && (
                <>, <span className="font-medium">{result.skipped}</span> übersprungen</>
              )}
              {result.errors.length > 0 && (
                <>, <span className="font-medium text-red-600">{result.errors.length} Fehler</span></>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="mt-3 space-y-1">
                {result.errors.map((err, idx) => (
                  <div key={idx} className="text-sm text-red-600">
                    {err.source}: {err.error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Classification result */}
        {classifyResult && (
          <div className="mb-4 p-4 bg-white rounded-lg shadow border-l-4 border-purple-500">
            <div className="text-sm text-gray-700">
              <span className="font-medium">{classifyResult.classified}</span> klassifiziert
              {classifyResult.failed > 0 && (
                <>, <span className="font-medium text-red-600">{classifyResult.failed} fehlgeschlagen</span></>
              )}
            </div>
            {classifyResult.errors.length > 0 && (
              <div className="mt-2 text-xs text-red-600">
                {classifyResult.errors[0]}
                {classifyResult.errors.length > 1 && ` (+${classifyResult.errors.length - 1} weitere)`}
              </div>
            )}
          </div>
        )}

        {/* Article list */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">
              Artikel ({articles.length})
              {unclassifiedCount > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({unclassifiedCount} unklassifiziert)
                </span>
              )}
            </h2>
          </div>

          {articles.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Noch keine Artikel. Klicke "Feeds aktualisieren" um zu starten.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {articles.map((article) => (
                <li
                  key={article.id}
                  className={`p-4 hover:bg-gray-50 ${
                    !article.scores ? "opacity-70" : ""
                  }`}
                >
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    {/* Title */}
                    <div className="text-sm font-medium text-blue-600 hover:text-blue-800">
                      {article.title}
                    </div>

                    {/* Meta info */}
                    <div className="mt-1 text-sm text-gray-500">
                      {article.source} · {formatDate(article.published)}
                      {!article.scores && (
                        <span className="ml-2 text-gray-400">(unklassifiziert)</span>
                      )}
                    </div>

                    {/* Summary */}
                    {article.summary_de && (
                      <div className="mt-2 text-sm text-gray-600 line-clamp-2">
                        {article.summary_de}
                      </div>
                    )}

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
                      </div>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={() => setShowSettings(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <Settings onClose={() => { setShowSettings(false); checkApiKey(); }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
