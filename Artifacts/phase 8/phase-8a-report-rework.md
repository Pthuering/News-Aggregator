# Spec: Report-Generierung Umbau + Auto-Report

## Aufgabe
Ersetze das starre Konfigurations-Formular (Zielgruppe/Fokus/Länge) im
ReportGenerator durch ein Freitext-Feld, in dem der Nutzer den konkreten
Zweck der Report-Generierung angeben kann. Default (leeres Feld) erzeugt
einen kompakten Key-Facts-Überblick statt Empfehlungs-Report.

Zusätzlich: neuer **"Auto-Report"-Button** in der Hauptansicht, der
die signifikantesten Artikel der letzten Klassifizierungsrunde
automatisch auswählt und einen Report generiert, der pro Artikel
begründet, *warum* er signifikant ist.

## Kontext
Lies die Header-Blöcke in:
- `src/components/ReportGenerator.jsx` → Props, State, handleGenerate()
- `src/services/reportService.js` → generateReport(config, onChunk)
- `src/config/prompts.js` → getReportPrompt(config)

Lies `ReportConfig` in `ARCHITECTURE.md`.

## Dateien

### src/config/prompts.js – erweitern

`getReportPrompt()` Signatur ändern:

```javascript
/**
 * @module prompts
 * @purpose System-Prompts für alle LLM-Calls
 *
 * @exports
 *   getReportPrompt(config: { purpose?: string }): string
 *     → Baut System-Prompt basierend auf Freitext-Zweck
 *     → Leerer purpose: Key-Facts-Überblick-Modus
 *     → Gefüllter purpose: Report richtet sich nach Nutzereingabe
 */
```

**Bisherige Audience/Focus/Length-Logik entfernen.**

**Neuer Prompt-Aufbau:**

Wenn `purpose` leer:
> Du bist ein Analyst in der Digitalisierungsabteilung eines deutschen
> Verkehrsunternehmens (ÖPNV). Erstelle einen kompakten Überblick über die
> bereitgestellten Artikel. Fasse die Key Facts jedes Artikels zusammen,
> identifiziere Potentiale und ordne die Themen ein. Keine konkreten
> Handlungsempfehlungen, sondern sachliche Einordnung.

Wenn `purpose` gefüllt:
> Du bist ein Analyst in der Digitalisierungsabteilung eines deutschen
> Verkehrsunternehmens (ÖPNV). Erstelle einen Report mit folgendem Zweck:
> {purpose}
> Richte den Report konsequent auf diesen Zweck aus.

### src/services/reportService.js – anpassen

```javascript
/**
 * @module reportService
 * @purpose Generiert Markdown-Reports aus ausgewählten Artikeln
 *
 * @reads    config/prompts.js → getReportPrompt()
 * @reads    stores/articleStore.js → getArticleById()
 * @reads    stores/settingsStore.js → getNvidiaApiKey()
 * @writes   nichts
 * @calledBy components/ReportGenerator.jsx
 *
 * @dataflow
 *   articleIds + purpose → Artikel laden → Prompt bauen
 *   → API-Call (Streaming) → Markdown-Response zurückgeben
 *
 * @exports
 *   generateReport(config: ReportConfig, onChunk): Promise<string>
 *     → config.purpose: string (Freitext, kann leer sein)
 *     → Bisherige config.audience/focus/length entfallen
 */
```

- `getReportPrompt()` nur noch mit `{ purpose }` aufrufen
- Bisherige `audience`, `focus`, `length` Parameter entfernen

### src/components/ReportGenerator.jsx – umbauen

```javascript
/**
 * @module ReportGenerator
 * @purpose Modal für Report-Konfiguration und -Generierung
 *
 * @reads    stores/articleStore.js → getArticleById()
 * @calls    services/reportService.js → generateReport()
 * @calledBy App.jsx → wird geöffnet mit Artikel-IDs
 *
 * @exports  ReportGenerator (React Component)
 *   Props:
 *     articleIds: string[] – IDs der ausgewählten Artikel
 *     onClose(): void – Modal schließen
 */
```

**Bisheriges Konfigurations-Formular entfernen:**
- Zielgruppe Radio-Buttons → entfernen
- Fokus Radio-Buttons → entfernen
- Länge Radio-Buttons → entfernen
- Checkbox "Eigene Notizen einbeziehen" → beibehalten

**Neues UI-Element:**
- Textarea-Feld: "Was soll dieser Report leisten?"
  - Placeholder: "Leer lassen für einen kompakten Überblick über die Key Facts"
  - State: `purpose` (string, default: "")
  - Mehrzeilig, min 2 Zeilen, max ~500 Zeichen
