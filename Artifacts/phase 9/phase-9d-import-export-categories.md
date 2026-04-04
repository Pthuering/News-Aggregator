# Spec: Import/Export & Kategorie-Verwaltung (Phase 9d)

## Aufgabe
Ergänze die Quellenverwaltung um Import/Export-Funktionen (OPML und
JSON) sowie eine flexible Kategorie-Verwaltung. Nutzer sollen ihre
Feed-Liste portabel halten und eigene Kategorien erstellen können.

## Kontext
Lies die Header-Blöcke in:
- `src/stores/sourceStore.js` → CRUD-Operationen (Phase 9a)
- `src/components/SourceManager.jsx` → UI (Phase 9b)
- `src/components/Settings.jsx` → bestehendes Export/Import-Muster

## Dateien

### src/services/sourceImportExportService.js

```javascript
/**
 * @module sourceImportExportService
 * @purpose Import/Export von Feed-Quellen in verschiedenen Formaten
 *
 * @reads    stores/sourceStore.js → getAllSources()
 * @writes   stores/sourceStore.js → addSource() (beim Import)
 * @calledBy components/SourceManager.jsx → Import/Export Buttons
 *
 * @exports
 *   exportAsOPML(): Promise<string>
 *     → Generiert OPML-XML aus allen Quellen
 *
 *   exportAsJSON(): Promise<string>
 *     → Generiert JSON mit allen Quellen + Kategorien
 *
 *   importFromOPML(xmlString: string): Promise<ImportResult>
 *     → Parst OPML, erstellt SourceConfig[] daraus
 *     → ImportResult: { imported: number, skipped: number,
 *         errors: string[], sources: SourceConfig[] }
 *
 *   importFromJSON(jsonString: string): Promise<ImportResult>
 *     → Parst JSON, erstellt SourceConfig[] daraus
 *
 *   parseOPML(xml: string): OPMLOutline[]
 *     → Parst OPML-Struktur in flache Liste
 *
 *   generateOPML(sources: SourceConfig[]): string
 *     → Baut OPML-XML aus Quellen-Array
 */
```

### src/stores/categoryStore.js

```javascript
/**
 * @module categoryStore
 * @purpose Verwaltung benutzerdefinierter Kategorien (IndexedDB)
 *
 * @reads    nichts
 * @writes   IndexedDB → "categories" Object-Store
 * @calledBy components/SourceManager.jsx → Kategorie-Dropdown
 * @calledBy components/FilterBar.jsx → Kategorie-Filter
 *
 * @exports
 *   initCategoryStore(): Promise<void>
 *     → Seed: Default-Kategorien anlegen falls leer
 *
 *   getAllCategories(): Promise<Category[]>
 *     → Alle Kategorien sortiert nach Reihenfolge
 *
 *   addCategory(category: Category): Promise<void>
 *     → Neue Kategorie anlegen
 *
 *   updateCategory(slug: string, changes: Partial<Category>): Promise<void>
 *     → Kategorie umbenennen / Farbe ändern
 *
 *   deleteCategory(slug: string): Promise<void>
 *     → Kategorie löschen, betroffene Quellen → "sonstige"
 *
 *   reorderCategories(slugs: string[]): Promise<void>
 *     → Reihenfolge der Kategorien ändern
 */
```

## Kategorie-Datenmodell

```javascript
/**
 * @typedef {Object} Category
 * @property {string} slug    - URL-safe Identifier ("branche", "tech", …)
 * @property {string} name    - Anzeigename ("Branche", "Tech", …)
 * @property {string} color   - Hex-Farbcode für Badge ("#3B82F6")
 * @property {number} order   - Sortier-Reihenfolge
 * @property {boolean} isDefault - true für mitgelieferte Kategorien
 */
```

### Default-Kategorien (Seed)

| slug | name | color |
|------|------|-------|
| branche | Branche | #3B82F6 |
| tech | Tech | #8B5CF6 |
| foerder | Förderung | #10B981 |
| startup | Startup | #F59E0B |
| international | International | #EF4444 |
| sonstige | Sonstige | #6B7280 |

## OPML-Format

Export-Beispiel:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>News-Aggregator Feeds</title>
    <dateCreated>2026-04-04T12:00:00Z</dateCreated>
  </head>
  <body>
    <outline text="Branche" title="Branche">
      <outline type="rss" text="Nahverkehr Hamburg"
        title="Nahverkehr Hamburg"
        xmlUrl="https://www.nahverkehrhamburg.de/feed/"
        htmlUrl="" category="branche" />
    </outline>
    <outline text="Tech" title="Tech">
      <outline type="rss" text="Heise Online IT" ... />
    </outline>
  </body>
</opml>
```

Import-Logik:
1. OPML-XML parsen (DOMParser)
2. `<outline>`-Elemente mit `xmlUrl` extrahieren
3. Pro Outline → SourceConfig erzeugen
4. Kategorie: aus `category`-Attribut oder übergeordnetem `<outline text>`
5. Duplikat-Check: gleiche URL bereits vorhanden? → überspringen
6. Ergebnis-Dialog: „12 Feeds importiert, 3 übersprungen (Duplikate)"

## UI-Integration (im SourceManager, Phase 9b)

### Import/Export-Bereich
- Button-Gruppe im Header oder Footer des SourceManagers:
  - „OPML importieren" → Datei-Dialog (.opml, .xml)
  - „OPML exportieren" → Download als .opml
  - „JSON exportieren" → Download als .json
  - „JSON importieren" → Datei-Dialog (.json)

### Import-Vorschau-Dialog
- Zeigt gefundene Feeds vor dem Import
- Markiert Duplikate (bereits vorhanden)
- Kategorie-Zuordnung prüfen / korrigieren
- „Alle importieren" / „Auswahl importieren" / „Abbrechen"

### Kategorie-Verwaltung (im SourceManager)
- Eigener Abschnitt oder Dropdown-Erweiterung
- Bestehende Kategorien auflisten mit Farbe und Quellen-Anzahl
- „Neue Kategorie" → Name + Farbe eingeben
- Kategorie bearbeiten (Name, Farbe)
- Kategorie löschen → Bestätigung, Quellen werden auf „Sonstige" gesetzt
- Farbwahl: vordefinierte Palette (8-10 Farben) oder Hex-Eingabe

## Akzeptanzkriterien
- [ ] OPML-Export generiert valides OPML 2.0 XML
- [ ] OPML-Import parst gängige OPML-Dateien korrekt
- [ ] Duplikate werden beim Import erkannt und übersprungen
- [ ] Import-Vorschau zeigt alle gefundenen Feeds
- [ ] JSON-Export enthält alle Quellen + Kategorien
- [ ] JSON-Import stellt Quellen + Kategorien wieder her
- [ ] Neue Kategorie kann erstellt werden
- [ ] Kategorie kann umbenannt werden
- [ ] Kategorie kann gelöscht werden (Quellen → "sonstige")
- [ ] Farbzuordnung zu Kategorien funktioniert
- [ ] Kategorie-Farben werden in der gesamten App konsistent angezeigt
- [ ] FilterBar nutzt dynamische Kategorien statt Hardcoded-Liste

## Nicht in dieser Phase
- Kein Cloud-Sync der Quellen
- Kein automatischer Import aus anderen RSS-Readern
- Keine verschachtelten Kategorie-Hierarchien (nur eine Ebene)

## Abhängigkeiten
- Phase 9a (sourceStore)
- Phase 9b (SourceManager-UI für Integration)
- Phase 3 (FilterBar muss auf dynamische Kategorien umgestellt werden)
