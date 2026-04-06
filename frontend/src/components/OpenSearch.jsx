/**
 * @module OpenSearch
 * @purpose Web-Recherche mit DuckDuckGo, Ergebnisliste und KI-Report
 *
 * @reads    services/searchService.js → searchWeb(), generateSearchReport()
 * @calledBy App.jsx → Tab "Recherche"
 *
 * @exports  OpenSearch (React Component)
 */

import { useState, useEffect, useRef } from "react";
import { searchWeb, scoreResults, generateSearchReport, generateArticleSummaryReport } from "../services/searchService.js";
import { getAllArticles } from "../stores/articleStore.js";

const STORAGE_KEY_HISTORY = "tr_searchHistory";
const STORAGE_KEY_QUICKSEARCH = "tr_quickSearchButtons";
const MAX_HISTORY = 20;

const DEFAULT_QUICK_SEARCHES = [
  {
    id: "ki-news",
    label: "Was gibt es Neues zu KI?",
    mode: "web",
    searchQuery: "KI coding agents software development 2026",
    prompt: "welche aktuellen lösungen und systemarchitekturen gibt es, um die bestehenden probleme von ki und coding agenten beim entwickeln von software zu beheben? führe eine deep research durch, suche nach den aktuellen vorreitern und gehe auch auf workflows ein, die open source zur verfügung stehen und wie diese insgesamt abschneiden, um so detaillierte daten wie möglich zu sammeln.",
  },
  {
    id: "oepnv-news",
    label: "Was gibt es Neues im ÖPNV?",
    mode: "articles",
    searchQuery: "",
    prompt: `Du bist ein Analyst in der Digitalisierungsabteilung eines deutschen Verkehrsunternehmens. Erstelle einen umfassenden Lagebericht auf Deutsch basierend auf den bereitgestellten Artikeln.

Struktur:
## Überblick
Kurze Zusammenfassung der wichtigsten Entwicklungen.

## Top-Themen
Die 3-5 wichtigsten Entwicklungen mit hoher Relevanz für den ÖPNV, jeweils mit Kontext und Einordnung.

## Technologie & Innovation
Neue Technologien, Pilotprojekte und Digitalisierungsfortschritte.

## Förderlandschaft & Politik
Aktuelle Förderprogramme, politische Signale und regulatorische Änderungen.

## Markt & Wettbewerb
Neue Marktteilnehmer, Funding-Runden, Partnerschaften und Produktlaunches.

## Handlungsempfehlungen
Konkrete Empfehlungen für ein deutsches Verkehrsunternehmen basierend auf den Erkenntnissen.

Schreibe prägnant, faktenbasiert und mit konkreten Details aus den Artikeln. Nenne Quellen.`,
  },
];

const EXAMPLE_QUERIES = [
  "E-Bus Ladeinfrastruktur",
  "autonomes Fahren ÖPNV",
  "Digitalisierung Ticketing",
  "EU Förderung Mobilität",
  "Predictive Maintenance Schienenverkehr",
  "On-Demand Ridepooling",
];

const DATE_OPTIONS = [
  { value: "", label: "Beliebig" },
  { value: "d", label: "Letzter Tag" },
  { value: "w", label: "Letzte Woche" },
  { value: "m", label: "Letzter Monat" },
  { value: "y", label: "Letztes Jahr" },
];

