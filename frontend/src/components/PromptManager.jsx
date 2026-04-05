/**
 * @module PromptManager
 * @purpose Verwaltung & Bearbeitung der KI-Prompts über die UI
 *
 * @reads    config/prompts.js → PROMPT_DEFAULTS
 * @reads    stores/settingsStore.js → getCustomPrompts()
 * @writes   stores/settingsStore.js → setCustomPrompt(), resetCustomPrompt()
 * @calledBy App.jsx → Tab "Prompts"
 *
 * @exports  PromptManager (React Component)
 */

import { useState, useEffect } from "react";
import { PROMPT_DEFAULTS } from "../config/prompts.js";
import {
  getCustomPrompts,
  setCustomPrompt,
  resetCustomPrompt,
} from "../stores/settingsStore.js";

function PromptManager() {
  const [customs, setCustoms] = useState({});
  const [activeKey, setActiveKey] = useState("classify");
  const [editText, setEditText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    loadCustoms();
  }, []);

  useEffect(() => {
    loadPromptText(activeKey);
    setShowDiff(false);
    setShowReset(false);
    setSaved(false);
  }, [activeKey]);

  const loadCustoms = () => {
    setCustoms(getCustomPrompts());
  };

  const loadPromptText = (key) => {
    const custom = getCustomPrompts()[key];
    const def = PROMPT_DEFAULTS[key];
    if (custom) {
      setEditText(custom.content);
    } else if (def) {
      setEditText(def.getDefault());
    }
    setDirty(false);
  };

  const isCustomized = (key) => !!customs[key];

  const getDefault = (key) => PROMPT_DEFAULTS[key]?.getDefault() || "";

  const handleSave = () => {
    setCustomPrompt(activeKey, editText);
    loadCustoms();
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    resetCustomPrompt(activeKey);
    loadCustoms();
    setEditText(getDefault(activeKey));
    setDirty(false);
    setShowReset(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleRevert = () => {
    loadPromptText(activeKey);
  };

  // Age check: > 6 months
  const isOld = (key) => {
    const custom = customs[key];
    if (!custom?.updatedAt) return false;
    const age = Date.now() - new Date(custom.updatedAt).getTime();
    return age > 180 * 24 * 60 * 60 * 1000;
  };

  const promptKeys = Object.keys(PROMPT_DEFAULTS);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Prompt-Verwaltung</h2>
        <p className="text-sm text-gray-500">
          Bearbeite die System-Prompts für die KI-Klassifizierung, Matching und Recherche.
          Änderungen werden lokal im Browser gespeichert.
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar: Prompt list */}
        <div className="w-56 shrink-0 space-y-1">
          {promptKeys.map((key) => (
            <button
              key={key}
              onClick={() => setActiveKey(key)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between ${
                activeKey === key
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100 shadow-sm"
              }`}
            >
              <span className="truncate">{PROMPT_DEFAULTS[key].label}</span>
              <span className="flex items-center gap-1 ml-1 shrink-0">
                {isCustomized(key) && (
                  <span
                    className={`w-2 h-2 rounded-full ${
                      activeKey === key ? "bg-white" : "bg-blue-500"
                    }`}
                    title="Angepasst"
                  />
                )}
                {isOld(key) && (
                  <span
                    className={`text-xs ${
                      activeKey === key ? "text-yellow-200" : "text-yellow-500"
                    }`}
                    title="Möglicherweise veraltet (> 6 Monate)"
                  >
                    ⚠
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Editor area */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-lg shadow">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-gray-900">
                  {PROMPT_DEFAULTS[activeKey]?.label}
                </h3>
                {isCustomized(activeKey) && (
                  <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded-full">
                    Angepasst
                  </span>
                )}
                {customs[activeKey]?.updatedAt && (
                  <span className="text-xs text-gray-400">
                    v{customs[activeKey].version} · {new Date(customs[activeKey].updatedAt).toLocaleDateString("de-DE")}
                  </span>
                )}
                {isOld(activeKey) && (
                  <span className="text-xs text-yellow-600">
                    ⚠ Zuletzt vor &gt; 6 Monaten geändert
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {saved && <span className="text-sm text-green-600">✓ Gespeichert</span>}
                {dirty && (
                  <button
                    onClick={handleRevert}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                  >
                    Verwerfen
                  </button>
                )}
                {isCustomized(activeKey) && (
                  <>
                    <button
                      onClick={() => setShowDiff(!showDiff)}
                      className={`px-3 py-1 text-xs rounded transition-colors ${
                        showDiff ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      Diff
                    </button>
                    <button
                      onClick={() => setShowReset(true)}
                      className="px-3 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                    >
                      Zurücksetzen
                    </button>
                  </>
                )}
                <button
                  onClick={handleSave}
                  disabled={!dirty}
                  className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Speichern
                </button>
              </div>
            </div>

            {/* Reset confirm */}
            {showReset && (
              <div className="px-4 py-3 bg-red-50 border-b border-red-200">
                <p className="text-sm text-red-700 mb-2">
                  Prompt auf Standard zurücksetzen? Eigene Änderungen gehen verloren.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleReset}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  >
                    Zurücksetzen
                  </button>
                  <button
                    onClick={() => setShowReset(false)}
                    className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {/* Diff view */}
            {showDiff && isCustomized(activeKey) && (
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 max-h-60 overflow-y-auto">
                <p className="text-xs font-medium text-gray-500 mb-2">Standard-Prompt (Original):</p>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-white p-3 rounded border border-gray-200">
                  {getDefault(activeKey)}
                </pre>
              </div>
            )}

            {/* Editor */}
            <textarea
              value={editText}
              onChange={(e) => {
                setEditText(e.target.value);
                setDirty(true);
                setSaved(false);
              }}
              className="w-full h-96 px-4 py-3 text-sm font-mono text-gray-800 resize-y focus:outline-none"
              spellCheck={false}
            />

            {/* Footer stats */}
            <div className="px-4 py-2 border-t border-gray-200 flex justify-between text-xs text-gray-400">
              <span>{editText.length} Zeichen</span>
              <span>
                {activeKey === "match" && "Platzhalter: {{projectsContext}}"}
                {activeKey === "searchReport" && "Platzhalter: {{query}}"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PromptManager;
