/**
 * @module ArticleDetail
 * @purpose Display full article details with actions
 *
 * @reads    articleStore.js → getArticleById()
 * @writes   articleStore.js → updateArticle() for bookmarks/notes
 * @calledBy App.jsx → when article selected
 *
 * @dataflow Article ID → fetch from store → display details
 *
 * @props
 *   article: EnrichedArticle - Article to display
 *   onClose: () => void - Close handler
 *   onUpdate: (article: EnrichedArticle) => void - Update callback
 *
 * @errors Shows error if article cannot be loaded
 */

import { useState } from "react";
import { updateArticle } from "../stores/articleStore.js";
import { enrichArticle } from "../services/enrichService.js";

/** Minimal markdown → HTML for enrichment text (bold, lists, line breaks) */
function renderMarkdown(md) {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    .replace(/\n{2,}/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}

function ArticleDetail({ article, onClose, onUpdate }) {
  const [notes, setNotes] = useState(article.userNotes || "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [enrichment, setEnrichment] = useState(article.enrichment || null);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichError, setEnrichError] = useState(null);

  // Enrich article with background info
  const handleEnrich = async () => {
    setEnrichLoading(true);
    setEnrichError(null);
    try {
      const text = await enrichArticle(article);
      setEnrichment(text);
      onUpdate({ ...article, enrichment: text });
    } catch (e) {
      console.error("Enrichment failed:", e);
      setEnrichError(e.message);
    } finally {
      setEnrichLoading(false);
    }
  };

  // Toggle bookmark
  const handleBookmark = async () => {
    const updated = { ...article, bookmarked: !article.bookmarked };
    await updateArticle(article.id, { bookmarked: updated.bookmarked });
    onUpdate(updated);
  };

  // Save notes
  const handleSaveNotes = async () => {
    await updateArticle(article.id, { userNotes: notes });
    setIsEditingNotes(false);
    onUpdate({ ...article, userNotes: notes });
  };

  // Format date
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

  // Get category label
  const getCategoryLabel = (cat) => {
    const labels = {
      branche: "Branche",
      tech: "Tech",
      foerder: "Förderung",
      startup: "Startup",
      international: "International",
    };
    return labels[cat] || cat;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
            {getCategoryLabel(article.sourceCategory)}
          </span>
          <span className="text-sm text-gray-500">{article.source}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBookmark}
            className={`p-2 rounded-md transition-colors ${
              article.bookmarked
                ? "text-yellow-500 hover:bg-yellow-50"
                : "text-gray-400 hover:bg-gray-100"
            }`}
            title={article.bookmarked ? "Lesezeichen entfernen" : "Lesezeichen setzen"}
          >
            <span className="text-xl">★</span>
          </button>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Original öffnen
          </a>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">{article.title}</h2>

        <div className="text-sm text-gray-500">
          Veröffentlicht: {formatDate(article.published)}
          <br />
          Abgerufen: {formatDate(article.fetchedAt)}
        </div>

        {/* Classification scores if available */}
        {article.scores && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-700 mb-2">Bewertung</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-sm">
                  <span>ÖPNV-Relevanz</span>
                  <span className="font-medium">{article.scores.oepnv_direkt}/10</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${article.scores.oepnv_direkt * 10}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <span>Tech-Transfer</span>
                  <span className="font-medium">{article.scores.tech_transfer}/10</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full"
                    style={{ width: `${article.scores.tech_transfer * 10}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <span>Förderrelevanz</span>
                  <span className="font-medium">{article.scores.foerder}/10</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${article.scores.foerder * 10}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <span>Marktrelevanz</span>
                  <span className="font-medium">{article.scores.markt}/10</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-orange-600 h-2 rounded-full"
                    style={{ width: `${article.scores.markt * 10}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {article.tags && article.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {article.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {article.summary_de && (
              <div className="mt-3 text-sm text-gray-600">
                <strong>Zusammenfassung:</strong> {article.summary_de}
              </div>
            )}
          </div>
        )}

        {/* Enrichment / Mehr Kontext */}
        <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-indigo-800">Kontext & Hintergrund</h3>
            <button
              onClick={handleEnrich}
              disabled={enrichLoading}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {enrichLoading ? "Wird geladen…" : enrichment ? "Kontext aktualisieren" : "Mehr Kontext"}
            </button>
          </div>
          {enrichError && (
            <div className="text-sm text-red-600 mb-2">Fehler: {enrichError}</div>
          )}
          {enrichment ? (
            <div className="text-sm text-gray-700 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(enrichment) }} />
          ) : (
            <p className="text-sm text-indigo-400 italic">Klicke "Mehr Kontext" um Hintergrund-Infos zu Unternehmen, Technologien und Abkürzungen zu erhalten.</p>
          )}
        </div>

        {/* Article content */}
        <div className="prose max-w-none">
          <p className="text-gray-700 whitespace-pre-wrap">{article.content}</p>
        </div>

        {/* User notes */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-700">Meine Notizen</h3>
            {!isEditingNotes && (
              <button
                onClick={() => setIsEditingNotes(true)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {article.userNotes ? "Bearbeiten" : "Hinzufügen"}
              </button>
            )}
          </div>

          {isEditingNotes ? (
            <div className="space-y-2">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notizen zu diesem Artikel..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveNotes}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Speichern
                </button>
                <button
                  onClick={() => {
                    setNotes(article.userNotes || "");
                    setIsEditingNotes(false);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <div className="text-gray-600">
              {article.userNotes ? (
                <p className="whitespace-pre-wrap">{article.userNotes}</p>
              ) : (
                <p className="text-gray-400 italic">Keine Notizen</p>
              )}
            </div>
          )}
        </div>

        {/* Synergies if available */}
        {article.synergies && article.synergies.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <h3 className="font-semibold text-gray-700 mb-2">Projekt-Synergien</h3>
            <div className="space-y-2">
              {article.synergies.map((synergy, idx) => (
                <div key={idx} className="p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-green-900">
                      {synergy.projectName}
                    </span>
                    <span className="text-sm text-green-700">
                      Relevanz: {synergy.score}/10
                    </span>
                  </div>
                  <p className="text-sm text-green-800 mt-1">{synergy.relevance}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ArticleDetail;
