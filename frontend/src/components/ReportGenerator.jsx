/**
 * @module ReportGenerator
 * @purpose Modal/Panel für Report-Konfiguration und -Generierung
 *
 * @reads    stores/articleStore.js → Artikel-Daten für Vorschau
 * @calls    services/reportService.js → generateReport()
 * @calledBy App.jsx → wird geöffnet mit Liste von Artikel-IDs
 *
 * @exports  ReportGenerator (React Component)
 *   Props:
 *     articleIds: string[] – IDs der ausgewählten Artikel
 *     onClose(): void – Modal schließen
 */

import { useState, useEffect, useMemo } from "react";
import { getArticleById } from "../stores/articleStore.js";
import { generateReport, downloadReport, copyReportToClipboard } from "../services/reportService.js";
import { getNvidiaApiKey } from "../stores/settingsStore.js";

// Configuration options
const AUDIENCE_OPTIONS = [
  { value: "geschaeftsfuehrung", label: "Geschäftsführung" },
  { value: "fachabteilung", label: "Fachabteilung" },
  { value: "foerderantrag", label: "Förderantrag-Vorbereitung" },
];

const FOCUS_OPTIONS = [
  { value: "technologie", label: "Technologie" },
  { value: "wettbewerb", label: "Wettbewerb" },
  { value: "foerderpotential", label: "Förderpotential" },
  { value: "allgemein", label: "Allgemein" },
];

const LENGTH_OPTIONS = [
  { value: "kurz", label: "Kurz" },
  { value: "mittel", label: "Mittel" },
  { value: "detail", label: "Detail" },
];

function ReportGenerator({ articleIds, onClose }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);
  
  // Report configuration
  const [config, setConfig] = useState({
    audience: "fachabteilung",
    focus: "allgemein",
    length: "mittel",
    includeUserNotes: true,
  });
  
  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState("");
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Load selected articles
  useEffect(() => {
    const loadArticles = async () => {
      setLoading(true);
      const loaded = [];
      for (const id of articleIds) {
        const article = await getArticleById(id);
        if (article) {
          loaded.push(article);
        }
      }
      setArticles(loaded);
      
      const key = await getNvidiaApiKey();
      setHasApiKey(!!key);
      setLoading(false);
    };
    
    loadArticles();
  }, [articleIds]);

  // Remove article from selection
  const handleRemoveArticle = (articleId) => {
    setArticles(prev => prev.filter(a => a.id !== articleId));
  };

  // Generate report
  const handleGenerate = async () => {
    if (articles.length === 0) return;
    
    setGenerating(true);
    setError(null);
    setReport(null);
    setGeneratingStatus("Report wird generiert, bitte warten...");
    
    try {
      const result = await generateReport({
        articleIds: articles.map(a => a.id),
        ...config,
      });
      setGeneratingStatus("Report fertig!");
      setReport(result);
    } catch (err) {
      setError(err.message || "Report-Generierung fehlgeschlagen");
    } finally {
      setGenerating(false);
      setGeneratingStatus("");
    }
  };

  // Download report
  const handleDownload = () => {
    if (!report) return;
    const filename = `trend-radar-report-${new Date().toISOString().split('T')[0]}.md`;
    downloadReport(report, filename);
  };

  // Copy to clipboard
  const handleCopy = async () => {
    if (!report) return;
    const success = await copyReportToClipboard(report);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Simple markdown to HTML renderer
  const renderMarkdown = (md) => {
    if (!md) return "";
    
    return md
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-5 mb-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Lists
      .replace(/^\- (.*$)/gim, '<li class="ml-4">$1</li>')
      // Line breaks
      .replace(/\n/g, '<br />');
  };

  if (loading) {
    return (
      <div
        className="fixed flex items-center justify-center p-4"
        style={{ zIndex: 9999, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' }}
      >
        <div className="bg-white rounded-lg shadow-xl w-full" style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'hidden' }}>
          <div className="p-8 text-center text-gray-500">Lade Artikel...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed flex items-center justify-center p-4"
      style={{ zIndex: 9999, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#f3f4f6' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full flex flex-col"
        style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Report erstellen</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {report ? (
            // Report result view
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-700">Generierter Report</h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  >
                    {copied ? "Kopiert!" : "Kopieren"}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Als Markdown speichern
                  </button>
                  <button
                    onClick={() => setReport(null)}
                    className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                  >
                    Neu generieren
                  </button>
                </div>
              </div>
              
              <div 
                className="prose max-w-none bg-gray-50 p-4 rounded-lg border border-gray-200"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(report) }}
              />
            </div>
          ) : (
            // Configuration view
            <div className="space-y-6">
              {/* Article Overview */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-3">
                  Ausgewählte Artikel ({articles.length})
                </h3>
                {articles.length === 0 ? (
                  <div className="text-gray-500 text-sm">Keine Artikel ausgewählt.</div>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {articles.map(article => (
                      <div 
                        key={article.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded"
                      >
                        <div className="flex-1 min-w-0 mr-2">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {article.title}
                          </div>
                          <div className="text-xs text-gray-500">
                            {article.source}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveArticle(article.id)}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                          title="Entfernen"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Configuration Form */}
              <div className="space-y-4">
                {/* Audience */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Zielgruppe
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AUDIENCE_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        onClick={() => setConfig(c => ({ ...c, audience: option.value }))}
                        style={{
                          padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                          backgroundColor: config.audience === option.value ? '#2563eb' : '#e5e7eb',
                          color: config.audience === option.value ? '#fff' : '#374151',
                          fontWeight: config.audience === option.value ? 600 : 400,
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Focus */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fokus
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {FOCUS_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        onClick={() => setConfig(c => ({ ...c, focus: option.value }))}
                        style={{
                          padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                          backgroundColor: config.focus === option.value ? '#2563eb' : '#e5e7eb',
                          color: config.focus === option.value ? '#fff' : '#374151',
                          fontWeight: config.focus === option.value ? 600 : 400,
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Length */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Länge
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {LENGTH_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        onClick={() => setConfig(c => ({ ...c, length: option.value }))}
                        style={{
                          padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                          backgroundColor: config.length === option.value ? '#2563eb' : '#e5e7eb',
                          color: config.length === option.value ? '#fff' : '#374151',
                          fontWeight: config.length === option.value ? 600 : 400,
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Include User Notes */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.includeUserNotes}
                    onChange={(e) => setConfig(c => ({ ...c, includeUserNotes: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Eigene Notizen einbeziehen</span>
                </label>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={generating || articles.length === 0 || !hasApiKey}
                style={{
                  width: '100%', padding: '10px 16px', borderRadius: '6px', border: 'none', cursor: generating || articles.length === 0 || !hasApiKey ? 'not-allowed' : 'pointer',
                  backgroundColor: generating || articles.length === 0 || !hasApiKey ? '#d1d5db' : '#7c3aed',
                  color: generating || articles.length === 0 || !hasApiKey ? '#6b7280' : '#fff',
                  fontSize: '14px', fontWeight: 600,
                }}
              >
                {generating 
                  ? generatingStatus || "Report wird generiert..."
                  : !hasApiKey 
                    ? "API-Key in Einstellungen hinterlegen" 
                    : `Report generieren (${articles.length} Artikel)`
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReportGenerator;
