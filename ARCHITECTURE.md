# Trend Radar – Architektur

## Was ist das?

Ein persönliches Tool für den Leiter Digitalisierung eines ÖPNV-Unternehmens.
Aggregiert Fachquellen (RSS-Feeds), bewertet sie per KI auf Relevanz,
und unterstützt beim Erstellen von Reports und dem Erkennen von Synergien
mit internen Projekten.

Läuft komplett im Browser. Kein Backend. GitHub Pages als Hosting.
Daten leben in IndexedDB. LLM-Calls gehen client-seitig an die NVIDIA API via Cloudflare Proxy.

## Tech-Stack

- **Frontend**: React (Vite), Tailwind CSS
- **Daten**: IndexedDB via `idb`-Library
- **LLM**: NVIDIA API (via Cloudflare Workers Proxy), client-seitig
- **RSS-Proxy**: Cloudflare Worker (löst CORS-Problem)
- **Hosting**: GitHub Pages (statisch)
- **Build**: Vite → dist/ → GitHub Pages Deploy

## Datenfluss

```
[RSS-Feeds] → CORS-Proxy → feedService → RawArticle[]
                                              ↓
                                      classifyService → ClassifiedArticle[]
                                              ↓
                                       matchService → EnrichedArticle[]
                                              ↓
                                        articleStore (IndexedDB)
                                              ↓
                                    UI (Filter, Liste, Detail)
                                              ↓
                                  reportService → Markdown-Report
```

Jeder Schritt wird manuell per Button ausgelöst, nicht automatisch.

## Zentrale Datenmodelle

### RawArticle
```
{
  id: string,              // SHA-256(url)
  title: string,
  url: string,
  source: string,          // Quellname aus sources.js
  sourceCategory: string,  // "branche"|"tech"|"foerder"|"startup"|"international"
  published: string,       // ISO-8601
  content: string,         // max 4000 Zeichen (optimiert + truncated)
  fetchedAt: string        // ISO-8601
}
```

### ClassifiedArticle (erweitert RawArticle)
```
{
  ...RawArticle,
  scores: {
    oepnv_direkt: number,    // 0-10
    tech_transfer: number,   // 0-10
    foerder: number,         // 0-10
    markt: number            // 0-10
  },
  tags: string[],            // max 5 Themen-Tags
  summary_de: string,        // 2-3 Sätze, deutsch
  reasoning: string,         // Begründung der Scores
  classifiedAt: string       // ISO-8601
}
```

### EnrichedArticle (erweitert ClassifiedArticle)
```
{
  ...ClassifiedArticle,
  synergies: SynergyMatch[],
  clusterId: string | null,
  bookmarked: boolean,
  userNotes: string | null
}
```

### SynergyMatch
```
{
  projectId: string,
  projectName: string,
  relevance: string,         // 1-2 Sätze Begründung
  score: number              // 0-10
}
```

### SourceConfig
```
{
  id: string,
  name: string,
  url: string,
  type: "rss",               // später: "scrape" | "api"
  category: string,          // "branche"|"tech"|"foerder"|"startup"|"international"
  active: boolean
}
```

### ProjectConfig
```
{
  id: string,
  name: string,
  description: string,       // 3-5 Sätze
  technologies: string[],
  status: "aktiv" | "geplant" | "abgeschlossen",
  challenges: string[]
}
```

### ReportConfig
```
{
  audience: "geschaeftsfuehrung" | "fachabteilung" | "foerderantrag",
  focus: "technologie" | "wettbewerb" | "foerderpotential" | "allgemein",
  length: "kurz" | "mittel" | "detail",
  articleIds: string[],
  includeUserNotes: boolean
}
```

## Datei-Header-Konvention

Jede Quelldatei beginnt mit einem strukturierten Kommentarblock.
Dieser Block ist die einzige Dokumentation, die der Entwickler (oder Agent)
braucht, um die Datei zu verstehen und korrekt zu ändern.

```javascript
/**
 * @module modulName
 * @purpose Was diese Datei tut (1 Satz)
 *
 * @reads    datei.js → was genau gelesen wird
 * @writes   datei.js → was genau geschrieben wird
 * @calledBy datei.js → welche Funktion ruft dieses Modul auf
 * @calls    datei.js → welche Module werden von hier aufgerufen
 *
 * @dataflow Kurzbeschreibung: Input → Verarbeitung → Output
 *
 * @exports
 *   functionName(param: Type): ReturnType – Was sie tut
 *
 * @errors Wie Fehler behandelt werden
 */
```

Die Datenmodelle aus diesem Dokument sind die Referenz für alle Typen.
Wenn eine Datei ein Datenmodell nutzt, reicht im Header der Verweis
auf den Modellnamen (z.B. "RawArticle" statt das ganze Schema).

## Ordnerstruktur

```
trend-radar/
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── ArticleList.jsx
│   │   │   ├── FilterBar.jsx
│   │   │   ├── ArticleDetail.jsx
│   │   │   ├── ReportGenerator.jsx
│   │   │   ├── ProjectManager.jsx
│   │   │   └── Settings.jsx
│   │   ├── services/
│   │   │   ├── feedService.js
│   │   │   ├── classifyService.js
│   │   │   ├── matchService.js
│   │   │   ├── clusterService.js    (Phase 6)
│   │   │   ├── reportService.js
│   │   │   └── enrichService.js     (Phase 6)
│   │   ├── stores/
│   │   │   ├── articleStore.js
│   │   │   ├── projectStore.js
│   │   │   └── settingsStore.js
│   │   ├── config/
│   │   │   ├── sources.js
│   │   │   ├── prompts.js
│   │   │   └── settings.js
│   │   └── utils/
│   │       └── hash.js
│   ├── index.html
│   └── vite.config.js
├── worker/
│   └── cors-proxy.js               (Cloudflare Worker)
├── docs/
│   ├── ARCHITECTURE.md              (dieses Dokument)
│   └── specs/
│       ├── phase-1-project-setup.md
│       ├── phase-1-cors-proxy.md
│       ├── phase-1-feed-ingest.md
│       └── ...
└── README.md
```
