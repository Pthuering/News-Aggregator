# Spec: Feed-Verwaltung UI (Phase 7)

## Zusammenfassung
Erweiterte Verwaltung von RSS-Feed-Quellen über die UI, nicht nur via Code.

## Features / Stichpunkte

### 7a - Feed-Übersicht & Status
- [ ] Liste aller konfigurierten Quellen anzeigen
- [ ] Aktiv/Inaktiv Toggle pro Quelle
- [ ] Letzter erfolgreicher Abruf (Timestamp)
- [ ] Fehler-Status Anzeige (rot/grün Icon)
- [ ] Anzahl Artikel pro Quelle

### 7b - Feed hinzufügen
- [ ] Dialog/Formular für neue Quelle
- [ ] URL Eingabefeld mit Validierung
- [ ] Name vergeben
- [ ] Kategorie aus Dropdown wählen
- [ ] Test-Button: Prüft ob Feed erreichbar & valide
- [ ] Automatische Erkennung von Feed-Typ (RSS/Atom)

### 7c - Feed bearbeiten & löschen
- [ ] Name ändern
- [ ] URL aktualisieren
- [ ] Kategorie ändern
- [ ] Feed löschen (mit Bestätigungsdialog)
- [ ] Bulk-Operationen (mehrere Feeds gleichzeitig aktivieren/deaktivieren)

### 7d - Feed-Kategorien verwalten
- [ ] Eigene Kategorien erstellen
- [ ] Kategorien umbenennen
- [ ] Kategorien löschen (Feeds werden zu "Sonstige" verschoben)
- [ ] Farbcodierung für Kategorien

### 7e - Feed-Import/Export
- [ ] OPML Import (Standard RSS Reader Export)
- [ ] OPML Export (Backup der Feed-Liste)
- [ ] JSON Export der kompletten Konfiguration

### 7f - Erweiterte Feed-Optionen
- [ ] Abruf-Intervall pro Feed einstellbar
- [ ] Max. Artikel pro Feed begrenzen
- [ ] Custom User-Agent für Feed-Abruf
- [ ] Authentication (Basic Auth) für geschützte Feeds

## Nicht in dieser Phase
- Kein Feed-Scraping (nur RSS/Atom)
- Keine Feed-Deduplizierung über verschiedene Quellen
- Keine Feed-Qualitätsbewertung

## Abhängigkeiten
- Phase 1 (Stores, Feed-Service)
- Phase 3 (UI Komponenten)
