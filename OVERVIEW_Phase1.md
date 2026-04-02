# Specs – Reihenfolge

Die Specs werden in dieser Reihenfolge abgearbeitet.
Jede Spec ist eigenständig, setzt aber die vorherigen als implementiert voraus.

## Phase 1: Feed-Ingest (MVP)

| Spec | Aufgabe | Ergebnis |
|------|---------|----------|
| 1a – Project Setup | Vite/React/Tailwind initialisieren | Lauffähige leere App |
| 1b – CORS Proxy | Cloudflare Worker erstellen | Feed-Abruf ohne CORS-Fehler |
| 1c – Config | sources.js + settings.js | Quellen und Einstellungen definiert |
| 1d – Stores | articleStore, projectStore, settingsStore | Datenhaltung funktioniert |
| 1e – Hash Util | SHA-256 Hilfsfunktion | Artikel-IDs erzeugbar |
| 1f – Feed Service | RSS abrufen, parsen, speichern | Feeds werden eingelesen |
| 1g – Wire to UI | Button → Ingest → Artikelliste | End-to-End funktioniert |

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

Cluster-Erkennung, Trend-Sparklines, Förder-Alerts, Auto-Enrichment.
