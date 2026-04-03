# Spec: FilterBar-Komponente

## Aufgabe
Erstelle die Filter-Leiste, mit der Artikel nach Scores, Tags,
Quellkategorien und Freitext gefiltert werden können.

## Kontext
Lies die Datenmodelle `FilterCriteria` in der Header-Doku von
`src/stores/articleStore.js` (dort definiert).

## Datei

### src/components/FilterBar.jsx

```javascript
/**
 * @module FilterBar
 * @purpose Filter-Controls für die Artikelliste
 *
 * @reads    stores/settingsStore.js → getFilterDefaults()
 * @reads    stores/articleStore.js → getAllArticles() (für verfügbare Tags)
 * @writes   nichts (gibt FilterCriteria per Callback nach oben)
 * @calledBy App.jsx → sitzt über der ArticleList
 *
 * @exports  FilterBar (React Component)
 *   Props:
 *     onFilterChange(filter: FilterCriteria): void
 *     availableTags: string[] – alle im Bestand vorhandenen Tags
 *     articleCounts: { total, filtered, unclassified }
 */
```

## UI-Elemente

**1. Ansichts-Toggle**
- "Alle" – zeigt alle Artikel (onlyClassified: false)
- "Bewertet" – zeigt nur klassifizierte Artikel (onlyClassified: true)
- Default: "Bewertet"

**2. Score-Slider (einer pro Linse)**
- Vier Slider: ÖV, TT, FÖ, MA
- Range: 0-10, Default: 0 (zeigt alles)
- Bedeutung: "Zeige nur Artikel mit Score >= Slider-Wert"
- Label zeigt aktuellen Wert: "ÖV ≥ 5"

**3. Tag-Filter**
- Dropdown oder Chip-Auswahl mit allen verfügbaren Tags
- Mehrfachauswahl möglich
- Logik: Artikel muss mindestens einen der gewählten Tags haben (OR)
- Leere Auswahl = kein Tag-Filter aktiv

**4. Quellkategorie-Filter**
- Chips/Buttons für: Branche, Tech, Förder, Startup, International
- Mehrfachauswahl, Default: alle aktiv
- Zeigt nur Artikel aus den gewählten Kategorien

**5. Freitextsuche**
- Textfeld mit Suchicon
- Sucht in: title, summary_de
- Debounced: 300ms nach letztem Tastendruck

**6. Nur Bookmarks**
- Toggle/Checkbox: "Nur gemerkte"
- Default: aus

**7. Zähler**
- Zeigt: "12 von 47 Artikeln" (gefiltert / gesamt)
- Aktualisiert sich bei jeder Filteränderung

## Verhalten
- Jede Filteränderung ruft sofort `onFilterChange()` auf
- Filter sind kombinierbar (AND-Verknüpfung zwischen Filtertypen)
- "Reset"-Button setzt alle Filter auf Defaults zurück
- Filter-State lebt im Component (useState), nicht im Store

## Layout
- Horizontal über der Artikelliste, kompakt
- Slider und Chips in einer Zeile wenn Platz, sonst umbrechen
- Einklappbar (Toggle "Filter anzeigen/verbergen") um Platz zu sparen

## Akzeptanzkriterien
- [ ] Vier Score-Slider funktionieren und filtern korrekt
- [ ] Tag-Filter zeigt verfügbare Tags und filtert per OR
- [ ] Quellkategorie-Filter funktioniert
- [ ] Freitextsuche mit Debouncing funktioniert
- [ ] Bookmark-Toggle funktioniert
- [ ] Zähler zeigt korrekte Zahlen
- [ ] Reset-Button setzt alles zurück
- [ ] Alle Filter kombinierbar (AND zwischen Filtertypen)
- [ ] Filter ist einklappbar

## Nicht in dieser Spec
- Kein Persistieren der Filter-Einstellungen (nice-to-have für später)
- Keine Sortier-Optionen (Default: Datum absteigend reicht vorerst)
