/**
 * @module App
 * @purpose Main application shell for Trend Radar with feed ingest
 *
 * Kontext: Phase 1g - Wire Ingest to UI
 */

import { useState, useEffect } from "react";
import { initDB, getAllArticles } from "./stores/articleStore.js";
import { fetchAllFeeds } from "./services/feedService.js";

function App() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [initialized, setInitialized] = useState(false);

  // Initialize DB on mount
  useEffect(() => {
    initDB().then(() => {
      loadArticles();
      setInitialized(true);
    });
  }, []);

  // Load articles from store
  const loadArticles = async () => {
    const all = await getAllArticles();
    // Sort by date descending (newest first)
    all.sort((a, b) => new Date(b.published) - new Date(a.published));
    setArticles(all);
  };

  // Handle feed update button
  const handleFetchFeeds = async () => {
    setLoading(true);
    setResult(null);

    try {
      const ingestResult = await fetchAllFeeds();
      setResult(ingestResult);
      // Reload articles to show new ones
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
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Action button */}
        <div className="mb-6">
          <button
            onClick={handleFetchFeeds}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Lädt..." : "Feeds aktualisieren"}
          </button>
        </div>

        {/* Result summary */}
        {result && (
          <div className="mb-6 p-4 bg-white rounded-lg shadow">
            <div className="text-sm text-gray-700">
              <span className="font-medium">{result.newCount}</span> neue Artikel
              {result.skipped > 0 && (
                <>, <span className="font-medium">{result.skipped}</span> übersprungen</>
              )}
              {result.errors.length > 0 && (
                <>, <span className="font-medium text-red-600">{result.errors.length} Fehler</span></>
              )}
            </div>

            {/* Errors */}
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

        {/* Article list */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">
              Artikel ({articles.length})
            </h2>
          </div>

          {articles.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Noch keine Artikel. Klicke "Feeds aktualisieren" um zu starten.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {articles.map((article) => (
                <li key={article.id} className="p-4 hover:bg-gray-50">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <div className="text-sm font-medium text-blue-600 hover:text-blue-800">
                      {article.title}
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      {article.source} · {formatDate(article.published)}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
