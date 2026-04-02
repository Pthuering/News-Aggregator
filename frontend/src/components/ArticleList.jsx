/**
 * @module ArticleList
 * @purpose Display list of articles with basic filtering
 *
 * @reads    articleStore.js → getArticles()
 * @writes   articleStore.js → updateArticle() for bookmarks
 * @calledBy App.jsx → main content area
 *
 * @dataflow Article[] from store → filter → render list
 *
 * @props
 *   articles: EnrichedArticle[] - Articles to display
 *   onSelect: (article: EnrichedArticle) => void - Article selection handler
 *   loading: boolean - Loading state
 *
 * @errors Displays error message if fetch fails
 */

import { useState, useMemo } from "react";

function ArticleList({ articles, onSelect, loading }) {
  const [filter, setFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(articles.map((a) => a.sourceCategory));
    return ["all", ...Array.from(cats)];
  }, [articles]);

  // Filter and sort articles
  const filteredArticles = useMemo(() => {
    let result = [...articles];

    // Text filter
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(lowerFilter) ||
          a.content.toLowerCase().includes(lowerFilter) ||
          a.source.toLowerCase().includes(lowerFilter)
      );
    }

    // Category filter
    if (categoryFilter !== "all") {
      result = result.filter((a) => a.sourceCategory === categoryFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.published) - new Date(a.published);
      } else if (sortBy === "oldest") {
        return new Date(a.published) - new Date(b.published);
      } else if (sortBy === "source") {
        return a.source.localeCompare(b.source);
      }
      return 0;
    });

    return result;
  }, [articles, filter, categoryFilter, sortBy]);

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

  // Get category color
  const getCategoryColor = (cat) => {
    const colors = {
      branche: "bg-blue-100 text-blue-800",
      tech: "bg-purple-100 text-purple-800",
      foerder: "bg-green-100 text-green-800",
      startup: "bg-orange-100 text-orange-800",
      international: "bg-indigo-100 text-indigo-800",
    };
    return colors[cat] || "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Lade Artikel...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-lg">
        <input
          type="text"
          placeholder="Artikel suchen..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Alle Kategorien</option>
          {categories
            .filter((c) => c !== "all")
            .map((cat) => (
              <option key={cat} value={cat}>
                {getCategoryLabel(cat)}
              </option>
            ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="newest">Neueste zuerst</option>
          <option value="oldest">Älteste zuerst</option>
          <option value="source">Nach Quelle</option>
        </select>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-500 px-1">
        {filteredArticles.length} von {articles.length} Artikeln
      </div>

      {/* Article list */}
      <div className="space-y-2">
        {filteredArticles.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Keine Artikel gefunden
          </div>
        ) : (
          filteredArticles.map((article) => (
            <div
              key={article.id}
              onClick={() => onSelect(article)}
              className="p-4 bg-white border border-gray-200 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${getCategoryColor(
                        article.sourceCategory
                      )}`}
                    >
                      {getCategoryLabel(article.sourceCategory)}
                    </span>
                    <span className="text-sm text-gray-500">
                      {article.source}
                    </span>
                    {article.classifiedAt && (
                      <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                        Klassifiziert
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {article.title}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {article.content.substring(0, 200)}
                    {article.content.length > 200 ? "..." : ""}
                  </p>
                  <div className="mt-2 text-xs text-gray-400">
                    {formatDate(article.published)}
                  </div>
                </div>
                {article.bookmarked && (
                  <span className="text-yellow-500 text-lg">★</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ArticleList;