- Wird als `config.purpose` an `generateReport()` übergeben

## Dataflow

```
Manueller Report:
  User tippt Purpose → ReportGenerator state
    → generateReport({ articleIds, purpose, includeUserNotes })
      → getReportPrompt({ purpose })
        → System-Prompt (überblick oder zweckgebunden)
      → buildUserMessage(articles, includeUserNotes)
      → API-Call (Streaming) → onChunk → Live-Anzeige

Auto-Report:
  "Auto-Report" Button → selectSignificantArticles()
    → Scoring nach Kriterien-Tabelle → Top 15 auswählen
    → Preview-Dialog mit Artikel-Liste + Signifikanz-Gründe
    → "Generieren" → ReportGenerator öffnet sich
      → purpose = "Signifikanz-Report..."
      → generateReport() mit enriched context (Gründe im User-Message)
      → Streaming-Anzeige
```

## Auto-Report: Signifikanteste Artikel zusammenfassen

### Konzept
Ein Button "Auto-Report" in der Hauptansicht (neben Klassifizieren/
Report erstellen) der:
1. Die zuletzt klassifizierten Artikel analysiert
2. Die signifikantesten automatisch auswählt
3. Einen Report generiert der pro Artikel begründet, WARUM er relevant ist

### Signifikanz-Kriterien (automatische Auswahl)

Ein Artikel gilt als signifikant, wenn mindestens eines zutrifft:

| Kriterium | Bedingung | Begründungstyp im Report |
|---|---|---|
| **Hohe ÖV-Relevanz** | `oepnv_direkt` ≥ 7 | "Direkt relevant für den ÖPNV-Betrieb weil..." |
| **Starkes Transferpotenzial** | `tech_transfer` ≥ 7 | "Technologie-Transfer-Potenzial: könnte in 1-3 Jahren relevant werden weil..." |
| **Fördersignal** | `foerder` ≥ 6 | "Fördermöglichkeit / regulatorisches Signal: ..." |
| **Marktbewegung** | `markt` ≥ 7 | "Wettbewerbs-/Marktbewegung: neue Akteure, Funding, Produktlaunch..." |
| **Projekt-Synergie** | `synergies.length > 0` mit Score ≥ 6 | "Synergie mit Projekt '{name}': {relevance}" |
| **LVB-Bezug** | `lvb_status === "in_planung"` oder `"neu"` | "LVB-Bezug: Technologie ist bei der LVB {status}..." |
| **Trend-Signal** | Tag kommt in ≥3 Artikeln der Runde vor | "Trend-Signal: '{tag}' taucht in mehreren aktuellen Artikeln auf" |

**Top-N-Auswahl**: Maximal 15 Artikel, sortiert nach Summe der
höchsten Scores + Synergien-Bonus. Falls weniger als 3 die Kriterien
erfüllen → Hinweis "Keine signifikanten Artikel in dieser Runde".

### src/services/autoReportService.js – NEU

```javascript
/**
 * @module autoReportService
 * @purpose Wählt signifikante Artikel automatisch aus und generiert
 *          einen begründeten Report
 *
 * @reads    stores/articleStore.js → getAllArticles(), classifiedAt
 * @reads    stores/projectStore.js → getProjects() (für Synergienamen)
 * @reads    utils/keywordUtils.js → normalizeKeywords() (für Trend-Erkennung)
 * @calls    services/reportService.js → generateReport()
 * @calledBy App.jsx → "Auto-Report"-Button
 *
 * @exports
 *   selectSignificantArticles(options?: { since?: Date }):
 *     Promise<SignificantArticle[]>
 *     → Wählt und begründet die wichtigsten Artikel
 *
 *   generateAutoReport(onChunk): Promise<string>
 *     → Wählt Artikel aus, baut Kontext, generiert streaming Report
 *
 * @types
 *   SignificantArticle: {
 *     article: ClassifiedArticle,
 *     reasons: SignificanceReason[]
 *   }
 *   SignificanceReason: {
 *     type: "oepnv" | "transfer" | "foerder" | "markt" | "synergie" | "lvb" | "trend",
 *     label: string,  // Kurzbeschreibung für UI und Prompt
 *     score: number    // Stärke des Signals (0-10)
 *   }
 */
```

### Prompt für Auto-Report

`getAutoReportPrompt()` in `src/config/prompts.js`:

