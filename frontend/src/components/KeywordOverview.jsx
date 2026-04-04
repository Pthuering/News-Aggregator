import { useState, useEffect, useMemo } from "react";
import { buildCrossReferenceIndex } from "../utils/keywordUtils.js";

/**
 * KeywordOverview – cross-reference table showing keywords across articles, projects, and LVB.
 *
 * @param {Object} props
 * @param {Array} props.articles - all articles (used to trigger refresh)
 * @param {Function} props.onArticleClick - callback when clicking an article reference
 */
export default function KeywordOverview({ articles, onArticleClick }) {
  const [index, setIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [sortBy, setSortBy] = useState("total"); // total | articles | projects | keyword
  const [sourceFilter, setSourceFilter] = useState("all"); // all | cross | articles | projects

  // Build index on mount or when articles change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    buildCrossReferenceIndex().then((idx) => {
      if (!cancelled) {
        setIndex(idx);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [articles?.length]);

  // Convert Map to sorted/filtered array
  const rows = useMemo(() => {
    if (!index) return [];

    let entries = Array.from(index.entries()).map(([keyword, refs]) => ({
      keyword,
      articleCount: refs.articles.length,
      projectCount: refs.projects.length,
      lvbCount: refs.lvb.length,
      total: refs.articles.length + refs.projects.length + refs.lvb.length,
      isCrossRef: (refs.articles.length > 0 && refs.projects.length > 0) ||
                  (refs.articles.length > 0 && refs.lvb.length > 0) ||
                  (refs.projects.length > 0 && refs.lvb.length > 0),
      refs,
    }));

    // Text filter
    if (filter) {
      const lf = filter.toLowerCase();
      entries = entries.filter((e) => e.keyword.includes(lf));
    }

    // Source filter
    if (sourceFilter === "cross") {
      entries = entries.filter((e) => e.isCrossRef);
    } else if (sourceFilter === "articles") {
      entries = entries.filter((e) => e.articleCount > 0);
    } else if (sourceFilter === "projects") {
      entries = entries.filter((e) => e.projectCount > 0);
    }

    // Sort
    entries.sort((a, b) => {
      if (sortBy === "keyword") return a.keyword.localeCompare(b.keyword);
      if (sortBy === "articles") return b.articleCount - a.articleCount;
      if (sortBy === "projects") return b.projectCount - a.projectCount;
      return b.total - a.total;
    });

    return entries;
  }, [index, filter, sortBy, sourceFilter]);

  // Summary stats
  const stats = useMemo(() => {
    if (!rows.length) return null;
    const allEntries = index ? Array.from(index.values()) : [];
    const crossRefCount = allEntries.filter(
      (r) =>
        (r.articles.length > 0 && r.projects.length > 0) ||
        (r.articles.length > 0 && r.lvb.length > 0) ||
        (r.projects.length > 0 && r.lvb.length > 0)
    ).length;
    return {
      total: index?.size || 0,
      crossRef: crossRefCount,
      shown: rows.length,
    };
  }, [index, rows]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        Keyword-Index wird aufgebaut...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      {stats && (
        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-6 text-sm text-gray-600">
          <span><span className="font-semibold text-gray-900">{stats.total}</span> Keywords gesamt</span>
          <span style={{ color: '#0d9488' }}>
            <span className="font-semibold">{stats.crossRef}</span> Kreuzreferenzen
          </span>
          {stats.shown !== stats.total && (
            <span><span className="font-semibold">{stats.shown}</span> angezeigt</span>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Keyword suchen..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md"
        >
          <option value="all">Alle Quellen</option>
          <option value="cross">Nur Kreuzreferenzen</option>
          <option value="articles">Mit Artikeln</option>
          <option value="projects">Mit Projekten</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md"
        >
          <option value="total">Sortieren: Gesamt</option>
          <option value="articles">Sortieren: Artikel</option>
          <option value="projects">Sortieren: Projekte</option>
          <option value="keyword">Sortieren: A-Z</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Keyword
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Artikel
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Projekte
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                LVB
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Keine Keywords gefunden
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.keyword}
                  className="hover:bg-gray-50"
                  style={row.isCrossRef ? { backgroundColor: '#f0fdfa' } : {}}
                >
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">
                    {row.isCrossRef && (
                      <span className="mr-1" title="Kreuzreferenz">🔗</span>
                    )}
                    {row.keyword}
                  </td>
                  <td className="px-4 py-2 text-center text-sm text-gray-600">
                    {row.articleCount > 0 ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                        {row.articleCount}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center text-sm text-gray-600">
                    {row.projectCount > 0 ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">
                        {row.projectCount}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center text-sm text-gray-600">
                    {row.lvbCount > 0 ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                        {row.lvbCount}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
