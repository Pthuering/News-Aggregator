# Spec: ArticleDetail-Komponente

## Aufgabe
Erstelle die Detail-Ansicht für einen einzelnen Artikel, die alle
Bewertungen, die KI-Begründung und Bearbeitungsmöglichkeiten zeigt.

## Kontext
Lies die Datenmodelle `EnrichedArticle` in `/docs/ARCHITECTURE.md`.

## Datei

### src/components/ArticleDetail.jsx

```javascript
/**
 * @module ArticleDetail
 * @purpose Detail-Ansicht eines Artikels mit Scores, Reasoning, Notes
 *
 * @reads    stores/articleStore.js → getArticleById()
 * @writes   stores/articleStore.js → updateArticle() (bookmark, userNotes)
 * @calledBy App.jsx → wenn Artikel in der Liste angeklickt wird
 *
 * @exports  ArticleDetail (React Component)
 *   Props:
 *     articleId: string
 *     onBack(): void – zurück zur Liste
 */
```

## Anzeige-Elemente

**Header-Bereich**
- Zurück-Button (ruft onBack)
- Titel des Artikels (groß)
- Quelle + Datum + Kategorie-Badge
- Link zum Original-Artikel (externer Link, target="_blank")
- Bookmark-Toggle (Stern/Herz-Icon)

**Score-Bereich**
- Vier Score-Balken oder große Badges, je einer pro Linse
- Vollständige Label: "ÖPNV-Direkt: 7/10", "Tech-Transfer: 3/10" etc.
- Farbig wie in der Liste (grau/gelb/grün)
- Darunter: reasoning-Text (die KI-Begründung für die Scores)

**Zusammenfassung**
- summary_de als hervorgehobener Textblock
- Tags als klickbare Chips (Klick könnte später Filter setzen)

**Synergien** (nur anzeigen wenn vorhanden)
- Liste der erkannten Projekt-Synergien
- Pro Synergie: Projektname, Relevanz-Score, Begründung
- Wird erst ab Phase 5 befüllt, Component soll es aber
  schon rendern können wenn Daten da sind

**Notizen**
- Textfeld für eigene Notizen (userNotes)
- Auto-Save: speichert 500ms nach letzter Eingabe via updateArticle()
- Platzhalter-Text: "Eigene Gedanken, Use-Case-Ideen..."

## Verhalten
- Wenn Artikel nicht klassifiziert: Score-Bereich ausblenden,
  stattdessen Hinweis "Noch nicht bewertet"
- Bookmark-Toggle speichert sofort via updateArticle()
- Notizen speichern debounced (500ms)

## Akzeptanzkriterien
- [ ] Alle Artikel-Daten werden korrekt angezeigt
- [ ] Vier Scores mit Farben und Begründung sichtbar
- [ ] Bookmark-Toggle funktioniert und persistiert
- [ ] Notizen-Feld speichert automatisch
- [ ] Link zum Original-Artikel öffnet neuen Tab
- [ ] Zurück-Button funktioniert
- [ ] Unklassifizierte Artikel zeigen Hinweis statt leerer Scores
- [ ] Synergien-Bereich rendert korrekt (auch wenn leer)

## Nicht in dieser Spec
- Keine Nachklassifikation-Funktion (Button zum erneuten Bewerten)
- Keine Tag-Klick-Navigation (nice-to-have)
