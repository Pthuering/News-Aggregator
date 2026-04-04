# Spec: Projekt-Matching und Keyword-Intelligence in App einbinden

## Aufgabe
Verbinde den matchService, den ProjectManager und den
Cross-Reference-Index mit der App. Synergien und Keyword-Zusammenhänge
sollen in Artikelliste, Detail-Ansicht und einer eigenen
Keyword-Übersicht sichtbar sein.

## Kontext
Lies die Header-Blöcke in:
- `src/App.jsx` → aktuelle Struktur
- `src/services/matchService.js` → matchNewArticles()
- `src/components/ProjectManager.jsx` → Projekt-CRUD
- `src/components/ArticleList.jsx` → Artikel-Anzeige
- `src/components/ArticleDetail.jsx` → Detail mit Synergien-Bereich
- `src/utils/keywordUtils.js` → buildCrossReferenceIndex()

## Änderungen

### App.jsx

**Navigation erweitern:**
- Neuer Tab "Projekte" → zeigt ProjectManager
- Neuer Tab "Keywords" → zeigt KeywordOverview

**Matching-Button:**
- Neuer Button "Synergien prüfen" (neben Klassifizieren)
- Nur aktiv wenn: API-Key gesetzt UND Projekte vorhanden
  UND klassifizierte Artikel ohne Synergien existieren
- Loading-State: "Prüfe Synergien... (3/12)"
- Ergebnis: "8 Artikel geprüft, 5 Synergien gefunden, 12 übersprungen"

**Komplett-Durchlauf-Button:**
Button "Komplett-Durchlauf" der nacheinander ausführt:
1. Feeds aktualisieren
2. Klassifizieren
3. Synergien prüfen

### src/components/KeywordOverview.jsx – NEU

```javascript
/**
 * @module KeywordOverview
 * @purpose Visualisiert den Cross-Reference-Index über alle
 *          Keyword-Quellen (Artikel, Projekte, LVB-Wissen)
 *
 * @reads    utils/keywordUtils.js → buildCrossReferenceIndex()
 * @reads    stores/articleStore.js → getArticleById()
 * @reads    stores/projectStore.js → getProjects()
 * @calledBy App.jsx → über Tab "Keywords"
 *
 * @exports  KeywordOverview (React Component)
 */
```

**UI-Aufbau:**

**Keyword-Tabelle** (Hauptansicht):
- Spalten: Keyword | Artikel | Projekte | LVB | Gesamt
- Sortierbar nach jeder Spalte (Default: Gesamt absteigend)
- Suchfeld zum Filtern der Keywords
- Farbcodierung: Keywords die in ≥2 Quellen vorkommen = hervorgehoben
  (das sind potenzielle Synergien)

**Detail-Panel** (bei Klick auf Keyword):
- Zeigt alle verbundenen Entitäten:
  - Artikel: Titel + Link zur Detail-Ansicht
  - Projekte: Name + Status-Badge
  - LVB-Einträge: Titel + Kategorie (falls Phase 8b umgesetzt)
- "Synergien aufdecken"-Hinweis wenn Keyword in Artikeln UND Projekten

**Zusammenfassungs-Leiste** (oben):
- "142 Keywords | 38 in Artikeln | 12 in Projekten | 8 Überlappungen"
- Schnellfilter-Buttons: "Alle" | "Nur Überlappungen" | "Nur Artikel" | "Nur Projekte"

### ArticleList.jsx erweitern

- Synergien-Badge pro Artikel: kleines Icon/Badge mit Zahl
  der erkannten Synergien (z.B. "🔗 2")
- Nur anzeigen wenn Synergien vorhanden
- Tooltip mit Projektnamen bei Hover

### ArticleDetail.jsx

Der Synergien-Bereich (aus Phase 3b vorbereitet) wird jetzt
befüllt:
- Pro Synergie: Projekt-Name (als Badge), Score, Begründungstext
- Sortiert nach Score (höchster zuerst)
- Wenn keine Synergien: "Keine Bezüge zu internen Projekten erkannt"

### FilterBar.jsx erweitern

- Neuer Filter: "Nur Artikel mit Synergien"
- Dropdown "Projekt: X" → zeigt nur Artikel mit Synergien
  zu diesem Projekt

## Akzeptanzkriterien
- [ ] Tab "Projekte" zeigt ProjectManager
- [ ] Tab "Keywords" zeigt KeywordOverview
- [ ] "Synergien prüfen"-Button löst Matching aus
- [ ] "Komplett-Durchlauf"-Button führt Feed→Classify→Match nacheinander aus
- [ ] `src/components/KeywordOverview.jsx`: Keyword-Tabelle mit Counts pro Quelle
- [ ] `src/components/KeywordOverview.jsx`: Keywords mit Overlap farblich hervorgehoben
- [ ] `src/components/KeywordOverview.jsx`: Klick auf Keyword zeigt verbundene Entitäten
- [ ] Synergien-Badge in Artikelliste sichtbar
- [ ] Detail-Ansicht zeigt Synergien mit Begründung
- [ ] FilterBar: "Nur mit Synergien" Filter funktioniert
- [ ] Button-States korrekt (deaktiviert wenn Voraussetzungen fehlen)
- [ ] Fortschrittsanzeige während des Matchings

## Nicht in dieser Spec
- Kein automatisches Re-Matching wenn Projekte geändert werden
- Keine grafische Keyword-Cloud (schlichte Tabelle reicht)
- Keine Bearbeitung von Keywords direkt in der Übersicht
