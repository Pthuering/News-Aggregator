/**
 * @module FilterBar
 * @purpose Advanced filtering for classified articles with lens scores, tags, dates
 *
 * @reads    props → filterState
 * @writes   props → onFilterChange(filterState)
 * @calledBy App.jsx → above ArticleList
 *
 * @dataflow User input → filterState → onFilterChange → parent filtering
 *
 * @props
 *   filters: FilterState - Current filter values
 *   onFilterChange: (filters: FilterState) => void - Filter change handler
 *   availableTags: string[] - All unique tags from articles
 *   className?: string - Optional additional CSS classes
 *
 * @errors None - all inputs are controlled
 */

import { useState, useCallback, useEffect } from "react";
import { getProjects } from "../stores/projectStore.js";

// Initial filter state
export const INITIAL_FILTERS = {
  // Text search
  search: "",
  
  // Source category
  category: "all",
  
  // Project filter (synergy-based)
  project: "all",
  
  // Lens score ranges (min/max for each lens)
  scores: {
    oepnv_direkt: { min: 0, max: 10 },
    tech_transfer: { min: 0, max: 10 },
    foerder: { min: 0, max: 10 },
    markt: { min: 0, max: 10 },
  },
  
  // Tags
  tags: [], // selected tags
  tagMatch: "any", // "any" | "all"
  
  // Date range
  dateFrom: "",
  dateTo: "",
  
  // Classification status
  classifiedOnly: false,
  
  // Bookmark filter
  bookmarkedOnly: false,
  
  // Synergy filter
  synergiesOnly: false,

  // Cluster filter (set from Dashboard navigation)
  clusterId: null,
  
  // Sorting
  sortBy: "newest", // "newest" | "oldest" | "relevance" | "score_oepnv" | "score_tech"
};

// Lens configuration for UI - using explicit Tailwind classes (not dynamic!)
const LENSES = [
  { key: "oepnv_direkt", label: "ÖPNV", description: "ÖPNV-Direkt",
    bgClass: "bg-blue-50", borderClass: "border-blue-100", barClass: "bg-blue-500" },
  { key: "tech_transfer", label: "Tech", description: "Technologie-Transfer",
    bgClass: "bg-purple-50", borderClass: "border-purple-100", barClass: "bg-purple-500" },
  { key: "foerder", label: "Förder", description: "Förderlandschaft",
    bgClass: "bg-green-50", borderClass: "border-green-100", barClass: "bg-green-500" },
  { key: "markt", label: "Markt", description: "Wettbewerb & Markt",
    bgClass: "bg-orange-50", borderClass: "border-orange-100", barClass: "bg-orange-500" },
];

// Category labels
const CATEGORY_LABELS = {
  all: "Alle Kategorien",
  branche: "Branche",
  tech: "Tech",
  foerder: "Förderung",
  startup: "Startup",
  international: "International",
};

// Sort options
const SORT_OPTIONS = [
  { value: "newest", label: "Neueste zuerst" },
  { value: "oldest", label: "Älteste zuerst" },
  { value: "relevance", label: "Relevanz (gesamt)" },
  { value: "score_oepnv", label: "Score: ÖPNV" },
  { value: "score_tech", label: "Score: Tech" },
  { value: "score_foerder", label: "Score: Förder" },
  { value: "score_markt", label: "Score: Markt" },
];

