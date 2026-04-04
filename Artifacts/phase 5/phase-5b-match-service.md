# Spec: Match-Service (Projekt-Synergien)

## Aufgabe
Erstelle den Service, der klassifizierte Artikel gegen die internen
Projekte prüft und Synergien erkennt. Nutzt eine Keyword-Normalisierung
und einen Cross-Reference-Index als schnellen Vorfilter, bevor
teure KI-Calls für Tiefenmatching ausgelöst werden.

## Kontext
Lies die Datenmodelle `SynergyMatch`, `ProjectConfig`, `ClassifiedArticle`
in `/docs/ARCHITECTURE.md`.
Lies die Header-Blöcke in:
- `src/config/prompts.js` → getMatchPrompt() (bisher Platzhalter)
- `src/stores/projectStore.js` → getProjects(), getProjectsAsContext()
- `src/stores/articleStore.js` → updateArticle()
- `src/stores/settingsStore.js` → getApiKey()

## Dateien

### src/utils/keywordUtils.js – NEU

```javascript
/**
 * @module keywordUtils
 * @purpose Normalisiert Keywords/Tags über alle Stores hinweg und
 *          baut einen Cross-Reference-Index zur Laufzeit
 *
 * @reads    stores/articleStore.js → getAllArticles() → tags[]
 * @reads    stores/projectStore.js → getProjects() → technologies[], challenges[]
 * @reads    stores/lvbKnowledgeStore.js → getAllLVBKnowledge() → technologies[]
 *           (optional, falls Phase 8b umgesetzt)
 *
 * @exports
 *   normalizeKeyword(keyword: string): string
 *     → lowercase, trim, Umlaute beibehalten, Bindestriche vereinheitlichen
 *     → Alias-Auflösung (z.B. "elektrobus" → "e-bus", "ki" → "künstliche-intelligenz")
 *
 *   normalizeKeywords(keywords: string[]): string[]
 *     → Batch-Normalisierung + Deduplizierung
 *
 *   buildCrossReferenceIndex(): Promise<CrossRefIndex>
 *     → Sammelt Keywords aus allen Stores, normalisiert sie,
 *       baut invertierten Index
 *     → CrossRefIndex: Map<string, { articles: string[], projects: string[], lvb: string[] }>
 *
 *   findKeywordOverlap(articleTags: string[], projectTechs: string[]): string[]
 *     → Gibt normalisierte Keywords zurück die in beiden vorkommen
 *
 *   KEYWORD_ALIASES: Record<string, string>
 *     → Konfigurierbare Alias-Map für synonyme Begriffe
 */
```

**Alias-Map** (erweiterbar):
```javascript
export const KEYWORD_ALIASES = {
  "elektrobus": "e-bus",
  "ki": "künstliche-intelligenz",
  "artificial-intelligence": "künstliche-intelligenz",
  "ai": "künstliche-intelligenz",
  "ml": "machine-learning",
  "iot": "internet-of-things",
  "öpnv": "nahverkehr",
  "autonomous": "autonomes-fahren",
};
```

### src/config/prompts.js – erweitern

`getMatchPrompt(projectsContext: string)` wird jetzt implementiert.

Der Prompt weist das Modell an:
1. Rolle: "Du bist Analyst bei einem deutschen Verkehrsunternehmen."
2. Aufgabe: "Prüfe ob der folgende Artikel Synergien mit einem
   unserer internen Projekte hat."
3. Projekte werden als Kontext mitgegeben (formatiert von
   `getProjectsAsContext()`)
4. Output-Format: JSON-Array von SynergyMatch-Objekten.
   Leeres Array wenn keine Synergien erkannt.
5. Regeln:
   - Nur echte, begründbare Synergien melden
   - Score 0-10 (0=keine, 10=direkt anwendbar)
   - Nur Synergien mit Score >= 4 zurückgeben
   - relevance: 1-2 Sätze, deutsch, konkret
   - NUR valides JSON, kein Markdown

### src/services/matchService.js

```javascript
/**
 * @module matchService
 * @purpose Prüft Artikel gegen interne Projekte auf Synergien
 *
 * @reads    config/prompts.js → getMatchPrompt()
 * @reads    stores/projectStore.js → getProjectsAsContext()
 * @reads    stores/settingsStore.js → getApiKey()
 * @reads    utils/keywordUtils.js → findKeywordOverlap(), normalizeKeywords()
 * @writes   stores/articleStore.js → updateArticle() (synergies-Feld)
 * @calledBy App.jsx → nach classifyService, oder separat per Button
 *
 * @dataflow
 *   Projekte laden → Keyword-Vorfilter pro Artikel
 *   → nur bei Keyword-Overlap ODER hohem Score: KI-Tiefenmatching
 *   → pro Artikel-Batch: API-Call mit Projekt-Kontext + Artikel
 *   → SynergyMatch[] parsen → in Artikel speichern
 *
 * @exports
 *   matchNewArticles(onProgress): Promise<MatchResult>
 *     → Prüft alle Artikel die Scores haben aber noch keine synergies
 *     → Keyword-Vorfilter: nur Artikel mit Overlap oder Score≥6 werden KI-geprüft
 *     → MatchResult: { matched: number, synergiesFound: number, skipped: number, errors: string[] }
 *
 *   matchSingle(article: ClassifiedArticle): Promise<SynergyMatch[]>
 *     → Einzelnen Artikel prüfen (immer KI, kein Vorfilter)
 *
 * @errors
 *   - Keine Projekte angelegt: Abbruch mit Hinweis, kein Error
 *   - API-Fehler: Retry 2x, dann skip
 */
```

