# Spec: Cluster-Service (Duplikat- und Trend-Erkennung)

## Aufgabe
Erstelle den Service, der ähnliche Artikel gruppiert und
Trend-Häufungen erkennt.

## Kontext
Lies die Datenmodelle `ClassifiedArticle` in `/docs/ARCHITECTURE.md`.
Lies den Header-Block in:
- `src/stores/articleStore.js` → updateArticle() (clusterId)

## Datei

### src/services/clusterService.js

```javascript
/**
 * @module clusterService
 * @purpose Gruppiert ähnliche Artikel, erkennt Trend-Häufungen
 *
 * @reads    stores/articleStore.js → getAllArticles()
 * @writes   stores/articleStore.js → updateArticle() (clusterId)
 * @calledBy App.jsx → nach Klassifikation, oder separat
 *
 * @dataflow
 *   Alle klassifizierten Artikel laden → Tags + Titles vergleichen
 *   → Ähnliche Artikel zu Clustern gruppieren → clusterIds zuweisen
 *
 * @exports
 *   clusterArticles(): Promise<ClusterResult>
 *     → ClusterResult: { clusters: Cluster[], unclustered: number }
 *
 *   getTrendTimeline(tag: string, days: number): TrendPoint[]
 *     → Zählt Tag-Häufigkeit pro Woche über Zeitraum
 *     → TrendPoint: { week: string, count: number }
 *
 *   getBuzzingTopics(days: number): BuzzTopic[]
 *     → Tags die im Zeitraum überdurchschnittlich oft vorkommen
 *     → BuzzTopic: { tag: string, count: number, trend: "rising"|"stable"|"falling" }
 */
```

## Clustering-Ansatz (ohne Embeddings)

Statt Embedding-Similarity (die einen API-Call pro Artikel
bräuchte) nutzen wir Tag-basiertes Clustering:

1. Alle klassifizierten Artikel laden
2. Jaccard-Similarity auf den Tag-Sets berechnen:
   `intersection(tagsA, tagsB).size / union(tagsA, tagsB).size`
3. Schwellenwert: >= 0.5 → gleicher Cluster
4. Zusätzlich: Title-Similarity über Wort-Overlap (normalisiert)
5. Artikel zum Cluster mit der höchsten Similarity zuordnen
6. Cluster-ID: `cluster_` + Hash der sortierten Tags des Clusters

Dieser Ansatz ist kostenlos (keine API-Calls), schnell, und
für den Anwendungsfall ausreichend. Embedding-basiertes Clustering
kann später als Upgrade ergänzt werden.

## Trend-Timeline

`getTrendTimeline(tag, days)`:
1. Alle Artikel der letzten `days` Tage laden
2. Nach Kalenderwochen gruppieren
3. Pro Woche zählen: wie viele Artikel haben diesen Tag?
4. Array von `{ week: "2026-W14", count: 3 }` zurückgeben

## Buzzing Topics

`getBuzzingTopics(days)`:
1. Alle Tags der letzten `days` Tage zählen
2. Durchschnittliche Häufigkeit pro Tag berechnen
3. Tags die > 2x Durchschnitt liegen → "rising"
4. Sortiert nach Count absteigend

## Akzeptanzkriterien
- [ ] Tag-basiertes Clustering funktioniert
- [ ] Ähnliche Artikel bekommen gleiche clusterId
- [ ] `getTrendTimeline()` liefert korrekte Wochen-Zählung
- [ ] `getBuzzingTopics()` identifiziert häufige Tags
- [ ] Kein API-Call nötig (rein client-seitige Berechnung)

## Nicht in dieser Spec
- Keine Embedding-basierte Similarity
- Keine UI (nächste Spec)