```
Du bist ein Analyst in der Digitalisierungsabteilung eines deutschen
Verkehrsunternehmens (ÖPNV). Erstelle einen Signifikanz-Report über
die folgenden als besonders relevant erkannten Artikel.

Gliedere den Report wie folgt:
1. **Executive Summary** (3-5 Sätze): Was sind die wichtigsten
   Entwicklungen dieser Runde?
2. **Pro Artikel ein Abschnitt** mit:
   - Titel und Kernaussage (1-2 Sätze)
   - **Warum relevant**: Nutze die mitgelieferten Signifikanz-Gründe
     als Ausgangspunkt, ergänze mit eigener Einschätzung
   - **Einordnung**: Wie passt das in den aktuellen ÖPNV-Kontext?
3. **Trends & Muster**: Gibt es übergreifende Themen oder Muster
   die sich aus den Artikeln zusammen ergeben?
4. **Handlungsimpulse** (optional): Konkrete nächste Schritte,
   falls sich welche aufdrängen

Schreibe sachlich, konkret und auf Deutsch.
```

### User-Message-Aufbau für Auto-Report

Pro signifikantem Artikel wird mitgegeben:
```
--- Artikel {n} ---
Titel: {title}
Zusammenfassung: {summary_de}
Tags: {tags}
Scores: ÖV={oepnv_direkt}, TT={tech_transfer}, Förder={foerder}, Markt={markt}
Signifikanz-Gründe:
{reasons als Bullet-Points mit Label}
{Falls Synergien: "Synergie mit Projekt '{projektname}': {relevance}"}
```

### UI in App.jsx

**"Auto-Report"-Button:**
- Platzierung: Obere Aktionsleiste, neben "Report erstellen"
- Label: "Auto-Report"
- Nur aktiv wenn: Klassifizierte Artikel vorhanden
- Klick → `selectSignificantArticles()` → Preview-Dialog:
  - "12 signifikante Artikel gefunden (von 47 klassifizierten)"
  - Liste der Artikel mit Signifikanz-Badges (farbige Chips pro Grund)
  - Buttons: "Report generieren" | "Abbrechen"
- "Report generieren" → öffnet ReportGenerator mit:
  - Vorausgewählte Artikel-IDs
  - Purpose automatisch befüllt: "Signifikanz-Report: Executive Summary
    und Einordnung der wichtigsten Entwicklungen dieser Runde"
  - Nutzer kann Purpose noch anpassen vor Generierung

## Akzeptanzkriterien

### Report-Umbau
- [ ] `src/components/ReportGenerator.jsx`: Textarea-Feld für Report-Zweck vorhanden
- [ ] `src/components/ReportGenerator.jsx`: Bisherige Radio-Buttons (Zielgruppe/Fokus/Länge) entfernt
- [ ] `src/config/prompts.js`: `getReportPrompt()` akzeptiert `{ purpose }` statt `{ audience, focus, length }`
- [ ] Leeres Purpose-Feld → Key-Facts-Überblick ohne Empfehlungen
- [ ] Gefülltes Purpose-Feld → Report orientiert sich am angegebenen Zweck
- [ ] Checkbox "Eigene Notizen einbeziehen" funktioniert weiterhin
- [ ] Streaming-Anzeige funktioniert weiterhin
- [ ] `src/services/reportService.js`: Signatur bereinigt, keine audience/focus/length mehr

### Auto-Report
- [ ] `src/services/autoReportService.js`: `selectSignificantArticles()` wählt nach Kriterien-Tabelle
- [ ] `src/services/autoReportService.js`: Jeder Artikel hat `reasons[]` mit Typ und Label
- [ ] `src/services/autoReportService.js`: Maximum 15 Artikel, Minimum 3 sonst Hinweis
- [ ] `src/services/autoReportService.js`: Trend-Erkennung über wiederholte Tags
- [ ] `src/config/prompts.js`: `getAutoReportPrompt()` erzeugt strukturierten Signifikanz-Report
- [ ] App.jsx: "Auto-Report"-Button in Aktionsleiste, deaktiviert ohne klassifizierte Artikel
- [ ] App.jsx: Preview-Dialog zeigt gefundene Artikel mit Signifikanz-Badges
- [ ] ReportGenerator: Akzeptiert vorausgefüllte Artikel-IDs und Purpose vom Auto-Report

## Nicht in dieser Spec
- Kein Abspeichern von Purpose-Texten oder -Historie
- Keine Vorlagen/Presets für häufige Zwecke (könnte spätere Erweiterung sein)
- Keine automatische LVB-Kontext-Einbindung (→ Phase 8b)
- Kein automatisches Versenden des Auto-Reports (nur Anzeige)
