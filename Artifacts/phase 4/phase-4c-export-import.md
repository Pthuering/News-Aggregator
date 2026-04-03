# Spec: Daten-Export und -Import

## Aufgabe
Erweitere die Settings-Komponente um Export und Import aller
Artikeldaten als JSON-Backup.

## Kontext
Lies die Header-Blöcke in:
- `src/components/Settings.jsx` → aktuelle Struktur
- `src/stores/articleStore.js` → exportAll(), importAll()

## Änderungen

### Settings.jsx erweitern

Neuer Bereich unter dem API-Key-Formular: "Daten-Backup"

**Export:**
- Button "Daten exportieren"
- Ruft `articleStore.exportAll()` auf
- Erzeugt JSON-Datei mit allen Artikeln
- Dateiname: `trend-radar-backup-{YYYY-MM-DD}.json`
- Automatischer Download im Browser

**Import:**
- File-Upload-Feld (akzeptiert nur .json)
- Vorschau nach Upload: "142 Artikel gefunden"
- Warnhinweis: "Bestehende Daten werden überschrieben"
- Bestätigungs-Button: "Importieren"
- Ruft `articleStore.importAll()` auf
- Erfolgsmeldung mit Anzahl importierter Artikel

**Daten löschen:**
- Button "Alle Daten löschen" (rot)
- Bestätigungsdialog: "Wirklich alle Artikel löschen?"
- Löscht alle Artikel aus IndexedDB

## Akzeptanzkriterien
- [ ] Export erzeugt JSON-Datei mit allen Artikeln
- [ ] Dateiname enthält aktuelles Datum
- [ ] Import liest JSON und zeigt Vorschau
- [ ] Import überschreibt bestehende Daten nach Bestätigung
- [ ] Löschen entfernt alle Daten nach Bestätigung
- [ ] Fehlermeldung bei ungültiger JSON-Datei

## Nicht in dieser Spec
- Kein selektiver Import (alles oder nichts)
- Kein automatisches Backup
