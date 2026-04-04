# Spec: Quellenverwaltung UI (Phase 9b)

## Aufgabe
Erstelle eine eigenständige Quellenverwaltungs-Ansicht als separates
Panel/Fenster, in dem der Nutzer alle RSS-Feed-Quellen sehen, neue
hinzufügen, bestehende bearbeiten und entfernen kann. Das Panel wird
über die Hauptnavigation erreichbar (neuer Tab „Quellen").

## Kontext
Lies die Header-Blöcke in:
- `src/stores/sourceStore.js` → CRUD-Operationen (Phase 9a)
- `src/components/Settings.jsx` → bestehendes UI-Muster
- `src/components/FilterBar.jsx` → Kategorie-Filter-Muster
- `src/App.jsx` → Navigation/Tab-Struktur

## Datei

### src/components/SourceManager.jsx

```javascript
/**
 * @module SourceManager
 * @purpose Eigenständiges Panel zur Verwaltung von RSS-Feed-Quellen
 *
 * @reads    stores/sourceStore.js → getAllSources(), getSourceStats()
 * @calls    stores/sourceStore.js → addSource(), updateSource(),
 *           deleteSource(), toggleSource(), bulkToggle()
 * @calls    services/feedService.js → testFeed() (Phase 9c)
 * @calledBy App.jsx → über Navigation/Tab "Quellen"
 *
 * @exports  SourceManager (React Component)
 */
```

## UI-Bereiche

### 1. Header-Leiste
- Titel: „Quellenverwaltung"
- Statistik-Badges: Gesamt | Aktiv | Inaktiv
- Button: „+ Neue Quelle" (öffnet Formular)
- Suchfeld: Quellen nach Name/URL filtern

### 2. Kategorie-Tabs / Filter
- Horizontale Tabs für jede Kategorie (branche, tech, startup, …)
- Tab „Alle" als Default
- Zähler pro Kategorie im Tab-Label: „Tech (3)"

### 3. Quellen-Liste
- Tabellarische Darstellung oder Card-Grid (je nach Breite)
- Pro Quelle anzeigen:
  - Favicon + Name
  - URL (gekürzt, mit Tooltip für volle URL)
  - Kategorie-Badge (farbig)
  - Status-Indikator: grün (aktiv), grau (inaktiv), rot (Fehler)
  - Letzter Abruf (relative Zeitangabe, z.B. „vor 2h")
  - Artikel-Anzahl
- Aktionen pro Zeile:
  - Toggle-Switch: Aktiv/Inaktiv
  - Edit-Button → öffnet Bearbeitungs-Dialog
  - Delete-Button → Bestätigungsdialog
- Sortierung: nach Name, Kategorie, Artikel-Anzahl, letztem Abruf
- Leerer Zustand: Hilfstext „Noch keine Quellen. Füge deine erste hinzu."

### 4. Hinzufügen-/Bearbeiten-Dialog (Modal)
- Felder:
  - **URL** (Pflicht) – Eingabefeld mit Paste-Support
  - **Name** (Pflicht) – wird auto-befüllt aus Feed-Titel falls möglich
  - **Kategorie** (Pflicht) – Dropdown der vorhandenen Kategorien +
    Option „Neue Kategorie erstellen"
  - **Beschreibung** (Optional) – Freitext
- Buttons:
  - „Feed testen" → validiert URL, zeigt Vorschau (Phase 9c)
  - „Speichern" → ruft addSource() / updateSource() auf
  - „Abbrechen" → schließt Dialog

### 5. Bulk-Aktionen
- Checkboxen pro Quelle für Mehrfachauswahl
- Aktions-Leiste bei Selektion:
  - „Ausgewählte aktivieren"
  - „Ausgewählte deaktivieren"
  - „Ausgewählte löschen" (mit Bestätigungsdialog)
- „Alle auswählen / Keine auswählen" Toggle

### 6. Schnell-Hinzufügen
- Kompaktes Eingabefeld am unteren Rand: „Feed-URL einfügen…"
- Bei Enter → Feed wird validiert und mit Default-Kategorie hinzugefügt
- Schneller Workflow für mehrere Feeds hintereinander

## Navigation-Integration

In `App.jsx`:
- Neuer Tab „Quellen" in der Hauptnavigation
- Icon: RSS-Symbol oder Listen-Symbol
- Position: nach „Projekte", vor „Einstellungen"

## Responsive Design
- Desktop: Tabellenansicht mit allen Spalten
- Tablet: Card-Grid, 2 Spalten
- Mobil: Card-Grid, 1 Spalte, Aktionen im Swipe-Menü oder
  über Drei-Punkte-Menü

## Akzeptanzkriterien
- [ ] SourceManager-Komponente rendert als eigener Tab
- [ ] Alle Quellen aus dem Store werden angezeigt
- [ ] Neue Quelle kann über Dialog hinzugefügt werden
- [ ] Bestehende Quelle kann bearbeitet werden
- [ ] Quelle kann gelöscht werden (mit Bestätigung)
- [ ] Toggle aktiviert/deaktiviert Quelle direkt in der Liste
- [ ] Kategorie-Filter funktioniert
- [ ] Suchfeld filtert nach Name und URL
- [ ] Sortierung funktioniert
- [ ] Bulk-Aktionen (Auswählen, Aktivieren, Deaktivieren, Löschen)
- [ ] Schnell-Hinzufügen am unteren Rand funktioniert
- [ ] Leerer Zustand wird korrekt dargestellt
- [ ] Responsive Layout für Desktop, Tablet, Mobil

## Nicht in dieser Phase
- Keine Feed-Validierung/Test-Logik (kommt in Phase 9c)
- Kein OPML-Import/Export (kommt in Phase 9d)
- Kein Drag & Drop für Reihenfolge
- Keine Feed-Vorschau mit Artikeln im Dialog

## Abhängigkeiten
- Phase 9a (sourceStore mit CRUD-Operationen)
- Phase 3 (UI-Komponenten-Muster)
