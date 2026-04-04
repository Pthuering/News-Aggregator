# Spec: Automatische LVB-Wissensbasis

## Aufgabe
Erstelle eine automatisch per Websuche gefüllte Wissensbasis über
öffentlich bekannte LVB-Projekte, Technologien und Initiativen.
Diese wird bei jeder Artikel-Klassifizierung als Kontext in den
Prompt injiziert, damit die KI einordnen kann, ob eine Technologie
bei der LVB bereits eingesetzt wird oder neu wäre.

## Kontext
Lies die Header-Blöcke in:
- `src/services/classifyService.js` → classifyNew(), classifyBatch()
- `src/config/prompts.js` → getClassifyPrompt()
- `src/stores/articleStore.js` → Datenmodell EnrichedArticle
- `src/stores/projectStore.js` → manueller Projektspeicher (Phase 5)

Lies `EnrichedArticle` und `ProjectStore` in `ARCHITECTURE.md`.

## Abhängigkeiten
- **Phase 7b** (Open Search): Liefert Web-Recherche-Infrastruktur
  (Websuche, Parsing, Deduplizierung). Muss zuerst implementiert sein.
- **Phase 5** (Projektspeicher): Bestehender manueller Store — bleibt
  getrennt, wird NICHT ersetzt.

## Dateien

### src/stores/lvbKnowledgeStore.js – NEU

```javascript
/**
 * @module lvbKnowledgeStore
 * @purpose Persistiert automatisch recherchierte LVB-Projekt-Informationen
 *
 * @reads    nichts
 * @writes   IndexedDB → lvbKnowledge Store
 * @calledBy services/lvbResearchService.js → speichert Ergebnisse
 * @calledBy services/classifyService.js → liest Kontext für Prompts
 *
 * @exports
 *   initLVBStore(): Promise<void>
 *   getAllLVBKnowledge(): Promise<LVBKnowledgeEntry[]>
 *   saveLVBKnowledge(entries: LVBKnowledgeEntry[]): Promise<void>
 *   clearLVBKnowledge(): Promise<void>
 *   getLVBContextForPrompt(): Promise<string>
 *     → Komprimierter Text (max 2000 Tokens) für Prompt-Injektion
 */
```

**Datenmodell `LVBKnowledgeEntry`:**
```javascript
{
  id: string,              // Hash aus Titel + Quelle
  title: string,           // Projektname / Thema
  summary: string,         // 1-2 Sätze Key Facts
  source: string,          // URL der Quelle
  category: string,        // "digitalisierung" | "mobilität" | "infrastruktur" | "innovation"
  technologies: string[],  // z.B. ["GTFS", "Echtzeitdaten", "E-Bus"]
  status: string,          // "aktiv" | "abgeschlossen" | "geplant" | "unbekannt"
  discoveredAt: string,    // ISO-Datum der Recherche
  updatedAt: string        // ISO-Datum der letzten Aktualisierung
}
```

### src/services/lvbResearchService.js – NEU

```javascript
/**
 * @module lvbResearchService
 * @purpose Recherchiert automatisch LVB-Projekte per Websuche
 *
 * @reads    config/settings.js → Suchbegriffe, API-Config
 * @writes   stores/lvbKnowledgeStore.js → saveLVBKnowledge()
 * @calledBy App.jsx → manueller Button "LVB-Wissen aktualisieren"
 *
 * @dataflow
 *   Konfigurierte Suchbegriffe → Websuche (via Phase 7b Infrastruktur)
 *   → Ergebnisse parsen → KI-Zusammenfassung der Key Facts
 *   → Deduplizierung gegen bestehende Einträge → Store speichern
 *
 * @exports
 *   refreshLVBKnowledge(): Promise<{ found: number, new: number, updated: number }>
 */
```

**Suchbegriffe** (konfigurierbar in `src/config/settings.js`):
```javascript
export const LVB_SEARCH_QUERIES = [
  "LVB Leipzig Digitalisierung",
  "Leipziger Verkehrsbetriebe Projekt",
  "LVB Innovation Mobilität",
  "LVB E-Bus Elektrobus",
  "LVB Ticketing App",
  "LVB Fahrgastinformation Echtzeit",
];
```

**Aktualisierung**: Manuell per Button in den Einstellungen oder
in der Hauptansicht. Kein automatischer Hintergrund-Cron.

### src/services/classifyService.js – erweitern