function FilterBar({ filters = INITIAL_FILTERS, onFilterChange, availableTags = [], className = "" }) {
  const [expanded, setExpanded] = useState(false);
  const [projects, setProjects] = useState([]);

  // Load projects on mount
  useEffect(() => {
    getProjects().then(setProjects);
  }, []);

  // Helper to update nested score filters
  const updateScoreFilter = useCallback((lens, type, value) => {
    onFilterChange({
      ...filters,
      scores: {
        ...filters.scores,
        [lens]: {
          ...filters.scores[lens],
          [type]: parseInt(value, 10),
        },
      },
    });
  }, [filters, onFilterChange]);

  // Helper to toggle tag selection
  const toggleTag = useCallback((tag) => {
    const currentTags = filters.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    onFilterChange({ ...filters, tags: newTags });
  }, [filters, onFilterChange]);

  // Reset all filters
  const resetFilters = useCallback(() => {
    onFilterChange({ ...INITIAL_FILTERS });
  }, [onFilterChange]);

  // Check if any advanced filters are active
  const hasAdvancedFilters = useCallback(() => {
    return (
      filters.tags?.length > 0 ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.classifiedOnly ||
      filters.bookmarkedOnly ||
      filters.synergiesOnly ||
      filters.clusterId ||
      filters.project !== "all" ||
      Object.values(filters.scores || {}).some(
        (s) => s.min > 0 || s.max < 10
      )
    );
  }, [filters]);

  // Count active filters for badge
  const activeFilterCount = (() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.category !== "all") count++;
    if (filters.tags?.length > 0) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.classifiedOnly) count++;
    if (filters.bookmarkedOnly) count++;
    if (filters.synergiesOnly) count++;
    if (filters.clusterId) count++;
    if (filters.project !== "all") count++;
    if (Object.values(filters.scores || {}).some((s) => s.min > 0 || s.max < 10)) count++;
    return count;
  })();

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Cluster filter banner */}
      {filters.clusterId && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-200 rounded-t-lg">
          <span className="text-sm text-amber-800 font-medium">Gefiltert nach Cluster</span>
          <button
            onClick={() => onFilterChange({ ...filters, clusterId: null })}
            className="text-sm text-amber-700 hover:text-amber-900 font-medium underline"
          >
            Filter aufheben
          </button>
        </div>
      )}
      {/* Basic filters - always visible */}
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap gap-3">
          {/* Search input */}
          <div className="flex-1 min-w-[250px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Suche
            </label>
            <input
              type="text"
              placeholder="Titel, Content, Tags..."
              value={filters.search || ""}
              onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Category filter */}
          <div className="w-40">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Kategorie
            </label>
            <select
              value={filters.category || "all"}
              onChange={(e) => onFilterChange({ ...filters, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Project filter */}
          {projects.length > 0 && (
            <div className="w-48">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Projekt
              </label>
              <select
                value={filters.project || "all"}
                onChange={(e) => onFilterChange({ ...filters, project: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">Alle Projekte</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Sort */}
          <div className="w-44">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Sortierung
            </label>
            <select
              value={filters.sortBy || "newest"}
              onChange={(e) => onFilterChange({ ...filters, sortBy: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Expand/Collapse button */}
          <div className="flex items-end">
            <button
              onClick={() => setExpanded(!expanded)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors flex items-center gap-2"
            >
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                  {activeFilterCount}
                </span>
              )}
              <span className={`transform transition-transform ${expanded ? "rotate-180" : ""}`}>
                ▼
              </span>
            </button>
          </div>
        </div>

        {/* Quick filters row */}
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.classifiedOnly || false}
              onChange={(e) => onFilterChange({ ...filters, classifiedOnly: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Nur klassifizierte</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.bookmarkedOnly || false}
              onChange={(e) => onFilterChange({ ...filters, bookmarkedOnly: e.target.checked })}
              className="w-4 h-4 text-yellow-500 rounded focus:ring-yellow-500"
            />
            <span className="text-sm text-gray-700">Nur gemerkte</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.synergiesOnly || false}
              onChange={(e) => onFilterChange({ ...filters, synergiesOnly: e.target.checked })}
              className="w-4 h-4 rounded focus:ring-teal-500"
              style={{ accentColor: '#0d9488' }}
            />
            <span className="text-sm text-gray-700">Nur mit Synergien</span>
          </label>

          {/* Article counts */}
          {filters.articleCounts && (
            <div className="ml-auto text-sm text-gray-500">
              <span className="font-medium text-gray-700">{filters.articleCounts.filtered}</span>
              {' '}von{' '}
              <span className="font-medium text-gray-700">{filters.articleCounts.total}</span>
              {' '}Artikeln
              {filters.articleCounts.unclassified > 0 && (
                <span className="text-gray-400 ml-1">
                  ({filters.articleCounts.unclassified} unklassifiziert)
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Advanced filters - expandable */}
      {expanded && (
        <div className="border-t border-gray-200 p-4 space-y-6">
          {/* Lens Score Filters */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">
              Relevanz-Scores (0-10)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {LENSES.map((lens) => (
                <div key={lens.key} className={`p-3 ${lens.bgClass} rounded-lg border ${lens.borderClass}`}>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    {lens.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={filters.scores?.[lens.key]?.min || 0}
                      onChange={(e) => updateScoreFilter(lens.key, "min", e.target.value)}
                      className="w-12 px-2 py-1 text-center border border-gray-300 rounded text-sm"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={filters.scores?.[lens.key]?.max || 10}
                      onChange={(e) => updateScoreFilter(lens.key, "max", e.target.value)}
                      className="w-12 px-2 py-1 text-center border border-gray-300 rounded text-sm"
                    />
                  </div>
                  {/* Range slider visualization */}
                  <div className="mt-2 flex gap-0.5">
                    {Array.from({ length: 11 }).map((_, i) => {
                      const min = filters.scores?.[lens.key]?.min || 0;
                      const max = filters.scores?.[lens.key]?.max || 10;
                      const active = i >= min && i <= max;
                      return (
                        <div
                          key={i}
                          className={`flex-1 h-1.5 rounded-sm ${
                            active ? lens.barClass : "bg-gray-200"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tags filter */}
          {availableTags.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-900">Tags</h4>
                <div className="flex items-center gap-2 text-xs">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="tagMatch"
                      value="any"
                      checked={filters.tagMatch !== "all"}
                      onChange={() => onFilterChange({ ...filters, tagMatch: "any" })}
                      className="text-blue-600"
                    />
                    <span>Mindestens einer</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="tagMatch"
                      value="all"
                      checked={filters.tagMatch === "all"}
                      onChange={() => onFilterChange({ ...filters, tagMatch: "all" })}
                      className="text-blue-600"
                    />
                    <span>Alle</span>
                  </label>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => {
                  const isSelected = filters.tags?.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        isSelected
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Date range */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Zeitraum</h4>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={filters.dateFrom || ""}
                onChange={(e) => onFilterChange({ ...filters, dateFrom: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <span className="text-gray-400">bis</span>
              <input
                type="date"
                value={filters.dateTo || ""}
                onChange={(e) => onFilterChange({ ...filters, dateTo: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>

          {/* Reset button */}
          {hasAdvancedFilters() && (
            <div className="pt-2 border-t border-gray-200">
              <button
                onClick={resetFilters}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Alle Filter zurücksetzen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FilterBar;
