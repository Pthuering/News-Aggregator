/**
 * @module DataManager
 * @purpose Daten-Management: Backup/Restore, Bereinigung, Storage-Info
 *
 * @reads    stores/articleStore.js → exportAll(), importAll(), clearArticles(), getAllArticles()
 * @reads    stores/projectStore.js → getAllProjects()
 * @writes   stores/articleStore.js → importAll(), clearArticles(), deleteArticlesByFilter()
 * @writes   stores/settingsStore.js → getAutoCleanupSettings(), setAutoCleanupSettings()
 * @calledBy App.jsx → Tab "Daten"
 *
 * @exports  DataManager (React Component)
 */

import { useState, useEffect, useRef } from "react";
import { getAllArticles, importAll, clearArticles, deleteArticlesByFilter } from "../stores/articleStore.js";
import { getAllProjects, importProjects } from "../stores/projectStore.js";
import { getAutoCleanupSettings, setAutoCleanupSettings } from "../stores/settingsStore.js";

function DataManager({ onDataChange }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [autoCleanup, setAutoCleanup] = useState({ enabled: false, days: 90 });
  const fileInputRef = useRef(null);

  // Load stats and settings on mount
  useEffect(() => {
    loadStats();
    loadSettings();
  }, []);

  const loadStats = async () => {
    const articles = await getAllArticles();
    const projects = await getAllProjects();
    
    const classified = articles.filter(a => a.scores).length;
    const unclassified = articles.length - classified;
    const bookmarked = articles.filter(a => a.bookmarked).length;
    const withSynergies = articles.filter(a => a.synergies?.length > 0).length;
    
    // Estimate storage size (rough approximation)
    const articlesJson = JSON.stringify(articles);
    const projectsJson = JSON.stringify(projects);
    const estimatedBytes = (articlesJson.length + projectsJson.length) * 2; // UTF-16
    const estimatedMB = (estimatedBytes / 1024 / 1024).toFixed(2);

    setStats({
      total: articles.length,
      classified,
      unclassified,
      bookmarked,
      withSynergies,
      projects: projects.length,
      estimatedMB,
    });
  };

  const loadSettings = async () => {
    const settings = await getAutoCleanupSettings();
    setAutoCleanup(settings);
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const articles = await getAllArticles();
      const projects = await getAllProjects();
      
      const backup = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        app: "Trend Radar",
        stats: {
          articleCount: articles.length,
          projectCount: projects.length,
        },
        data: {
          articles,
          projects,
        },
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const date = new Date().toISOString().split("T")[0];
      const filename = `trend-radar-backup-${date}.json`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setImportStatus({ type: "loading", message: "Datei wird gelesen..." });

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      // Validation
      if (!backup.version || !backup.data) {
        throw new Error("Ungültiges Backup-Format");
      }
      if (!Array.isArray(backup.data.articles)) {
        throw new Error("Backup enthält keine Artikel-Daten");
      }

      setImportStatus({ type: "loading", message: `${backup.data.articles.length} Artikel werden importiert...` });

      // Import articles
      await importAll(backup.data.articles);

      // Import projects if present
      if (backup.data.projects && Array.isArray(backup.data.projects)) {
        await importProjects(backup.data.projects);
      }

      setImportStatus({ 
        type: "success", 
        message: `${backup.data.articles.length} Artikel importiert` 
      });
      
      await loadStats();
      if (onDataChange) onDataChange();
      
      // Clear file input
      e.target.value = "";
      
      // Clear success message after 3 seconds
      setTimeout(() => setImportStatus(null), 3000);
    } catch (error) {
      setImportStatus({ type: "error", message: `Import fehlgeschlagen: ${error.message}` });
      e.target.value = "";
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (type, options = {}) => {
    setDeleteConfirm({ type, options });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    setLoading(true);
    try {
      const { type, options } = deleteConfirm;

      switch (type) {
        case "unclassified": {
          const articles = await getAllArticles();
          const toDelete = articles.filter(a => !a.scores && 
            (!options.olderThanDays || 
             (new Date() - new Date(a.published)) > options.olderThanDays * 24 * 60 * 60 * 1000)
          );
          for (const article of toDelete) {
            await deleteArticlesByFilter([article.id]);
          }
          break;
        }
        case "unbookmarked": {
          const articles = await getAllArticles();
          const toDelete = articles.filter(a => !a.bookmarked && 
            (!options.olderThanDays || 
             (new Date() - new Date(a.published)) > options.olderThanDays * 24 * 60 * 60 * 1000)
          );
          for (const article of toDelete) {
            await deleteArticlesByFilter([article.id]);
          }
          break;
        }
        case "olderThan": {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - options.days);
          const articles = await getAllArticles();
          const toDelete = articles.filter(a => new Date(a.published) < cutoffDate);
          for (const article of toDelete) {
            await deleteArticlesByFilter([article.id]);
          }
          break;
        }
        case "all": {
          await clearArticles();
          break;
        }
      }

      await loadStats();
      if (onDataChange) onDataChange();
    } finally {
      setLoading(false);
      setDeleteConfirm(null);
    }
  };

  const handleAutoCleanupChange = async (enabled) => {
    const newSettings = { ...autoCleanup, enabled };
    setAutoCleanup(newSettings);
    await setAutoCleanupSettings(newSettings);
  };

  const handleAutoCleanupDaysChange = async (days) => {
    const newSettings = { ...autoCleanup, days: parseInt(days) };
    setAutoCleanup(newSettings);
    await setAutoCleanupSettings(newSettings);
  };

  const getDeleteConfirmText = () => {
    if (!deleteConfirm) return "";
    const { type, options } = deleteConfirm;
    switch (type) {
      case "unclassified":
        return options.olderThanDays 
          ? `Alle unklassifizierten Artikel älter als ${options.olderThanDays} Tage löschen?`
          : "Alle unklassifizierten Artikel löschen?";
      case "unbookmarked":
        return options.olderThanDays
          ? `Alle nicht markierten Artikel älter als ${options.olderThanDays} Tage löschen?`
          : "Alle nicht markierten Artikel löschen?";
      case "olderThan":
        return `Alle Artikel älter als ${options.days} Tage löschen?`;
      case "all":
        return "ALLE Daten unwiderruflich löschen? Diese Aktion kann nicht rückgängig gemacht werden!";
      default:
        return "";
    }
  };

  if (!stats) {
    return (
      <div className="p-8 text-center text-gray-500">
        Lade Statistiken...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Daten-Management</h2>
        <button
          onClick={loadStats}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
        >
          Aktualisieren
        </button>
      </div>

      {/* Storage Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Storage-Übersicht</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-900">{stats.total}</div>
            <div className="text-sm text-blue-700">Artikel gesamt</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-900">{stats.classified}</div>
            <div className="text-sm text-green-700">Klassifiziert</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-900">{stats.unclassified}</div>
            <div className="text-sm text-yellow-700">Unklassifiziert</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-900">{stats.projects}</div>
            <div className="text-sm text-purple-700">Projekte</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Mit Lesezeichen:</span> {stats.bookmarked}
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium">Mit Synergien:</span> {stats.withSynergies}
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium">Geschätzte Größe:</span> ~{stats.estimatedMB} MB
          </div>
        </div>
      </div>

      {/* Backup & Restore */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Backup & Restore</h3>
        
        <div className="flex flex-wrap gap-3 mb-4">
          <button
            onClick={handleExport}
            disabled={loading || stats.total === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            📥 Backup exportieren
          </button>
          
          <button
            onClick={handleImportClick}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            📤 Backup importieren
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {importStatus && (
          <div className={`p-3 rounded-md text-sm ${
            importStatus.type === "success" ? "bg-green-50 text-green-800 border border-green-200" :
            importStatus.type === "error" ? "bg-red-50 text-red-800 border border-red-200" :
            "bg-blue-50 text-blue-800 border border-blue-200"
          }`}>
            {importStatus.type === "loading" && (
              <span className="inline-block mr-2 animate-spin">⟳</span>
            )}
            {importStatus.message}
          </div>
        )}

        <p className="text-sm text-gray-500 mt-2">
          Exportiert/Importiert alle Artikel (inkl. Klassifikationen, Lesezeichen, Notizen) und Projekte.
        </p>
      </div>

      {/* Auto Cleanup Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Automatische Bereinigung</h3>
        
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={autoCleanup.enabled}
              onChange={(e) => handleAutoCleanupChange(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-gray-700">Alte Artikel automatisch löschen</span>
          </label>
          
          {autoCleanup.enabled && (
            <div className="ml-7">
              <label className="text-sm text-gray-600">Artikel älter als löschen:</label>
              <select
                value={autoCleanup.days}
                onChange={(e) => handleAutoCleanupDaysChange(e.target.value)}
                className="ml-2 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="30">30 Tage</option>
                <option value="60">60 Tage</option>
                <option value="90">90 Tage</option>
                <option value="180">180 Tage</option>
                <option value="365">1 Jahr</option>
              </select>
            </div>
          )}
        </div>
        
        <p className="text-sm text-gray-500 mt-3">
          Wird bei jedem Feed-Update geprüft. Artikel mit Lesezeichen werden nie automatisch gelöscht.
        </p>
      </div>

      {/* Selective Cleanup */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Selektive Bereinigung</h3>
        
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleDelete("unclassified", {})}
              disabled={loading || stats.unclassified === 0}
              className="px-3 py-2 bg-orange-100 text-orange-800 rounded-md hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Unklassifizierte löschen
            </button>
            <button
              onClick={() => handleDelete("unclassified", { olderThanDays: 30 })}
              disabled={loading || stats.unclassified === 0}
              className="px-3 py-2 bg-orange-50 text-orange-700 rounded-md hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              älter als 30 Tage
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleDelete("unbookmarked", {})}
              disabled={loading || stats.total - stats.bookmarked === 0}
              className="px-3 py-2 bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Ohne Lesezeichen löschen
            </button>
            <button
              onClick={() => handleDelete("unbookmarked", { olderThanDays: 30 })}
              disabled={loading || stats.total - stats.bookmarked === 0}
              className="px-3 py-2 bg-yellow-50 text-yellow-700 rounded-md hover:bg-yellow-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              älter als 30 Tage
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-600">Artikel älter als:</span>
            {[30, 60, 90, 180].map(days => (
              <button
                key={days}
                onClick={() => handleDelete("olderThan", { days })}
                disabled={loading}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {days} Tage
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-gray-200">
            <button
              onClick={() => handleDelete("all", {})}
              disabled={loading || stats.total === 0}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              ⚠️ ALLE Daten löschen
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-500 mt-3">
          Achtung: Gelöschte Daten können nicht wiederhergestellt werden (außer aus einem Backup).
        </p>
      </div>

      {/* Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-3">
              {deleteConfirm.type === "all" ? "⚠️ Vorsicht" : "Löschen bestätigen"}
            </h4>
            <p className="text-gray-700 mb-6">
              {getDeleteConfirmText()}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={loading}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                onClick={confirmDelete}
                disabled={loading}
                className={`px-4 py-2 rounded-md text-white disabled:opacity-50 ${
                  deleteConfirm.type === "all" 
                    ? "bg-red-600 hover:bg-red-700" 
                    : "bg-orange-600 hover:bg-orange-700"
                }`}
              >
                {loading ? "Löschen..." : "Löschen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataManager;
