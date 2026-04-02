/**
 * @module Settings
 * @purpose UI für API-Key-Eingabe und App-Einstellungen
 *
 * @reads    stores/settingsStore.js → getApiKey()
 * @writes   stores/settingsStore.js → setApiKey()
 * @calledBy App.jsx → über Navigation/Tab
 *
 * @exports  Settings (React Component)
 */

import { useState, useEffect } from "react";
import { getApiKey, setApiKey } from "../stores/settingsStore.js";

function Settings({ onClose }) {
  const [apiKey, setApiKeyState] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load existing API key on mount
  useEffect(() => {
    loadApiKey();
  }, []);

  const loadApiKey = async () => {
    try {
      const key = await getApiKey();
      setApiKeyState(key || "");
    } catch (error) {
      console.error("Failed to load API key:", error);
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

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
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
