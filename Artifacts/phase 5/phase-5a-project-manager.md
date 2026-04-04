# Spec: Projekt-Manager-Komponente

## Aufgabe
Erstelle die UI zum Anlegen, Bearbeiten und Löschen interner Projekte,
die für das Synergien-Matching genutzt werden.

## Kontext
Lies `ProjectConfig` in `/docs/ARCHITECTURE.md`.
Lies den Header-Block in:
- `src/stores/projectStore.js` → CRUD-Funktionen

## Datei

### src/components/ProjectManager.jsx

```javascript
/**
 * @module ProjectManager
 * @purpose CRUD-UI für interne Projekte (Synergien-Matching-Basis)
 *
 * @reads    stores/projectStore.js → getProjects()
 * @writes   stores/projectStore.js → saveProject(), deleteProject()
 * @calledBy App.jsx → über Navigation/Tab
 *
 * @exports  ProjectManager (React Component)
 */
```

## UI-Aufbau

**Projektliste**
- Alle Projekte als Karten oder Listeneinträge
- Pro Projekt: Name, Status-Badge (aktiv/geplant/abgeschlossen),
  Kurzfassung der Beschreibung (erste 100 Zeichen)
- Bearbeiten-Button, Löschen-Button (mit Bestätigung)

**Projekt-Formular** (für Neu und Bearbeiten)
- Name: Textfeld (Pflicht)
- Beschreibung: Textarea, 3-5 Sätze (Pflicht)
  - Hinweis: "Beschreibe das Projekt so, dass eine KI Bezüge
    zu Fachartikeln erkennen kann."
- Technologien: Tag-Input (komma-separiert oder einzeln hinzufügbar)
- Status: Dropdown (aktiv / geplant / abgeschlossen)
- Herausforderungen: Textarea, eine pro Zeile
  - Hinweis: "Offene Probleme oder Fragestellungen, bei denen
    externe Impulse helfen könnten."
- Speichern-Button, Abbrechen-Button

**ID-Generierung:**
- Neue Projekte bekommen eine ID: `proj_` + 8 zufällige alphanumerische Zeichen

## Akzeptanzkriterien
- [ ] Projekte können angelegt werden
- [ ] Projekte können bearbeitet werden
- [ ] Projekte können gelöscht werden (mit Bestätigung)
- [ ] Alle Felder von ProjectConfig sind editierbar
- [ ] Pflichtfeld-Validierung für Name und Beschreibung
- [ ] Projektliste aktualisiert sich nach Speichern/Löschen
- [ ] Status-Badge zeigt korrekten Status

## Nicht in dieser Spec
- Kein Import aus YAML/JSON (manuelle Eingabe reicht)
- Kein Synergien-Matching (nächste Spec)
