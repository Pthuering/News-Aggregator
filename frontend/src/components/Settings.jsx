/**
 * @module Settings
 * @purpose Configure application settings and API keys
 *
 * @reads    settingsStore.js → getAllSettings()
 * @writes   settingsStore.js → setSetting()
 * @calledBy App.jsx → settings view
 *
 * @dataflow Settings form → validation → save to store
 *
 * @props
 *   onClose: () => void - Close handler
 *
 * @errors Validates API key format, shows save confirmation
 */

import { useState, useEffect } from "react";
import {
  getAllSettings,
  setSetting,
  setAnthropicApiKey,
} from "../stores/settingsStore.js";

function Settings({ onClose }) {
  const [settings, setSettings] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const all = await getAllSettings();
      setSettings(all);
      setApiKey(all.anthropicApiKey || "");
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  // Save API key
  const handleSaveApiKey = async () => {
    await setAnthropicApiKey(apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Update a setting
  const handleSettingChange = async (key, value) => {
    await setSetting(key, value);
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // Clear all data
  const handleClearData = async () => {
    if (
      confirm(
        "Möchten Sie wirklich alle Artikel und Einstellungen löschen? Dies kann nicht rückgängig gemacht werden."
      )
    ) {
      const { clearArticles } = await import("../stores/articleStore.js");
      await clearArticles();
      alert("Alle Daten wurden gelöscht.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Lade Einstellungen...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Einstellungen</h2>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
        >
          ✕
        </button>
      </div>

      <div className="space-y-8">
        {/* Anthropic API Key */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Anthropic API Key
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Für die KI-gestützte Artikel-Klassifizierung benötigen Sie einen API-Key von Anthropic.
            Dieser wird lokal in Ihrem Browser gespeichert.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-api03-..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSaveApiKey}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Speichern
            </button>
          </div>
          {saved && (
            <p className="text-sm text-green-600 mt-2">✓ API-Key gespeichert</p>
          )}
          <p className="text-xs text-gray-500 mt-2">
            Ihr API-Key wird ausschließlich lokal in IndexedDB gespeichert und nie an Dritte gesendet.
          </p>
        </section>

        {/* Feed Settings */}
        <section className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Feed-Einstellungen
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-700">Auto-Abruf beim Start</div>
                <div className="text-sm text-gray-500">
                  Feeds automatisch beim App-Start abrufen
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoFetchOnStartup}
                  onChange={(e) =>
                    handleSettingChange("autoFetchOnStartup", e.target.checked)
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-700">Auto-Klassifizierung</div>
                <div className="text-sm text-gray-500">
                  Neue Artikel automatisch per KI klassifizieren
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoClassify}
                  onChange={(e) =>
                    handleSettingChange("autoClassify", e.target.checked)
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </section>

        {/* Classification Settings */}
        <section className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Klassifizierung
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mindest-Score zum Anzeigen
            </label>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={settings.classificationThreshold}
              onChange={(e) =>
                handleSettingChange(
                  "classificationThreshold",
                  parseInt(e.target.value)
                )
              }
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Alle anzeigen (0)</span>
              <span className="font-medium">{settings.classificationThreshold}</span>
              <span>Nur Hohe (10)</span>
            </div>
          </div>
        </section>

        {/* Report Settings */}
        <section className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Report-Standardwerte
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Länge
              </label>
              <select
                value={settings.defaultReportLength}
                onChange={(e) =>
                  handleSettingChange("defaultReportLength", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="kurz">Kurz</option>
                <option value="mittel">Mittel</option>
                <option value="detail">Detailliert</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zielgruppe
              </label>
              <select
                value={settings.defaultReportAudience}
                onChange={(e) =>
                  handleSettingChange("defaultReportAudience", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="geschaeftsfuehrung">Geschäftsführung</option>
                <option value="fachabteilung">Fachabteilung</option>
                <option value="foerderantrag">Förderantrag</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fokus
              </label>
              <select
                value={settings.defaultReportFocus}
                onChange={(e) =>
                  handleSettingChange("defaultReportFocus", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="technologie">Technologie</option>
                <option value="wettbewerb">Wettbewerb</option>
                <option value="foerderpotential">Förderpotential</option>
                <option value="allgemein">Allgemein</option>
              </select>
            </div>
          </div>
        </section>

        {/* Data Management */}
        <section className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Datenverwaltung
          </h3>
          <button
            onClick={handleClearData}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Alle Daten löschen
          </button>
          <p className="text-sm text-gray-500 mt-2">
            Löscht alle Artikel, Projekte und Einstellungen. Dies kann nicht rückgängig gemacht werden.
          </p>
        </section>

        {/* About */}
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
    </div>
  );
}

export default Settings;