function OpenSearch() {
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Report state
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);
  const [activeView, setActiveView] = useState("results"); // "results" | "report"

  // Scoring state
  const [scoring, setScoring] = useState(false);
  const [scored, setScored] = useState(false);

  const inputRef = useRef(null);

  // Quick-search button state
  const [quickSearches, setQuickSearches] = useState([]);
  const [editingQuickSearch, setEditingQuickSearch] = useState(null);
  const [showQuickSearchEditor, setShowQuickSearchEditor] = useState(false);

  // Load history and quick searches on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || "[]");
      setHistory(saved);
    } catch {
      setHistory([]);
    }
    try {
      const savedQS = JSON.parse(localStorage.getItem(STORAGE_KEY_QUICKSEARCH));
      setQuickSearches(savedQS && savedQS.length > 0 ? savedQS : DEFAULT_QUICK_SEARCHES);
    } catch {
      setQuickSearches(DEFAULT_QUICK_SEARCHES);
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
    setStatusMsg(null);
    setScored(false);
    saveHistory(trimmed);

    try {
      const res = await searchWeb(
        trimmed,
        { dateFilter: dateFilter || null },
        (msg) => setStatusMsg(msg)
      );
      setResults(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
      setStatusMsg(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  // --- Score results with LLM ---
  const handleScore = async () => {
    if (!results || results.length === 0) return;

    setScoring(true);
    setStatusMsg(null);
    setError(null);

    try {
      const scoredResults = await scoreResults(query, results, (msg) => setStatusMsg(msg));
      setResults(scoredResults);
      setScored(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setScoring(false);
      setStatusMsg(null);
    }
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
    if (score < 0) return "bg-gray-100 text-gray-500";
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

  // --- Quick Search ---
  const saveQuickSearches = (qs) => {
    setQuickSearches(qs);
    localStorage.setItem(STORAGE_KEY_QUICKSEARCH, JSON.stringify(qs));
  };

  const handleQuickSearch = async (qs) => {
    if (searching || reportLoading) return;

    if (qs.mode === "articles") {
      // Generate report from classified articles
      setReportLoading(true);
      setReportError(null);
      setReport(null);
      setResults(null);
      setActiveView("report");
      setQuery(qs.label);
      setError(null);

      try {
        const allArticles = await getAllArticles();
        const classified = allArticles.filter(a => a.scores && a.deepClassifiedAt);
        if (classified.length === 0) {
          // fallback: use any classified articles
          const anyClassified = allArticles.filter(a => a.scores);
          if (anyClassified.length === 0) throw new Error("Keine klassifizierten Artikel vorhanden. Bitte zuerst Feeds laden und klassifizieren.");
          await generateArticleSummaryReport(anyClassified.slice(0, 50), qs.prompt, (text) => setReport(text));
        } else {
          await generateArticleSummaryReport(classified.slice(0, 50), qs.prompt, (text) => setReport(text));
        }
      } catch (err) {
        setReportError(err.message);
      } finally {
        setReportLoading(false);
      }
    } else {
      // Web search with extra context
      setQuery(qs.searchQuery || qs.label);
      setSearching(true);
      setError(null);
      setResults(null);
      setReport(null);
      setReportError(null);
      setActiveView("results");
      setStatusMsg(null);
      setScored(false);

      try {
        const searchQ = qs.searchQuery || qs.label;
        const res = await searchWeb(searchQ, { dateFilter: dateFilter || null }, (msg) => setStatusMsg(msg));
        setResults(res);

        // Auto-generate report with the custom prompt as extra context
        setReportLoading(true);
        setActiveView("report");
        await generateSearchReport(searchQ, res, (text) => setReport(text), qs.prompt);
      } catch (err) {
        setError(err.message);
      } finally {
        setSearching(false);
        setReportLoading(false);
        setStatusMsg(null);
      }
    }
  };

  const handleSaveQuickSearchEdit = () => {
    if (!editingQuickSearch) return;
    const updated = quickSearches.map(qs =>
      qs.id === editingQuickSearch.id ? editingQuickSearch : qs
    );
    // If it's a new button (not in the list yet), add it
    if (!quickSearches.find(qs => qs.id === editingQuickSearch.id)) {
      updated.push(editingQuickSearch);
    }
    saveQuickSearches(updated);
    setShowQuickSearchEditor(false);
    setEditingQuickSearch(null);
  };

  const handleDeleteQuickSearch = (id) => {
    saveQuickSearches(quickSearches.filter(qs => qs.id !== id));
  };

  const handleAddQuickSearch = () => {
    setEditingQuickSearch({
      id: `qs-${Date.now()}`,
      label: "",
      mode: "web",
      searchQuery: "",
      prompt: "",
    });
    setShowQuickSearchEditor(true);
  };

  return (
    <div className="space-y-6">
      {/* Quick Search Editor Modal */}
      {showQuickSearchEditor && editingQuickSearch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {quickSearches.find(qs => qs.id === editingQuickSearch.id) ? "Button bearbeiten" : "Neuer Button"}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Button-Label</label>
                  <input
                    type="text"
                    value={editingQuickSearch.label}
                    onChange={e => setEditingQuickSearch({ ...editingQuickSearch, label: e.target.value })}
                    placeholder="z.B. Was gibt es Neues zu KI?"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modus</label>
                  <select
                    value={editingQuickSearch.mode}
                    onChange={e => setEditingQuickSearch({ ...editingQuickSearch, mode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="web">Web-Recherche</option>
                    <option value="articles">Artikel-Analyse (lokale Daten)</option>
                  </select>
                </div>

                {editingQuickSearch.mode === "web" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Suchbegriff (optional, sonst Label)</label>
                    <input
                      type="text"
                      value={editingQuickSearch.searchQuery}
                      onChange={e => setEditingQuickSearch({ ...editingQuickSearch, searchQuery: e.target.value })}
                      placeholder="z.B. AI coding agents software development 2026"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prompt / Zusätzlicher Kontext
                  </label>
                  <textarea
                    value={editingQuickSearch.prompt}
                    onChange={e => setEditingQuickSearch({ ...editingQuickSearch, prompt: e.target.value })}
                    rows={8}
                    placeholder="Detaillierte Anweisungen für die KI..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => { setShowQuickSearchEditor(false); setEditingQuickSearch(null); }}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSaveQuickSearchEdit}
                  disabled={!editingQuickSearch.label.trim() || !editingQuickSearch.prompt.trim()}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">KI-Recherche</h2>
        <p className="text-sm text-gray-500 mb-4">
          Durchsuche das Web mit DuckDuckGo und erstelle KI-gestützte Reports aus den gefundenen Quellen.
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
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md"
            >
              {DATE_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
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

      {/* Quick Search Buttons */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Schnellrecherche</h3>
          <button
            onClick={handleAddQuickSearch}
            className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
          >
            + Neuer Button
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickSearches.map((qs) => (
            <div key={qs.id} className="group relative">
              <button
                onClick={() => handleQuickSearch(qs)}
                disabled={searching || reportLoading}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  qs.mode === "articles"
                    ? "bg-indigo-100 text-indigo-800 hover:bg-indigo-200"
                    : "bg-blue-100 text-blue-800 hover:bg-blue-200"
                }`}
              >
                {qs.mode === "articles" ? "📊 " : "🔍 "}{qs.label}
              </button>
              <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingQuickSearch({ ...qs }); setShowQuickSearchEditor(true); }}
                  className="w-5 h-5 text-xs bg-gray-600 text-white rounded-full flex items-center justify-center hover:bg-gray-800"
                  title="Bearbeiten"
                >
                  ✎
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteQuickSearch(qs.id); }}
                  className="w-5 h-5 text-xs bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-800"
                  title="Löschen"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Hover über einen Button für Bearbeiten/Löschen. Web-Buttons suchen im Internet, Artikel-Buttons analysieren lokale Daten.
        </p>
      </div>

      {/* Progress */}
      {(searching || scoring) && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <span className="inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600">
              {statusMsg || (scoring ? "Ergebnisse werden bewertet…" : "Websuche wird durchgeführt…")}
            </span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {(results !== null || report || reportLoading) && !searching && (
        <div className="space-y-4">
          {/* Result header + tabs */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="font-semibold text-gray-900">
                  {results ? (
                    <>{results.length} Ergebnis{results.length !== 1 ? "se" : ""} für „{query}"</>
                  ) : (
                    <>Report: {query}</>
                  )}
                  {scored && <span className="text-xs text-green-600 ml-2">✓ bewertet</span>}
                </h3>
                {results && results.length > 0 && (
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
                        if (!scored && !scoring) handleScore();
                      }}
                      disabled={scoring || scored}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        scored
                          ? "bg-green-100 text-green-700 cursor-default"
                          : scoring
                            ? "bg-gray-200 text-gray-500 cursor-wait"
                            : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                      }`}
                    >
                      {scoring ? "Bewertung…" : scored ? "✓ Bewertet" : "KI bewerten"}
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
              {activeView === "report" && report && (
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
                  Keine Ergebnisse gefunden. Versuche andere Suchbegriffe.
                </div>
              )}
              {results.map((r, idx) => (
                <a
                  key={idx}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {scored && r.relevance != null && r.relevance >= 0 ? (
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${relevanceColor(r.relevance)}`}>
                            {r.relevance}/10
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500">
                            #{idx + 1}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 truncate">
                          {(() => { try { return new URL(r.url).hostname; } catch { return r.url; } })()}
                        </span>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-1 hover:text-blue-700">{r.title}</h4>
                      {r.reasoning && (
                        <p className="text-sm text-gray-500 italic mb-1">{r.reasoning}</p>
                      )}
                      {r.snippet && (
                        <p className="text-sm text-gray-600 line-clamp-2">{r.snippet}</p>
                      )}
                      <p className="text-xs text-blue-500 mt-1 truncate">{r.url}</p>
                    </div>
                    <span className="text-gray-400 text-sm mt-1 flex-shrink-0">↗</span>
                  </div>
                </a>
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
