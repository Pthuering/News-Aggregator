# Spec: Report-Generator-Komponente

## Aufgabe
Erstelle die UI zum Auswählen von Artikeln, Konfigurieren und
Generieren von Reports.

## Kontext
Lies die Header-Blöcke in:
- `src/services/reportService.js` → generateReport()
- `src/stores/articleStore.js` → getArticleById()

Lies `ReportConfig` in `/docs/ARCHITECTURE.md`.

## Datei

### src/components/ReportGenerator.jsx

```javascript
/**
 * @module ReportGenerator
 * @purpose Modal/Panel für Report-Konfiguration und -Generierung
 *
 * @reads    stores/articleStore.js → Artikel-Daten für Vorschau
 * @calls    services/reportService.js → generateReport()
 * @calledBy App.jsx → wird geöffnet mit Liste von Artikel-IDs
 *
 * @exports  ReportGenerator (React Component)
 *   Props:
 *     articleIds: string[] – IDs der ausgewählten Artikel
 *     onClose(): void – Modal schließen
 */
```

## UI-Aufbau

**1. Artikel-Übersicht**
- Liste der ausgewählten Artikel (Titel + Quelle)
- Möglichkeit, einzelne Artikel aus der Auswahl zu entfernen
- Anzahl: "5 Artikel ausgewählt"

**2. Konfigurations-Formular**
- Zielgruppe (Radio-Buttons):
  Geschäftsführung | Fachabteilung | Förderantrag-Vorbereitung
- Fokus (Radio-Buttons):
  Technologie | Wettbewerb | Förderpotential | Allgemein
- Länge (Radio-Buttons):
  Kurz | Mittel | Detail
- Checkbox: "Eigene Notizen einbeziehen"
- Defaults: Fachabteilung, Allgemein, Mittel, Notizen ein

**3. Generieren-Button**
- Löst `generateReport()` aus
- Loading-State: "Report wird generiert..."
- Deaktiviert ohne API-Key oder ohne Artikel

**4. Ergebnis-Bereich**
- Markdown gerendert als HTML (einfacher Markdown-to-HTML-Renderer)
- Drei Aktions-Buttons:
  - "Kopieren" – kopiert Markdown in Zwischenablage
  - "Als Markdown speichern" – Download als .md-Datei
  - "Neu generieren" – gleiche Config, neuer API-Call

## Artikel-Auswahl-Flow

Die Artikel werden in der Artikelliste ausgewählt. Dafür braucht
die ArticleList eine Checkbox pro Artikel und einen Button
"Report erstellen (n)", der den ReportGenerator mit den
gewählten IDs öffnet.

### ArticleList.jsx erweitern
- Checkbox links neben jedem Artikel
- Floating-Button am unteren Rand: "Report erstellen (3)"
  - Nur sichtbar wenn mindestens 1 Artikel gewählt
  - Zeigt Anzahl gewählter Artikel
  - Klick öffnet ReportGenerator als Modal/Overlay

## Akzeptanzkriterien
- [ ] Artikel können in der Liste per Checkbox ausgewählt werden
- [ ] "Report erstellen"-Button öffnet ReportGenerator mit Auswahl
- [ ] Alle Konfigurations-Optionen sind wählbar
- [ ] Report wird generiert und als gerenedertes Markdown angezeigt
- [ ] Kopieren-Button kopiert Markdown in Zwischenablage
- [ ] Download-Button speichert .md-Datei
- [ ] Einzelne Artikel können aus der Auswahl entfernt werden
- [ ] Loading-State während der Generierung
- [ ] Modal lässt sich schließen

## Nicht in dieser Spec
- Kein PDF-Export (Markdown + Copy reicht für den Start)
- Kein Speichern generierter Reports in der DB
