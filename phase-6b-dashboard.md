# Spec: Dashboard-Komponente

## Aufgabe
Erstelle ein Dashboard, das Trend-Verläufe, Cluster-Übersicht,
Projekt-Synergien-Zusammenfassung und Buzzing Topics zeigt.

## Kontext
Lies die Header-Blöcke in:
- `src/services/clusterService.js` → getTrendTimeline(), getBuzzingTopics()
- `src/stores/articleStore.js` → getAllArticles()
- `src/stores/projectStore.js` → getProjects()

## Datei

### src/components/Dashboard.jsx

```javascript
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
```

## UI-Bereiche

**1. Statistik-Karten (obere Zeile)**
- Gesamtzahl Artikel
- Davon klassifiziert / unklassifiziert
- Davon mit Synergien
- Artikel diese Woche

**2. Buzzing Topics**
- Top 5-10 Tags mit Häufigkeit und Trend-Pfeil (↑ rising, → stable, ↓ falling)
- Klick auf Tag → wechselt zur Artikelliste mit diesem Tag-Filter
- Zeitraum: letzte 30 Tage

**3. Trend-Sparklines**
- Für die Top 5 Tags: kleine Linien-Charts (Sparklines)
  über die letzten 12 Wochen
- Zeigt visuell, welche Themen zunehmen oder abnehmen
- Implementierung: einfache SVG-Linienzüge oder ein
  leichtgewichtiger Chart (recharts oder reine SVG)

**4. Cluster-Übersicht**
- Gruppierte Artikel-Zählung: "KI im ÖPNV (7 Artikel)",
  "Predictive Maintenance (4 Artikel)"
- Cluster-Name: die häufigsten Tags des Clusters zusammengefügt
- Klick → Artikelliste gefiltert auf diesen Cluster

**5. Synergien pro Projekt**
- Pro aktivem Projekt: Anzahl Artikel mit erkannten Synergien
- Neueste Synergien zuerst (letzte 30 Tage)
- Klick auf Projekt → zeigt zugehörige Artikel

## Akzeptanzkriterien
- [ ] Statistik-Karten zeigen korrekte Zahlen
- [ ] Buzzing Topics werden berechnet und angezeigt
- [ ] Sparklines rendern für Top-Tags
- [ ] Cluster-Übersicht gruppiert korrekt
- [ ] Synergien pro Projekt werden angezeigt
- [ ] Klick-Navigation zu gefilterter Artikelliste funktioniert
- [ ] Dashboard lädt performant (keine langen Wartezeiten)

## Nicht in dieser Spec
- Kein automatisches Refresh (manuell bei Tab-Wechsel)
- Keine konfigurierbaren Zeiträume (fest: 30 Tage / 12 Wochen)