```javascript
/**
 * @module classifyService
 * @purpose Klassifiziert Artikel mit Multi-Lens-Scoring
 *
 * @reads    config/prompts.js → getClassifyPrompt()
 * @reads    stores/lvbKnowledgeStore.js → getLVBContextForPrompt()  ← NEU
 * @reads    stores/articleStore.js → getUnclassifiedArticles()
 * @writes   stores/articleStore.js → updateArticle()
 *
 * @exports
 *   classifyNew(onProgress): Promise<ClassifyResult>
 *     → Injiziert jetzt automatisch LVB-Kontext in jeden Classify-Prompt
 */
```

**Änderung in `classifyBatch()`:**
```
const lvbContext = await getLVBContextForPrompt();
const systemPrompt = getClassifyPrompt(lvbContext);
```

### src/config/prompts.js – erweitern

`getClassifyPrompt()` Signatur erweitern:

```javascript
/**
 * @exports
 *   getClassifyPrompt(lvbContext?: string): string
 *     → Wenn lvbContext vorhanden: Abschnitt wird an Prompt angehängt
 */
```

**Neuer Prompt-Abschnitt** (nur wenn `lvbContext` nicht leer):
> **LVB-KONTEXT (Bekannte Projekte & Technologien bei der LVB):**
> {lvbContext}
>
> Berücksichtige diesen Kontext bei der Bewertung. Erwähne im
> reasoning, wenn eine Technologie bei der LVB bereits
> eingesetzt wird oder geplant ist.

### src/stores/articleStore.js – Datenmodell erweitern

`EnrichedArticle` bekommt optionales Feld:
```javascript
{
  // ... bestehende Felder ...
  lvb_status: string | null  // "bereits_umgesetzt" | "in_planung" | "neu" | null
}
```

Die KI soll dieses Feld im Klassifizierungs-Output mitliefern.

## Keyword-Integration
- `technologies[]` im LVBKnowledgeEntry werden bei Speicherung via
  `normalizeKeywords()` aus `keywordUtils.js` (Phase 5b) normalisiert
- `buildCrossReferenceIndex()` liest LVB-Technologies automatisch mit
  → LVB-Keywords erscheinen in der Keyword-Übersicht (Phase 5c)
- Ermöglicht Overlay-Erkennung: Artikel-Tags ↔ LVB-Technologies ↔ Projekt-Technologies

## Web-Recherche-API
Nutzt die in Phase 7b implementierte Websuche-Infrastruktur.
Falls 7b noch nicht umgesetzt: SearXNG-Instanz oder Brave Search API
als Fallback.

## UI-Änderungen

### Einstellungen (Settings.jsx) – erweitern
- Neuer Abschnitt "LVB-Wissensbasis"
- Button "LVB-Wissen aktualisieren" → ruft `refreshLVBKnowledge()` auf
- Anzeige: "42 LVB-Projekte bekannt, zuletzt aktualisiert: 03.04.2026"
- Button "Wissensbasis leeren" → `clearLVBKnowledge()`

## Akzeptanzkriterien
- [ ] `src/stores/lvbKnowledgeStore.js`: Store angelegt mit CRUD-Operationen
- [ ] `src/services/lvbResearchService.js`: Websuche findet LVB-Projekte
- [ ] `src/services/lvbResearchService.js`: Ergebnisse werden mit Key Facts gespeichert
- [ ] `src/stores/lvbKnowledgeStore.js`: Technologies werden bei Speicherung via `normalizeKeywords()` normalisiert
- [ ] `src/services/classifyService.js`: LVB-Kontext wird automatisch in Classify-Prompt injiziert
- [ ] `src/config/prompts.js`: `getClassifyPrompt()` akzeptiert `lvbContext` Parameter
- [ ] Klassifizierungs-Output enthält `lvb_status` Feld
- [ ] `src/config/prompts.js`: Reasoning erwähnt LVB-Bezug wenn relevant
- [ ] Settings-UI: Button zur manuellen Aktualisierung vorhanden
- [ ] LVB-Kontext fließt NICHT in Report-Generierung ein
- [ ] LVB-Technologies fließen in `buildCrossReferenceIndex()` ein (via Phase 5b `keywordUtils.js`)

## Nicht in dieser Spec
- Keine automatische Hintergrund-Aktualisierung (nur manuell per Button)
- Kein Merge mit manuellem Projektspeicher aus Phase 5
- Keine LVB-Kontext-Injektion in Reports (→ optional über Phase 8a Freitext-Feld)
- Keine eigene Detailansicht für LVB-Wissensbasis-Einträge
