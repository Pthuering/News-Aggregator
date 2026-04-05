/**
 * @module OpenSearch
 * @purpose KI-gestützte Themenrecherche mit Suchinterface, Ergebnisliste und Report
 *
 * @reads    services/searchService.js → searchArticles(), generateSearchReport()
 * @calledBy App.jsx → Tab "Recherche"
 *
 * @exports  OpenSearch (React Component)
 */

import { useState, useEffect, useRef } from "react";
import { searchArticles, generateSearchReport } from "../services/searchService.js";

const STORAGE_KEY_HISTORY = "tr_searchHistory";
const MAX_HISTORY = 20;

const EXAMPLE_QUERIES = [
  "E-Bus Ladeinfrastruktur",
  "autonomes Fahren ÖPNV",
  "Digitalisierung Ticketing",
  "EU Förderung Mobilität",
  "Predictive Maintenance Schienenverkehr",
  "On-Demand Ridepooling",
];

const DATE_OPTIONS = [
  { value: null, label: "Alle Zeiträume" },
  { value: 30, label: "Letzte 30 Tage" },
  { value: 90, label: "Letzte 90 Tage" },
  { value: 365, label: "Letztes Jahr" },
];

function OpenSearch({ onArticleClick }) {
  const [query, setQuery] = useState("");
  const [maxDays, setMaxDays] = useState(null);
  const [minRelevance, setMinRelevance] = useState(4);
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Report state
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);
  const [activeView, setActiveView] = useState("results"); // "results" | "report"

  const inputRef = useRef(null);

  // Load history on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || "[]");
      setHistory(saved);
    } catch {
      setHistory([]);
    }
  }, []);

  const saveHistory = (q) => {
    const updated = [q, ...history.filter((h) => h !== q)].slice(0, MAX_HISTORY);
    setHistory(updated);
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
  };

  const removeHistory = (q) => {
    const updated = history.filter((h) => h !== q);
    setHistory(updated);
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
  };

  // --- Search ---
  const handleSearch = async (q = query) => {
    const trimmed = (q || "").trim();
    if (!trimmed) return;

    setQuery(trimmed);
    setSearching(true);
    setError(null);
    setResults(null);
    setReport(null);
    setReportError(null);
    setActiveView("results");
    setSearchProgress(null);
    saveHistory(trimmed);

    try {
      const res = await searchArticles(
        trimmed,
        { maxDays, minRelevance },
        (current, total) => setSearchProgress({ current, total })
      );
      setResults(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
      setSearchProgress(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  // --- Report ---
  const handleGenerateReport = async () => {
    if (!results || results.length === 0) return;

    setReportLoading(true);
    setReportError(null);
    setReport(null);
    setActiveView("report");

    try {
      await generateSearchReport(query, results, (text) => setReport(text));
    } catch (err) {
      setReportError(err.message);
    } finally {
      setReportLoading(false);
    }
  };

  const handleCopyReport = () => {
    if (report) {
      navigator.clipboard.writeText(report);
    }
  };

  const handleDownloadReport = () => {
    if (!report) return;
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recherche-${query.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Relevance color ---
  const relevanceColor = (score) => {
    if (score >= 8) return "bg-green-100 text-green-800";
    if (score >= 6) return "bg-blue-100 text-blue-800";
    if (score >= 4) return "bg-yellow-100 text-yellow-800";
    return "bg-gray-100 text-gray-600";
  };

  // --- Render simple markdown ---
  const renderMarkdown = (md) => {
    if (!md) return null;
    const lines = md.split("\n");
    const elements = [];
    let inList = false;
    let listItems = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 mb-3 text-sm text-gray-700">
            {listItems.map((li, i) => <li key={i}>{li}</li>)}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith("## ")) {
        flushList();
        elements.push(
          <h2 key={i} className="text-lg font-bold text-gray-900 mt-5 mb-2">
            {line.slice(3)}
          </h2>
        );
      } else if (line.startsWith("### ")) {
        flushList();
        elements.push(
          <h3 key={i} className="text-base font-semibold text-gray-800 mt-4 mb-1">
            {line.slice(4)}
          </h3>
        );
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        inList = true;
        listItems.push(formatInline(line.slice(2)));
      } else if (line.startsWith("**") && line.endsWith("**")) {
        flushList();
        elements.push(
          <p key={i} className="font-semibold text-gray-800 mt-2 text-sm">
            {line.slice(2, -2)}
          </p>
        );
      } else if (line.trim() === "") {
        flushList();
      } else {
        flushList();
        elements.push(
          <p key={i} className="text-sm text-gray-700 mb-2">
            {formatInline(line)}
          </p>
        );
      }
    }
    flushList();
    return elements;
  };

  const formatInline = (text) => {
    // Bold
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">KI-Recherche</h2>
        <p className="text-sm text-gray-500 mb-4">
          Durchsuche alle gespeicherten Artikel mit KI-gestützter Relevanzbewertung und erstelle strukturierte Reports.
        </p>

        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => history.length > 0 && setShowHistory(true)}
              onBlur={() => setTimeout(() => setShowHistory(false), 200)}
              placeholder="Suchbegriff, Thema oder Fragestellung eingeben..."
              className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {/* History dropdown */}
            {showHistory && history.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                <div className="px-3 py-2 text-xs text-gray-400 font-medium border-b">Letzte Suchen</div>
                {history.map((h) => (
                  <div
                    key={h}
                    className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <span
                      className="flex-1 text-sm text-gray-700 truncate"
                      onMouseDown={(e) => { e.preventDefault(); handleSearch(h); }}
                    >
                      {h}
                    </span>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); removeHistory(h); }}
                      className="ml-2 text-gray-400 hover:text-red-500 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={searching || !query.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {searching ? "Suche..." : "Suchen"}
          </button>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Zeitraum:</label>
            <select
              value={maxDays ?? ""}
              onChange={(e) => setMaxDays(e.target.value ? Number(e.target.value) : null)}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md"
            >
              {DATE_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value ?? ""}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Min. Relevanz:</label>
            <select
              value={minRelevance}
              onChange={(e) => setMinRelevance(Number(e.target.value))}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((v) => (
                <option key={v} value={v}>{v}/10</option>
              ))}
            </select>
          </div>
        </div>

        {/* Example queries */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-400 self-center">Beispiele:</span>
          {EXAMPLE_QUERIES.map((eq) => (
            <button
              key={eq}
              onClick={() => { setQuery(eq); handleSearch(eq); }}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded-full hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              {eq}
            </button>
          ))}
        </div>
      </div>

      {/* Progress */}
      {searching && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <span className="inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600">
              {searchProgress
                ? `KI bewertet Artikel... (${searchProgress.current}/${searchProgress.total})`
                : "Artikel werden durchsucht..."}
            </span>
          </div>
          {searchProgress && searchProgress.total > 0 && (
            <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${(searchProgress.current / searchProgress.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {results !== null && !searching && (
        <div className="space-y-4">
          {/* Result header + tabs */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="font-semibold text-gray-900">
                  {results.length} Ergebnis{results.length !== 1 ? "se" : ""} für „{query}"
                </h3>
                {results.length > 0 && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => setActiveView("results")}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        activeView === "results"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      Ergebnisse
                    </button>
                    <button
                      onClick={() => {
                        setActiveView("report");
                        if (!report && !reportLoading) handleGenerateReport();
                      }}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        activeView === "report"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      Report
                    </button>
                  </div>
                )}
              </div>
              {results.length > 0 && activeView === "report" && report && (
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyReport}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                    title="In Zwischenablage kopieren"
                  >
                    📋 Kopieren
                  </button>
                  <button
                    onClick={handleDownloadReport}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                    title="Als Markdown herunterladen"
                  >
                    💾 Download
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Results list */}
          {activeView === "results" && (
            <>
              {results.length === 0 && (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                  Keine relevanten Artikel gefunden. Versuche andere Suchbegriffe oder einen größeren Zeitraum.
                </div>
              )}
              {results.map((r, idx) => (
                <div
                  key={r.article.id || idx}
                  className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => onArticleClick && onArticleClick(r.article)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${relevanceColor(r.relevance)}`}>
                          {r.relevance}/10
                        </span>
                        <span className="text-xs text-gray-400">{r.article.source}</span>
                        <span className="text-xs text-gray-400">
                          {r.article.published?.split("T")[0] || ""}
                        </span>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-1">{r.article.title}</h4>
                      {r.reasoning && (
                        <p className="text-sm text-gray-500 italic mb-1">
                          {r.reasoning}
                        </p>
                      )}
                      {r.article.summary_de && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {r.article.summary_de}
                        </p>
                      )}
                      {r.article.tags?.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {r.article.tags.slice(0, 5).map((tag) => (
                            <span key={tag} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Report view */}
          {activeView === "report" && (
            <div className="bg-white rounded-lg shadow p-6">
              {reportLoading && !report && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <span className="inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  Report wird generiert...
                </div>
              )}
              {reportError && (
                <div className="text-sm text-red-600 mb-4">{reportError}</div>
              )}
              {report && (
                <div className="prose prose-sm max-w-none">
                  {renderMarkdown(report)}
                </div>
              )}
              {reportLoading && report && (
                <div className="mt-2 text-xs text-gray-400">
                  <span className="inline-block w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-1" />
                  Wird fortgesetzt...
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default OpenSearch;
