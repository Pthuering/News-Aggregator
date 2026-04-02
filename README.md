# Trend Radar - News Aggregator

Ein persönliches Tool für den Leiter Digitalisierung eines ÖPNV-Unternehmens.
Aggregiert Fachquellen (RSS-Feeds), bewertet sie per KI auf Relevanz,
und unterstützt beim Erstellen von Reports und dem Erkennen von Synergien
mit internen Projekten.

## Features

- **RSS Feed Aggregation**: Sammelt Artikel aus verschiedenen Quellen (Branche, Tech, Förderung, Startup, International)
- **KI-Klassifizierung**: Bewertet Artikel nach ÖPNV-Relevanz, Tech-Transfer, Förderrelevanz und Marktrelevanz
- **Projekt-Matching**: Findet Synergien zwischen Artikeln und internen Projekten
- **Report-Generierung**: Erstellt Markdown-Reports für verschiedene Zielgruppen
- **Lokale Datenspeicherung**: Alle Daten bleiben im Browser (IndexedDB)

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS
- **Daten**: IndexedDB via `idb`-Library
- **LLM**: Anthropic API (Claude), client-seitig
- **RSS-Proxy**: Cloudflare Worker (löst CORS-Problem)
- **Hosting**: GitHub Pages (statisch)

## Projektstruktur

```
trend-radar/
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Hauptkomponente
│   │   ├── components/
│   │   │   ├── ArticleList.jsx     # Artikelliste mit Filter
│   │   │   ├── ArticleDetail.jsx   # Artikeldetailansicht
│   │   │   ├── Settings.jsx        # Einstellungen & API-Key
│   │   │   └── ProjectManager.jsx  # Projektverwaltung
│   │   ├── services/
│   │   │   ├── feedService.js      # RSS Feed Abruf
│   │   │   ├── classifyService.js  # KI-Klassifizierung
│   │   │   ├── matchService.js     # Projekt-Matching
│   │   │   └── reportService.js    # Report-Generierung
│   │   ├── stores/
│   │   │   ├── articleStore.js     # IndexedDB für Artikel
│   │   │   ├── projectStore.js     # IndexedDB für Projekte
│   │   │   └── settingsStore.js    # IndexedDB für Einstellungen
│   │   ├── config/
│   │   │   ├── sources.js          # RSS Quellen-Konfiguration
│   │   │   ├── settings.js         # App-Einstellungen
│   │   │   └── prompts.js          # LLM Prompts
│   │   └── utils/
│   │       └── hash.js             # SHA-256 Hashing
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
├── worker/
│   └── cors-proxy.js               # Cloudflare Worker für CORS
├── docs/
│   ├── ARCHITECTURE.md             # Architekturdokumentation
│   └── OVERVIEW_Phase1.md          # Phasen-Übersicht
└── README.md
```

## Installation & Entwicklung

### 1. Repository klonen

```bash
git clone https://github.com/Pthuering/News-Aggregator.git
cd News-Aggregator/frontend
```

### 2. Abhängigkeiten installieren

```bash
npm install
```

### 3. Entwicklungsserver starten

```bash
npm run dev
```

Die App ist dann unter `http://localhost:5173` verfügbar.

### 4. Build erstellen

```bash
npm run build
```

Der Build wird im `dist/`-Ordner erstellt.

## CORS Proxy einrichten

Da RSS-Feeds CORS-Header blockieren, wird ein Proxy benötigt:

### Option A: Cloudflare Worker (empfohlen)

1. [Cloudflare Workers](https://workers.cloudflare.com/) Konto erstellen
2. Neuer Worker mit dem Code aus `worker/cors-proxy.js`
3. Worker deployen und URL kopieren
4. In `frontend/src/config/settings.js` die `corsProxy.url` aktualisieren

### Option B: Lokal für Entwicklung

Für die Entwicklung können Sie einen lokalen Proxy verwenden oder Test-Feeds mocken.

## NVIDIA API Key einrichten

1. Konto bei [Anthropic](https://www.anthropic.com/) erstellen
2. API-Key generieren
3. In der App unter "Einstellungen" eintragen

Der API-Key wird ausschließlich lokal im Browser gespeichert.

## Datenmodelle

### RawArticle
```javascript
{
  id: string,              // SHA-256(url)
  title: string,
  url: string,
  source: string,
  sourceCategory: string,
  published: string,       // ISO-8601
  content: string,
  fetchedAt: string
}
```

### ClassifiedArticle (erweitert RawArticle)
```javascript
{
  ...RawArticle,
  scores: {
    oepnv_direkt: number,
    tech_transfer: number,
    foerder: number,
    markt: number
  },
  tags: string[],
  summary_de: string,
  reasoning: string,
  classifiedAt: string
}
```

### ProjectConfig
```javascript
{
  id: string,
  name: string,
  description: string,
  technologies: string[],
  status: "aktiv" | "geplant" | "abgeschlossen",
  challenges: string[]
}
```

## Deployment

### GitHub Pages

1. Build erstellen: `npm run build`
2. `dist`-Ordner auf GitHub Pages deployen
3. Oder mit GitHub Actions automatisieren

## Lizenz

MIT License - siehe LICENSE Datei
