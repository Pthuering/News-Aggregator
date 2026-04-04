# Spec: Source Store & Persistenz (Phase 9a)

## Aufgabe
Löse die statische Quellen-Konfiguration (`config/sources.js`) durch
einen dynamischen, persistenten Source-Store ab. Quellen werden künftig
zur Laufzeit hinzugefügt, bearbeitet und entfernt – gespeichert in
IndexedDB, analog zum bestehenden `articleStore`.

Die bisherigen Quellen aus `sources.js` dienen als Seed: beim ersten
App-Start werden sie automatisch in den Store übernommen.

## Kontext
Lies die Header-Blöcke in:
- `src/config/sources.js` → SourceConfig-Typedef, statische Quellen
- `src/stores/articleStore.js` → Muster für IndexedDB-Store
- `src/services/feedService.js` → nutzt `getActiveSources()`

## Datei

### src/stores/sourceStore.js

```javascript
/**
 * @module sourceStore
 * @purpose Persistenter Store für RSS-Feed-Quellen (IndexedDB)
 *
 * @reads    config/sources.js → Seed-Daten beim ersten Start
 * @writes   IndexedDB → "sources" Object-Store
 * @calledBy services/feedService.js → getActiveSources()
 * @calledBy components/SourceManager.jsx → CRUD-Operationen
 *
 * @dataflow
 *   Erster Start → Seed aus sources.js laden → in IndexedDB schreiben
 *   Danach → alle Lese-/Schreib-Ops direkt auf IndexedDB
 *
 * @exports
 *   initSourceStore(): Promise<void>
 *     → Prüft ob DB existiert, ggf. Seed einspielen
 *
 *   getAllSources(): Promise<SourceConfig[]>
 *     → Alle Quellen aus IndexedDB
 *
 *   getActiveSources(): Promise<SourceConfig[]>
 *     → Nur active === true
 *
 *   getSourcesByCategory(cat: string): Promise<SourceConfig[]>
 *     → Gefiltert nach Kategorie
 *
 *   addSource(source: SourceConfig): Promise<void>
 *     → Neue Quelle anlegen, ID wird generiert falls leer
 *
 *   updateSource(id: string, changes: Partial<SourceConfig>): Promise<void>
 *     → Einzelne Felder einer Quelle ändern
 *
 *   deleteSource(id: string): Promise<void>
 *     → Quelle entfernen
 *
 *   toggleSource(id: string): Promise<void>
 *     → active-Flag umschalten
 *
 *   bulkToggle(ids: string[], active: boolean): Promise<void>
 *     → Mehrere Quellen gleichzeitig aktivieren/deaktivieren
 *
 *   getSourceStats(): Promise<SourceStats>
 *     → { total, active, byCategory: Record<string, number> }
 */
```

## Erweitertes Datenmodell

```javascript
/**
 * @typedef {Object} SourceConfig
 * @property {string}  id        - Unique identifier (slug, z.B. "heise-it")
 * @property {string}  name      - Anzeigename
 * @property {string}  url       - RSS/Atom Feed-URL
 * @property {string}  type      - "rss" | "atom" (automatisch erkannt)
 * @property {string}  category  - Kategorie-Slug
 * @property {boolean} active    - Aktiviert/Deaktiviert
 * @property {string}  [addedAt] - ISO-Timestamp der Erstellung
 * @property {string}  [lastFetchedAt]  - Letzter erfolgreicher Abruf
 * @property {string}  [lastError]      - Letzte Fehlermeldung (null wenn OK)
 * @property {number}  [articleCount]   - Anzahl geladener Artikel
 * @property {string}  [faviconUrl]     - Favicon-URL für die Anzeige
 * @property {string}  [description]    - Optionale Beschreibung der Quelle
 */
```

## Seed-Mechanismus

1. `initSourceStore()` wird beim App-Start aufgerufen
2. Prüft ob der IndexedDB-ObjectStore "sources" leer ist
3. Falls leer → importiert alle Einträge aus `config/sources.js`
   mit `addedAt: new Date().toISOString()`
4. Falls bereits befüllt → keine Aktion
5. Optional: Versionsnummer speichern für spätere Migrationen

## Migration feedService.js

- `feedService.js` ruft künftig `getActiveSources()` aus dem
  `sourceStore` statt aus `config/sources.js` auf
- Die Funktion wird async (gibt Promise zurück)
- `config/sources.js` bleibt als Seed-Datei erhalten, wird aber
  nicht mehr direkt von Services importiert

## Akzeptanzkriterien
- [ ] IndexedDB-Store "sources" wird korrekt erstellt
- [ ] Seed-Import läuft beim ersten Start fehlerfrei
- [ ] `getAllSources()` liefert alle Quellen
- [ ] `addSource()` legt neue Quelle an mit generierter ID
- [ ] `updateSource()` ändert einzelne Felder
- [ ] `deleteSource()` entfernt Quelle aus DB
- [ ] `toggleSource()` wechselt active-Flag
- [ ] `feedService.js` nutzt neuen Store statt statischer Config
- [ ] Bestehende Feeds funktionieren nach Migration unverändert

## Nicht in dieser Phase
- Kein UI (kommt in Phase 9b)
- Kein OPML-Import (kommt in Phase 9d)
- Keine Feed-Validierung (kommt in Phase 9c)

## Abhängigkeiten
- Phase 1 (articleStore-Muster, IndexedDB-Setup)
- `config/sources.js` (Seed-Daten)