## Keyword-Vorfilter

Vor jedem KI-Call prüft der matchService per `findKeywordOverlap()`:
1. Artikel-Tags normalisieren
2. Projekt-Technologies + Challenges normalisieren
3. Überlappung berechnen

**KI-Tiefenmatching wird ausgelöst wenn:**
- Keyword-Overlap ≥ 1 (gemeinsame normalisierte Keywords)
- ODER `oepnv_direkt` Score ≥ 6 oder `tech_transfer` Score ≥ 6
- ODER Artikel hat `lvb_status !== null` (Phase 8b)

**Übersprungen** (mit `synergies: []` gespeichert) wenn keines zutrifft.
→ Spart API-Calls bei offensichtlich irrelevanten Artikeln.

## API-Call

System-Prompt: `getMatchPrompt(projectsContext)`

User-Message pro Artikel:
```
Prüfe folgenden Artikel auf Synergien mit unseren Projekten:

Titel: {title}
Zusammenfassung: {summary_de}
Tags: {tags}
Keyword-Overlap mit Projekten: {overlappingKeywords}
Scores: ÖV={oepnv_direkt}, TT={tech_transfer}
```

Batching: Max 3 Artikel pro Call (Projekt-Kontext verbraucht
viele Tokens, deshalb kleinere Batches als bei Klassifikation).

## Ablauf matchNewArticles()

1. `getProjects()` aufrufen → wenn leer, sofort returnen
2. `getProjectsAsContext()` → Projekt-Beschreibungen als String
3. Alle Artikel laden die `scores` haben aber `synergies` undefined
4. **Keyword-Vorfilter**: Pro Artikel Overlap mit allen Projekten prüfen
5. Artikel ohne Overlap und niedrigem Score → `synergies: []` speichern
6. Verbleibende Artikel in 3er-Batches aufteilen
7. Pro Batch: API-Call → SynergyMatch[] parsen
8. `updateArticle(id, { synergies: [...] })` pro Artikel
9. MatchResult zurückgeben (inkl. `skipped`-Count)

## Keyword-Normalisierung bei Speicherung

Die `normalizeKeywords()`-Funktion soll auch bei der **Eingabe**
aufgerufen werden:
- `classifyService.js`: Tags nach Klassifizierung normalisieren
  bevor sie in articleStore geschrieben werden
- `ProjectManager.jsx`: Technologies nach Eingabe normalisieren
  bevor sie in projectStore geschrieben werden

## Akzeptanzkriterien
- [ ] `src/utils/keywordUtils.js`: `normalizeKeyword()` normalisiert konsistent
- [ ] `src/utils/keywordUtils.js`: `buildCrossReferenceIndex()` sammelt aus allen Stores
- [ ] `src/utils/keywordUtils.js`: `findKeywordOverlap()` findet gemeinsame Keywords
- [ ] `src/utils/keywordUtils.js`: `KEYWORD_ALIASES` löst Synonyme auf
- [ ] `getMatchPrompt()` in prompts.js ist implementiert
- [ ] `matchService.js`: Keyword-Vorfilter überspringt irrelevante Artikel
- [ ] `matchService.js`: `matchNewArticles()` prüft gefilterte Artikel per KI
- [ ] `matchService.js`: MatchResult enthält `skipped`-Count
- [ ] `classifyService.js`: Tags werden nach Klassifizierung normalisiert
- [ ] `ProjectManager.jsx`: Technologies werden bei Speicherung normalisiert
- [ ] Synergien werden in articleStore gespeichert
- [ ] Retry 2x bei API-Fehlern

## Nicht in dieser Spec
- Keine UI für Alias-Map-Bearbeitung
- Keine automatische Alias-Erkennung per KI
- [ ] Nur Synergien mit Score >= 4 werden gespeichert
- [ ] Bei leerer Projektliste: sauberer Abbruch, kein Error
- [ ] Retry-Logik bei API-Fehlern

## Nicht in dieser Spec
- Keine UI-Anbindung (nächste Spec)
