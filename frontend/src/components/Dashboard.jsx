/**
 * @module Dashboard
 * @purpose Übersichts-Dashboard mit Trends, Clustern, Synergien
 *
 * @reads    services/clusterService.js → Trends, Buzz, Cluster
 * @reads    stores/articleStore.js → Artikel-Statistiken
 * @reads    stores/projectStore.js → Projekt-Liste
 * @calledBy App.jsx → über Navigation/Tab
 *
 * @exports  Dashboard (React Component)
 */

import { useState, useEffect, useMemo } from "react";
import { getAllArticles } from "../stores/articleStore.js";
import { getProjects } from "../stores/projectStore.js";
import { getBuzzingTopics, getTrendTimeline } from "../services/clusterService.js";

// ─── Sparkline (pure SVG) ──────────────────────────────────

function Sparkline({ data, width = 120, height = 32, color = "#3B82F6" }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const step = width / Math.max(data.length - 1, 1);
  const points = data.map((v, i) => `${i * step},${height - (v / max) * (height - 4)}`).join(" ");
  return (
    <svg width={width} height={height} className="inline-block">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}

// ─── Stat Card ─────────────────────────────────────────────

function StatCard({ label, value, sub, color = "blue" }) {
  const colors = {
    blue: "border-blue-400 bg-blue-50",
    purple: "border-purple-400 bg-purple-50",
    green: "border-green-400 bg-green-50",
    amber: "border-amber-400 bg-amber-50",
  };
  return (
    <div className={`rounded-lg border-l-4 p-4 ${colors[color] || colors.blue}`}>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
      {sub !== undefined && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

// ─── Trend Arrow ───────────────────────────────────────────

function TrendArrow({ trend }) {
  if (trend === "rising") return <span className="text-green-600 font-bold">↑</span>;
  if (trend === "falling") return <span className="text-red-500 font-bold">↓</span>;
  return <span className="text-gray-400">→</span>;
}

// ─── Main Component ────────────────────────────────────────

export default function Dashboard({ articles, onNavigate }) {
  const [buzzingTopics, setBuzzingTopics] = useState([]);
  const [sparklineData, setSparklineData] = useState({}); // tag → number[]
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load data on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [buzz, projs] = await Promise.all([
          getBuzzingTopics(30),
          getProjects(),
        ]);
        if (cancelled) return;
        setBuzzingTopics(buzz);
        setProjects(projs);

        // Load sparklines for top 5 tags
        const topTags = buzz.slice(0, 5).map((b) => b.tag);
        const sparklines = {};
        await Promise.all(
          topTags.map(async (tag) => {
            const timeline = await getTrendTimeline(tag, 84); // 12 weeks
            sparklines[tag] = timeline.map((tp) => tp.count);
          })
        );
        if (!cancelled) setSparklineData(sparklines);
      } catch (e) {
        console.error("Dashboard load error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [articles.length]);

  // ─── Computed stats ─────────────────────────────────────

  const stats = useMemo(() => {
    const total = articles.length;
    const classified = articles.filter((a) => a.scores).length;
    const withSynergies = articles.filter((a) => a.synergies && a.synergies.length > 0).length;

    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const thisWeek = articles.filter((a) => new Date(a.published) >= weekAgo).length;

    return { total, classified, unclassified: total - classified, withSynergies, thisWeek };
  }, [articles]);

  // ─── Cluster overview ───────────────────────────────────

  const clusters = useMemo(() => {
    const map = new Map(); // clusterId → { tags, count, articleIds }
    for (const a of articles) {
      if (!a.clusterId) continue;
      if (!map.has(a.clusterId)) {
        map.set(a.clusterId, { id: a.clusterId, tags: new Set(), count: 0, articleIds: [] });
      }
      const c = map.get(a.clusterId);
      c.count++;
      c.articleIds.push(a.id);
      (a.tags || []).forEach((t) => c.tags.add(t));
    }
    return Array.from(map.values())
      .map((c) => ({
        ...c,
        name: [...c.tags].slice(0, 3).join(" / "),
        tags: [...c.tags],
      }))
      .sort((a, b) => b.count - a.count);
  }, [articles]);

  // ─── Synergies per project ──────────────────────────────

  const projectSynergies = useMemo(() => {
    return projects.map((p) => {
      const synArticles = articles.filter(
        (a) => a.synergies && a.synergies.some((s) => s.projectId === p.id)
      );
      return { ...p, synergyCount: synArticles.length };
    }).filter((p) => p.synergyCount > 0)
      .sort((a, b) => b.synergyCount - a.synergyCount);
  }, [articles, projects]);

  // ─── Render ─────────────────────────────────────────────

  if (loading && articles.length === 0) {
    return <div className="text-center text-gray-500 py-12">Dashboard wird geladen…</div>;
  }

  return (
    <div className="space-y-6">
      {/* 1. Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Artikel gesamt" value={stats.total} color="blue" />
        <StatCard
          label="Klassifiziert"
          value={stats.classified}
          sub={stats.unclassified > 0 ? `${stats.unclassified} offen` : "alle fertig"}
          color="purple"
        />
        <StatCard label="Mit Synergien" value={stats.withSynergies} color="green" />
        <StatCard label="Diese Woche" value={stats.thisWeek} color="amber" />
      </div>

      {/* 2 + 3. Buzzing Topics + Sparklines */}
      {buzzingTopics.length > 0 && (
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-base font-semibold text-gray-800 mb-3">Trending Topics (30 Tage)</h3>
          <div className="space-y-2">
            {buzzingTopics.slice(0, 10).map((b) => (
              <div
                key={b.tag}
                className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded px-2 py-1 -mx-2 transition-colors"
                onClick={() => onNavigate && onNavigate({ type: "tag", value: b.tag })}
              >
                <TrendArrow trend={b.trend} />
                <span className="text-sm font-medium text-gray-800 w-40 truncate">{b.tag}</span>
                <span className="text-xs text-gray-500 w-8 text-right">{b.count}×</span>
                {sparklineData[b.tag] && (
                  <Sparkline
                    data={sparklineData[b.tag]}
                    color={b.trend === "rising" ? "#16a34a" : b.trend === "falling" ? "#dc2626" : "#6b7280"}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Cluster-Übersicht */}
      {clusters.length > 0 && (
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-base font-semibold text-gray-800 mb-3">
            Themen-Cluster ({clusters.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {clusters.map((c) => (
              <button
                key={c.id}
                onClick={() => onNavigate && onNavigate({ type: "cluster", value: c.id })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
              >
                {c.name}
                <span className="bg-amber-200 text-amber-900 rounded-full px-1.5 py-0.5 text-xs">
                  {c.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 5. Synergien pro Projekt */}
      {projectSynergies.length > 0 && (
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-base font-semibold text-gray-800 mb-3">Synergien pro Projekt</h3>
          <div className="space-y-2">
            {projectSynergies.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded px-2 py-2 -mx-2 transition-colors"
                onClick={() => onNavigate && onNavigate({ type: "project", value: p.id })}
              >
                <div>
                  <span className="text-sm font-medium text-gray-800">{p.name}</span>
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${p.status === "aktiv" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {p.status}
                  </span>
                </div>
                <span className="text-sm font-semibold text-teal-700">
                  {p.synergyCount} {p.synergyCount === 1 ? "Artikel" : "Artikel"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {stats.total === 0 && (
        <div className="text-center text-gray-500 py-12">
          Noch keine Artikel vorhanden. Starte einen Feed-Abruf im Artikel-Tab.
        </div>
      )}
    </div>
  );
}
