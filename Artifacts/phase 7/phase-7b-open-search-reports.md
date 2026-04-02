# Spec: Offene KI-Suche & Themen-Reports (Phase 7)

## Zusammenfassung
Ein freies Textfeld zur Eingabe beliebiger Suchbegriffe, Events oder Themen, über die die KI automatisch recherchiert und einen strukturierten Report erstellt.

## Use Cases
- Messen & Events: "IAA Mobility 2024", "Smart City Expo", "CES 2025"
- Technologie-Trends: "LiDAR Sensoren ÖPNV", "autonomes Fahren Busse"
- Förderprogramme: "IPCEI Microelectronics", "EU Green Deal Transport"
- Wettbewerbsanalysen: "MobiData BW", "VMM Hamburg"

## Features / Stichpunkte

### 7b-1 - Suchinterface
- [ ] Großes Freitext-Eingabefeld
- [ ] Beispiel-Buttons für häufige Suchen
- [ ] Historie der letzten Suchanfragen
- [ ] Suchanfragen speichern/bookmarken
- [ ] Option: "Nur aktuelle Artikel" (letzte 30/90/365 Tage)

### 7b-2 - KI-gestützte Recherche
- [ ] KI durchsucht alle vorhandenen Artikel nach Relevanz
- [ ] Option: Live-Web-Suche durch KI (externe Quellen)
- [ ] Automatische Quellenerkennung & -validierung
- [ ] Deduplizierung ähnlicher Ergebnisse
- [ ] Priorisierung nach Aktualität & Relevanz

### 7b-3 - Quellenverwaltung
- [ ] Gefundene Quellen werden automatisch gespeichert
- [ ] Link-Archiv mit Metadaten (Titel, Datum, Excerpt)
- [ ] Quellen können manuell hinzugefügt/entfernt werden
- [ ] Import von Links (CSV, Text-Liste)
- [ ] Export der Quellenliste (BibTeX, RIS, CSV)

### 7b-4 - Report-Generierung
- [ ] Automatische Zusammenfassung aller Findings
- [ ] Strukturierter Aufbau:
  - Executive Summary (2-3 Sätze)
  - Hauptthemen & Trends
  - Wichtige Akteure / Unternehmen
  - Zeitliche Entwicklung
  - Fazit & Handlungsempfehlungen
- [ ] Optionale Abschnitte je nach Thema:
  - Technische Details
  - Fördermöglichkeiten
  - Wettbewerbsanalyse
  - Rechtliche Aspekte

### 7b-5 - Interaktive Detailansicht
- [ ] Klick auf Referenz öffnet Original-Artikel
- [ ] Inline-Preview der Quelle (Titel + Kurzbeschreibung)
- [ ] Notizen zu einzelnen Quellen möglich
- [ ] Bewertung der Relevanz (Sterne/Score)
- [ ] Quellen zu Themen-Clustern gruppieren

### 7b-6 - Report-Export & -Teilen
- [ ] Markdown Export
- [ ] PDF Export (formatiert)
- [ ] Word/DOCX Export
- [ ] Shareable Link (öffentlich oder passwortgeschützt)
- [ ] Email-Versand des Reports

### 7b-7 - Fortgeschrittene Features
- [ ] Monitoring: Automatische Updates bei neuen Artikeln zum Thema
- [ ] Alert-Funktion: Benachrichtigung bei relevanten Neuigkeiten
- [ ] Vergleichs-Reports: Zwei Themen gegenüberstellen
- [ ] Zeitstrahl: Chronologische Darstellung der Entwicklung
- [ ] Netzwerk-Graph: Verbindungen zwischen Akteuren erkennen

## Datenmodelle (Vorschlag)

### OpenSearchQuery
```javascript
{
  id: string,
  query: string,              // Suchbegriff(e)
  createdAt: string,          // ISO-8601
  filters: {
    dateRange: { from: string, to: string },
    sources: string[],        // RSS-Quellen IDs
    minRelevance: number      // 0-10
  },
  status: "running" | "completed" | "failed",
  results: SearchResult[]
}
```

### SearchResult
```javascript
{
  id: string,
  queryId: string,
  title: string,
  url: string,
  source: string,             // RSS-Quelle oder "web"
  published: string,
  summary: string,            // KI-generierte Zusammenfassung
  relevanceScore: number,     // 0-10
  userNotes: string | null,
  bookmarks: string[]         // Tags/Kategorien
}
```

## Nicht in dieser Phase
- Keine Echtzeit-Suche (nur tägliche Updates)
- Keine Bild-/Video-Analyse (nur Text)
- Keine automatische Fact-Checking
- Keine Mehrsprachigkeit (zunächst nur Deutsch/Englisch)

## Abhängigkeiten
- Phase 1 (Feed-Ingest, Stores)
- Phase 2 (KI-Klassifizierung)
- Phase 4 (Report-Generierung)
