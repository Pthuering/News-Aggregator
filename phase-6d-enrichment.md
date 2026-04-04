# Spec: Auto-Kontextanreicherung

## Aufgabe
Erstelle den Service, der bei Artikeln mit unbekannten Unternehmen
oder Technologien automatisch Hintergrund-Infos ergänzt.

## Kontext
Lies die Header-Blöcke in:
- `src/config/prompts.js` → neuer Prompt nötig
- `src/stores/articleStore.js` → updateArticle()
- `src/stores/settingsStore.js` → getApiKey()

## Datei

### src/services/enrichService.js

```javascript
/**
 * @module enrichService
 * @purpose Reichert Artikel mit Hintergrund-Infos zu Entities an
 *
 * @reads    config/prompts.js → getEnrichPrompt()
 * @reads    stores/settingsStore.js → getApiKey()
 * @writes   stores/articleStore.js → updateArticle() (enrichment-Feld)
 * @calledBy components/ArticleDetail.jsx → Button "Mehr Kontext"
 *
 * @dataflow
 *   Artikel → API-Call mit Web-Search-Tool → Hintergrund-Infos
 *   → als enrichment-String im Artikel speichern
 *
 * @exports
 *   enrichArticle(article: ClassifiedArticle): Promise<string>
 *     → Gibt Enrichment-Text zurück (2-3 Sätze pro Entity)
 */
```

## Funktionsweise

Nicht automatisch für alle Artikel (zu teuer), sondern
on-demand per Button in der ArticleDetail-Ansicht.

### Prompt (in prompts.js als getEnrichPrompt())

"Identifiziere unbekannte oder erklärungsbedürftige Unternehmen,
Produkte, Technologien oder Abkürzungen in folgendem Artikel.
Gib für jede Entity eine Kurzinfo in 1-2 Sätzen auf Deutsch."

### API-Call

Model: claude-sonnet-4-20250514 mit aktiviertem Web-Search-Tool:
```javascript
tools: [{
  type: "web_search_20250305",
  name: "web_search"
}]
```

So kann das Modell aktuelle Infos zu Unternehmen nachschlagen.

### Datenmodell erweitern

`EnrichedArticle` bekommt:
```
enrichment: string | null  // Markdown-Text mit Entity-Infos
```

### UI in ArticleDetail.jsx

- Button "Mehr Kontext" unter der Zusammenfassung
- Beim Klick: Loading-State, dann Enrichment-Text anzeigen
- Text wird im Artikel gespeichert (nur einmal abrufen nötig)
- Wenn bereits enriched: Text direkt anzeigen, Button wird
  "Kontext aktualisieren"

## Akzeptanzkriterien
- [ ] `enrichService.js` hat vollständigen Header-Block
- [ ] `getEnrichPrompt()` in prompts.js existiert
- [ ] API-Call nutzt Web-Search-Tool
- [ ] Enrichment-Text wird im Artikel gespeichert
- [ ] Button in ArticleDetail löst Enrichment aus
- [ ] Bereits angereicherte Artikel zeigen Text direkt
- [ ] Loading-State während des API-Calls

## Nicht in dieser Spec
- Kein automatisches Enrichment für alle Artikel
- Kein Caching auf Entity-Ebene (Artikel-Ebene reicht)
