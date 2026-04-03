# Spec: Report-Service

## Aufgabe
Erstelle den Service, der aus ausgewählten Artikeln einen
konfigurierbaren Report generiert.

## Kontext
Lies die Datenmodelle `ReportConfig`, `EnrichedArticle` in `/docs/ARCHITECTURE.md`.
Lies die Header-Blöcke in:
- `src/config/prompts.js` → getReportPrompt() (bisher Platzhalter)
- `src/stores/articleStore.js` → getArticleById()
- `src/stores/settingsStore.js` → getApiKey()

## Dateien

### src/config/prompts.js – erweitern

`getReportPrompt(config: ReportConfig)` wird jetzt implementiert.
Der Prompt passt sich an die drei Dimensionen der ReportConfig an:

**Audience:**
- `geschaeftsfuehrung`: Fokus auf strategische Bedeutung, Business-Impact,
  Handlungsempfehlungen. Sprache: formal, kompakt.
- `fachabteilung`: Technische Details erlaubt, konkrete nächste Schritte.
  Sprache: fachlich, direkt.
- `foerderantrag`: Fokus auf Förderfähigkeit, Innovationsgehalt,
  Bezug zu Förderrichtlinien. Sprache: förderantrag-typisch.

**Focus:**
- `technologie`: Technische Einordnung, Reifegrad, Umsetzbarkeit
- `wettbewerb`: Marktüberblick, Wettbewerbsposition, Handlungsdruck
- `foerderpotential`: Passende Förderprogramme, Antragsrelevanz
- `allgemein`: Ausgewogene Mischung aller Aspekte

**Length:**
- `kurz`: Executive Summary, max 300 Wörter
- `mittel`: Strukturierter Bericht, ca 500-800 Wörter
- `detail`: Ausführlicher Report mit Unterabschnitten, 1000-1500 Wörter

Der Prompt weist das Modell an, Markdown zurückzugeben mit
sinnvoller Struktur (Überschriften, Aufzählungen wo nötig).

### src/services/reportService.js

```javascript
/**
 * @module reportService
 * @purpose Generiert Markdown-Reports aus ausgewählten Artikeln
 *
 * @reads    config/prompts.js → getReportPrompt()
 * @reads    stores/articleStore.js → getArticleById()
 * @reads    stores/settingsStore.js → getApiKey()
 * @writes   nichts (gibt Markdown-String zurück)
 * @calledBy components/ReportGenerator.jsx
 *
 * @dataflow
 *   articleIds → Artikel aus Store laden → mit User-Notes anreichern
 *   → Prompt bauen (System + Artikel-Kontext) → API-Call
 *   → Markdown-Response zurückgeben
 *
 * @exports
 *   generateReport(config: ReportConfig): Promise<string>
 *     → Gibt fertigen Markdown-Report zurück
 *
 * @errors
 *   - Kein API-Key: Error werfen
 *   - Keine Artikel gefunden: Error werfen
 *   - API-Fehler: Retry 2x, dann Error
 */
```

## API-Call-Struktur

System-Prompt: `getReportPrompt(config)`

User-Message:
```
Erstelle einen Report basierend auf folgenden Artikeln:

--- Artikel 1 ---
Titel: {title}
Quelle: {source}
Datum: {published}
Zusammenfassung: {summary_de}
Scores: ÖV={oepnv_direkt}, TT={tech_transfer}, FÖ={foerder}, MA={markt}
Tags: {tags}
Eigene Notizen: {userNotes oder "keine"}

--- Artikel 2 ---
...
```

Wenn `includeUserNotes` false ist, werden die Notizen weggelassen.

`max_tokens`: 2000 (Reports sind länger als Klassifikationen)

## Akzeptanzkriterien
- [ ] `getReportPrompt()` in prompts.js ist implementiert (kein Platzhalter mehr)
- [ ] Prompt passt sich korrekt an audience, focus, length an
- [ ] `reportService.js` hat vollständigen Header-Block
- [ ] `generateReport()` gibt Markdown zurück
- [ ] User-Notes werden einbezogen wenn `includeUserNotes` true
- [ ] Fehlerbehandlung für fehlenden API-Key und leere Artikel-Liste

## Nicht in dieser Spec
- Keine UI (kommt in nächster Spec)
