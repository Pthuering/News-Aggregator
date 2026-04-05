# Spec: Daten-Management & Bereinigung (Phase 7a)

## Aufgabe
Erstelle eine Data Management Komponente für Backup/Restore, Storage-Übersicht
und selektive Datenbereinigung.

## Kontext
Lies die Header-Blöcke in:
- `src/stores/articleStore.js` → exportAll(), importAll(), clearArticles()
- `src/stores/projectStore.js` → getProjects(), exportProjects(), importProjects()
- `src/stores/settingsStore.js` → getNvidiaApiKey()

## Neue Dateien

### src/components/DataManager.jsx

```javascript
/**
 * @module DataManager
 * @purpose Daten-Management: Backup/Restore, Bereinigung, Storage-Info
 *
 * @reads    stores/articleStore.js → exportAll(), importAll(), clearArticles(), getAllArticles()
 * @reads    stores/projectStore.js → getProjects(), exportProjects(), importProjects()
 * @writes   stores/articleStore.js → importAll(), clearArticles()
 * @writes   stores/projectStore.js → importProjects()
 * @calledBy App.jsx → Tab "Daten"
 *
 * @exports  DataManager (React Component)
 */
```

## Features

### 1. Storage-Übersicht
- Anzeige der aktuellen Datenmenge:
  - Anzahl Artikel (gesamt / klassifiziert / unklassifiziert)
  - Anzahl Projekte
  - Geschätzter Speicherverbrauch (LocalStorage + IndexedDB)

### 2. Backup & Restore
- **Export**: Download aller Daten als JSON-Datei
  - Artikel (inkl. Klassifikationen, Synergien, Notizen)
  - Projekte
  - Dateiname: `trend-radar-backup-YYYY-MM-DD.json`
- **Import**: Hochladen einer Backup-Datei
  - Validierung der Datei-Struktur
  - Option: Alles ersetzen oder nur fehlende ergänzen
  - Fortschrittsanzeige beim Import

### 3. Selektive Bereinigung
- Buttons zum Löschen mit Bestätigungs-Dialog:
  - "Unklassifizierte Artikel löschen" (älter als X Tage)
  - "Artikel ohne Lesezeichen löschen" (älter als X Tage)
  - "Artikel älter als..." (Dropdown: 30/60/90/180 Tage)
  - "ALLE Daten löschen" (mit Doppel-Bestätigung)

### 4. Automatische Bereinigung (Einstellung)
- Checkbox: "Alte Artikel automatisch löschen"
- Dropdown: "Artikel älter als X Tage löschen" (30/60/90/180/365)
- Wird bei jedem Feed-Update geprüft

## Datenformat Backup-Datei

```json
{
  "version": "1.0",
  "exportedAt": "2026-04-05T12:00:00Z",
  "stats": {
    "articleCount": 150,
    "projectCount": 5
  },
  "data": {
    "articles": [...],
    "projects": [...]
  }
}
```

## Akzeptanzkriterien
- [ ] Storage-Übersicht zeigt korrekte Zahlen
- [ ] Export erstellt valide JSON-Datei
- [ ] Import lädt Backup korrekt (inkl. Validierung)
- [ ] Selektive Löschung funktioniert mit Bestätigung
- [ ] Automatische Bereinigung kann aktiviert werden
- [ ] Doppel-Bestätigung für "ALLE löschen"
- [ ] Fehlermeldungen bei ungültigem Import

## UI-Integration
- Neuer Tab "Daten" neben "Dashboard", "Artikel", "Projekte", "Keywords"
- Einstellung für automatische Bereinigung in Settings.jsx erweitern
