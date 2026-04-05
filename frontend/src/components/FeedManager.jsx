/**
 * @module FeedManager
 * @purpose Feed-Verwaltung: Übersicht, Hinzufügen, Bearbeiten, Löschen, Test
 *
 * @reads    stores/sourceStore.js → getAllSources(), getCategories()
 * @writes   stores/sourceStore.js → saveSource(), updateSource(), deleteSource()
 * @calledBy App.jsx → Tab "Quellen"
 *
 * @exports  FeedManager (React Component)
 */

import { useState, useEffect } from "react";
import {
  getAllSources,
  saveSource,
  updateSource,
  deleteSource,
  getCategories,
} from "../stores/sourceStore.js";
import { fetchSingleFeed } from "../services/feedService.js";

const CATEGORY_LABELS = {
  branche: "Branche",
  tech: "Tech",
  foerder: "Förderung",
  startup: "Startup",
  international: "International",
};

function FeedManager() {
  const [sources, setSources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(null);
  const [filterCategory, setFilterCategory] = useState("all");

  // Form state
  const [form, setForm] = useState({ name: "", url: "", category: "branche" });
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [srcs, cats] = await Promise.all([getAllSources(), getCategories()]);
      setSources(srcs);
      setCategories(cats);
    } finally {
      setLoading(false);
    }
  };

  // --- Add / Edit ---
  const openAdd = () => {
    setForm({ name: "", url: "", category: "branche" });
    setFormError(null);
    setShowAdd(true);
    setEditId(null);
  };

  const openEdit = (source) => {
    setForm({ name: source.name, url: source.url, category: source.category });
    setFormError(null);
    setEditId(source.id);
    setShowAdd(true);
  };

  const handleSave = async () => {
    const { name, url, category } = form;
    if (!name.trim() || !url.trim()) {
      setFormError("Name und URL sind erforderlich.");
      return;
    }
    try {
      new URL(url);
    } catch {
      setFormError("Ungültige URL.");
      return;
    }

    try {
      if (editId) {
        await updateSource(editId, { name: name.trim(), url: url.trim(), category });
      } else {
        const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
        // Check for duplicate ID
        const existing = sources.find((s) => s.id === id);
        if (existing) {
          setFormError("Eine Quelle mit diesem Namen existiert bereits.");
          return;
        }
        await saveSource({
          id,
          name: name.trim(),
          url: url.trim(),
          type: "rss",
          category,
          active: true,
          lastFetched: null,
          lastError: null,
          articleCount: 0,
          createdAt: new Date().toISOString(),
        });
      }
      setShowAdd(false);
      setEditId(null);
      await loadData();
    } catch (err) {
      setFormError("Fehler: " + err.message);
    }
  };

  // --- Toggle active ---
  const handleToggle = async (source) => {
    await updateSource(source.id, { active: !source.active });
    await loadData();
  };

  // --- Delete ---
  const handleDelete = async (id) => {
    await deleteSource(id);
    setDeleteConfirm(null);
    await loadData();
  };

  // --- Test feed ---
  const handleTest = async (source) => {
    setTestLoading(source.id);
    setTestResult(null);
    try {
      const articles = await fetchSingleFeed(source);
      setTestResult({ id: source.id, ok: true, count: articles.length });
    } catch (err) {
      setTestResult({ id: source.id, ok: false, error: err.message });
    } finally {
      setTestLoading(null);
    }
  };

  // --- Filtering ---
  const filtered = filterCategory === "all"
    ? sources
    : sources.filter((s) => s.category === filterCategory);

  // --- Stats ---
  const activeCount = sources.filter((s) => s.active).length;
  const errorCount = sources.filter((s) => s.lastError).length;

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-gray-500">Lade Quellen...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Stats */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Feed-Quellen</h2>
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            + Quelle hinzufügen
          </button>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="px-3 py-1 bg-gray-100 rounded-full text-gray-700">
            {sources.length} Quellen gesamt
          </span>
          <span className="px-3 py-1 bg-green-50 rounded-full text-green-700">
            {activeCount} aktiv
          </span>
          {errorCount > 0 && (
            <span className="px-3 py-1 bg-red-50 rounded-full text-red-700">
              {errorCount} mit Fehler
            </span>
          )}
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAdd && (
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {editId ? "Quelle bearbeiten" : "Neue Quelle hinzufügen"}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="z.B. Nahverkehr Hamburg"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Feed-URL</label>
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://example.com/feed/"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
              >
                {editId ? "Speichern" : "Hinzufügen"}
              </button>
              <button
                onClick={() => { setShowAdd(false); setEditId(null); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilterCategory("all")}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            filterCategory === "all" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Alle
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              filterCategory === cat ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {/* Source List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            Keine Quellen gefunden.
          </div>
        )}
        {filtered.map((source) => (
          <div
            key={source.id}
            className={`bg-white rounded-lg shadow p-4 ${
              !source.active ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {/* Status indicator */}
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full ${
                      source.lastError
                        ? "bg-red-500"
                        : source.lastFetched
                        ? "bg-green-500"
                        : "bg-gray-300"
                    }`}
                    title={
                      source.lastError
                        ? `Fehler: ${source.lastError}`
                        : source.lastFetched
                        ? "OK"
                        : "Noch nicht abgerufen"
                    }
                  />
                  <h4 className="font-medium text-gray-900 truncate">{source.name}</h4>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                    {CATEGORY_LABELS[source.category] || source.category}
                  </span>
                  {!source.active && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">
                      Inaktiv
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">{source.url}</p>
                <div className="flex gap-4 mt-1 text-xs text-gray-400">
                  {source.lastFetched && (
                    <span>Letzter Abruf: {new Date(source.lastFetched).toLocaleString("de-DE")}</span>
                  )}
                  {source.articleCount > 0 && (
                    <span>{source.articleCount} Artikel</span>
                  )}
                  {source.lastError && (
                    <span className="text-red-500" title={source.lastError}>Fehler beim Abruf</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 ml-4 shrink-0">
                {/* Test */}
                <button
                  onClick={() => handleTest(source)}
                  disabled={testLoading === source.id}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Feed testen"
                >
                  {testLoading === source.id ? (
                    <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "🔍"
                  )}
                </button>
                {/* Toggle */}
                <button
                  onClick={() => handleToggle(source)}
                  className={`p-1.5 rounded transition-colors ${
                    source.active
                      ? "text-green-600 hover:bg-green-50"
                      : "text-gray-400 hover:bg-gray-100"
                  }`}
                  title={source.active ? "Deaktivieren" : "Aktivieren"}
                >
                  {source.active ? "✅" : "⬜"}
                </button>
                {/* Edit */}
                <button
                  onClick={() => openEdit(source)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  title="Bearbeiten"
                >
                  ✏️
                </button>
                {/* Delete */}
                <button
                  onClick={() => setDeleteConfirm(source.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Löschen"
                >
                  🗑️
                </button>
              </div>
            </div>

            {/* Test result inline */}
            {testResult && testResult.id === source.id && (
              <div className={`mt-2 text-sm p-2 rounded ${
                testResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}>
                {testResult.ok
                  ? `✓ Feed erreichbar – ${testResult.count} Artikel gefunden`
                  : `✗ Fehler: ${testResult.error}`}
              </div>
            )}

            {/* Delete confirmation */}
            {deleteConfirm === source.id && (
              <div className="mt-2 p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-700 mb-2">
                  „{source.name}" wirklich löschen?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDelete(source.id)}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  >
                    Löschen
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default FeedManager;
