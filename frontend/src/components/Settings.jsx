/**
 * @module Settings
 * @purpose UI für API-Key-Eingabe, App-Einstellungen und Daten-Backup
 *
 * @reads    stores/settingsStore.js → getApiKey()
 * @writes   stores/settingsStore.js → setApiKey()
 * @reads    stores/articleStore.js → exportAll(), importAll(), clearArticles()
 * @calledBy App.jsx → über Navigation/Tab
 *
 * @exports  Settings (React Component)
 */

import { useState, useEffect } from "react";
import { getApiKey, setApiKey } from "../stores/settingsStore.js";
import { exportAll, importAll, clearArticles } from "../stores/articleStore.js";

function Settings({ onClose }) {
  const [apiKey, setApiKeyState] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Data backup states
  const [articleCount, setArticleCount] = useState(0);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load existing API key and article count on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const key = await getApiKey();
      setApiKeyState(key || "");
      
      // Get article count for export
      const articles = await exportAll();
      setArticleCount(articles.length);
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  // Save API key
  const handleSave = async () => {
    await setApiKey(apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Export data
  const handleExport = async () => {
    try {
      const articles = await exportAll();
      const date = new Date().toISOString().split('T')[0];
      const filename = `trend-radar-backup-${date}.json`;
      
      const blob = new Blob([JSON.stringify(articles, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export fehlgeschlagen: " + error.message);
    }
  };

  // Handle file selection for import
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setImportFile(file);
    setImportError(null);
    setImportSuccess(null);
    
    // Preview the file
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!Array.isArray(data)) {
          setImportError("Ungültiges Dateiformat: Array erwartet");
          setImportPreview(null);
          return;
        }
        setImportPreview({
          count: data.length,
          sample: data.slice(0, 3).map(a => ({ title: a.title, source: a.source })),
        });
      } catch (err) {
        setImportError("Ungültige JSON-Datei");
        setImportPreview(null);
      }
    };
    reader.readAsText(file);
  };

  // Import data
  const handleImport = async () => {
    if (!importFile || !importPreview) return;
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target.result);
          await importAll(data);
          setImportSuccess(`${data.length} Artikel erfolgreich importiert`);
          setImportFile(null);
          setImportPreview(null);
          setArticleCount(data.length);
          setTimeout(() => setImportSuccess(null), 3000);
        } catch (err) {
          setImportError("Import fehlgeschlagen: " + err.message);
        }
      };
      reader.readAsText(importFile);
    } catch (error) {
      setImportError("Import fehlgeschlagen: " + error.message);
    }
  };

  // Clear all data
  const handleDeleteAll = async () => {
    try {
      await clearArticles();
      setArticleCount(0);
      setShowDeleteConfirm(false);
      alert("Alle Daten wurden gelöscht");
    } catch (error) {
      alert("Löschen fehlgeschlagen: " + error.message);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-gray-500">Lade Einstellungen...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Einstellungen</h2>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
        >
          ✕
        </button>
      </div>

      {/* API Key Section */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          NVIDIA API Key
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Für die KI-gestützte Artikel-Klassifizierung benötigen Sie einen API-Key von NVIDIA.
          Der API-Key wird lokal in Ihrem Browser gespeichert und nie an einen Server gesendet.
        </p>

        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKeyState(e.target.value)}
              placeholder="nvapi-..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              title={showKey ? "Key verbergen" : "Key anzeigen"}
            >
              {showKey ? "🙈" : "👁️"}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Speichern
            </button>
            {saved && (
              <span className="text-sm text-green-600">✓ Gespeichert</span>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          Hinweis: Sie können einen API-Key unter{" "}
          <a
            href="https://build.nvidia.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            build.nvidia.com
          </a>{" "}
          erstellen.
        </p>
      </section>

      {/* Data Backup Section */}
      <section className="border-t border-gray-200 pt-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          Daten-Backup
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Aktuell sind {articleCount} Artikel gespeichert.
        </p>

        {/* Export */}
        <div className="mb-6">
          <button
            onClick={handleExport}
            disabled={articleCount === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Daten exportieren (JSON)
          </button>
          <p className="text-xs text-gray-500 mt-2">
            Erstellt eine JSON-Datei mit allen Artikeln als Backup.
          </p>
        </div>

        {/* Import */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-700 mb-2">Import</h4>
          
          <input
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-medium
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              cursor-pointer"
          />

          {importPreview && (
            <div className="mt-3 p-3 bg-white rounded border border-gray-200">
              <p className="text-sm text-gray-700">
                <strong>{importPreview.count} Artikel gefunden</strong>
              </p>
              <ul className="mt-2 text-xs text-gray-500 space-y-1">
                {importPreview.sample.map((article, idx) => (
                  <li key={idx} className="truncate">
                    • {article.title} ({article.source})
                  </li>
                ))}
                {importPreview.count > 3 && (
                  <li>... und {importPreview.count - 3} weitere</li>
                )}
              </ul>
              <p className="mt-2 text-xs text-red-600">
                ⚠️ Bestehende Daten werden überschrieben!
              </p>
              <button
                onClick={handleImport}
                className="mt-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Importieren
              </button>
            </div>
          )}

          {importError && (
            <div className="mt-2 text-sm text-red-600">{importError}</div>
          )}

          {importSuccess && (
            <div className="mt-2 text-sm text-green-600">{importSuccess}</div>
          )}
        </div>

        {/* Delete All */}
        <div className="pt-4 border-t border-gray-200">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
            >
              Alle Daten löschen
            </button>
          ) : (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-red-700 mb-3">
                <strong>Warnung:</strong> Wirklich alle {articleCount} Artikel löschen?
                Dies kann nicht rückgängig gemacht werden!
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteAll}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Ja, alle löschen
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Info Section */}
      <section className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Über</h3>
        <p className="text-sm text-gray-600">
          <strong>News Aggregator / Trend Radar</strong>
          <br />
          Version 1.0.0
          <br />
          Ein Tool für ÖPNV-Digitalisierung
        </p>
      </section>
    </div>
  );
}

export default Settings;
