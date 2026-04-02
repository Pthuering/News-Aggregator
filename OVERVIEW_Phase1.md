# Specs ‘«Ù Reihenfolge

Die Specs werden in dieser Reihenfolge abgearbeitet.
Jede Spec ist eigenst+Òndig, setzt aber die vorherigen als implementiert voraus.

## Phase 1: Feed-Ingest (MVP)

| Spec | Aufgabe | Ergebnis |
|------|---------|----------|
| 1a ‘«Ù Project Setup | Vite/React/Tailwind initialisieren | Lauff+Òhige leere App |
| 1b ‘«Ù CORS Proxy | Cloudflare Worker erstellen | Feed-Abruf ohne CORS-Fehler |
| 1c ‘«Ù Config | sources.js + settings.js | Quellen und Einstellungen definiert |
| 1d ‘«Ù Stores | articleStore, projectStore, settingsStore | Datenhaltung funktioniert |
| 1e ‘«Ù Hash Util | SHA-256 Hilfsfunktion | Artikel-IDs erzeugbar |
| 1f ‘«Ù Feed Service | RSS abrufen, parsen, speichern | Feeds werden eingelesen |
| 1g ‘«Ù Wire to UI | Button ‘Â∆ Ingest ‘Â∆ Artikelliste | End-to-End funktioniert |

**Nach Phase 1** kann die App Feeds abrufen, Artikel speichern
und als Liste anzeigen. Noch keine KI-Bewertung.

## Phase 2: Klassifikation (noch nicht ausgearbeitet)

Multi-Lens-Bewertung via Anthropic API, Prompts, Score-Anzeige.

## Phase 3: Filter-UI (noch nicht ausgearbeitet)

Score-Slider, Tag-Filter, Suchfunktion, Ansichten.

## Phase 4: Bookmarks & Reports (noch nicht ausgearbeitet)

Artikel merken, Report-Generierung, Export.

## Phase 5: Projekt-Matching (noch nicht ausgearbeitet)

Interne Projekte pflegen, Synergien erkennen.

## Phase 6: Advanced (noch nicht ausgearbeitet)

Cluster-Erkennung, Trend-Sparklines, F+¬rder-Alerts, Auto-Enrichment.
