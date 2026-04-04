# Spec: Feed-Validierung & Auto-Discovery (Phase 9c)

## Aufgabe
Erstelle einen Service, der Feed-URLs validiert, den Feed-Typ
automatisch erkennt (RSS/Atom), und bei Eingabe einer normalen
Website-URL versucht, den zugehörigen RSS-Feed automatisch zu finden.

Dieser Service wird vom SourceManager-Dialog (Phase 9b) aufgerufen,
wenn der Nutzer eine neue Quelle hinzufügt und „Feed testen" klickt.

## Kontext
Lies die Header-Blöcke in:
- `src/services/feedService.js` → fetchSingleFeed(), XML-Parsing
- `worker/cors-proxy.js` → CORS-Proxy für externe Requests

## Datei

### src/services/sourceValidationService.js

```javascript
/**
 * @module sourceValidationService
 * @purpose Validiert Feed-URLs, erkennt Typ, findet Feeds automatisch
 *
 * @reads    nichts
 * @writes   nichts
 * @calledBy components/SourceManager.jsx → "Feed testen" Button
 * @calls    worker/cors-proxy → für externe HTTP-Requests
 *
 * @dataflow
 *   URL eingeben → validateFeed() → CORS-Proxy → Response analysieren
 *   → Feed-Typ erkennen → Metadaten extrahieren → ValidationResult
 *
 * @exports
 *   validateFeed(url: string): Promise<ValidationResult>
 *     → Prüft ob URL ein gültiger RSS/Atom-Feed ist
 *     → ValidationResult: {
 *         valid: boolean,
 *         feedType: "rss"|"atom"|null,
 *         title: string|null,
 *         description: string|null,
 *         articleCount: number,
 *         sampleArticles: SampleArticle[],
 *         error: string|null
 *       }
 *
 *   discoverFeed(websiteUrl: string): Promise<DiscoveryResult>
 *     → Versucht RSS-Feed einer normalen Website zu finden
 *     → DiscoveryResult: {
 *         found: boolean,
 *         feeds: DiscoveredFeed[],
 *         error: string|null
 *       }
 *     → DiscoveredFeed: { url, title, type }
 *
 *   detectFeedType(xml: string): "rss"|"atom"|null
 *     → Erkennt Feed-Typ anhand des XML-Inhalts
 */
```

## Validierungs-Ablauf

`validateFeed(url)`:

1. **URL-Format prüfen**
   - Gültige URL-Syntax? (try new URL())
   - HTTPS bevorzugt, HTTP akzeptiert
   - Leere / offensichtlich ungültige URLs abfangen
2. **Feed abrufen** (über CORS-Proxy)
   - Timeout: 10 Sekunden
   - Content-Type prüfen: XML/RSS erwartet
3. **XML parsen**
   - Ist es valides XML?
   - Feed-Typ erkennen (RSS 2.0, Atom, RSS 1.0)
4. **Metadaten extrahieren**
   - Feed-Titel (`<channel><title>` / `<feed><title>`)
   - Beschreibung (`<description>` / `<subtitle>`)
   - Anzahl Einträge
5. **Sample-Artikel** (erste 3)
   - Titel, Link, Datum
   - Werden als Vorschau im Dialog angezeigt
6. **Ergebnis** als `ValidationResult` zurückgeben

## Feed-Discovery-Ablauf

`discoverFeed(websiteUrl)`:

Wenn der Nutzer keine Feed-URL kennt, sondern nur die Website-URL
eingeben möchte (z.B. `https://heise.de`):

1. **HTML der Website laden** (über CORS-Proxy)
2. **`<link rel="alternate">` Tags suchen**
   ```html
   <link rel="alternate" type="application/rss+xml" href="..." title="...">
   <link rel="alternate" type="application/atom+xml" href="..." title="...">
   ```
3. **Gängige Feed-Pfade probieren** (Fallback)
   - `/feed/`
   - `/rss/`
   - `/feed.xml`
   - `/rss.xml`
   - `/atom.xml`
   - `/index.xml`
4. **Gefundene Feeds validieren** (mit `validateFeed()`)
5. **Ergebnis**: Liste aller gefundenen Feeds mit Typ und Titel

## UI-Integration (in SourceManager, Phase 9b)

Wenn der Nutzer eine URL eingibt und „Feed testen" klickt:

1. Erst `validateFeed(url)` versuchen
2. Falls kein gültiger Feed → `discoverFeed(url)` versuchen
3. Ergebnisse anzeigen:
   - **Gültiger Feed**: Grüner Haken, Metadaten anzeigen,
     Name-Feld auto-befüllen mit Feed-Titel
   - **Feed entdeckt**: Liste der gefundenen Feeds, Nutzer wählt aus
   - **Nichts gefunden**: Roter Hinweis „Kein Feed unter dieser URL
     gefunden. Bitte prüfe die URL oder gib direkt eine Feed-URL ein."
4. Ladezustand: Spinner während Validierung

## Fehlerbehandlung

| Fehler | Meldung |
|--------|---------|
| URL ungültig | „Bitte gib eine gültige URL ein." |
| Timeout | „Die Website antwortet nicht. Versuche es später erneut." |
| Kein XML | „Die URL liefert keinen RSS/Atom-Feed." |
| XML parse error | „Der Feed enthält ungültiges XML." |
| CORS/Netzwerk | „Der Feed konnte nicht abgerufen werden." |
| Leer (0 Artikel) | „Der Feed ist gültig, enthält aber keine Artikel." |

## Akzeptanzkriterien
- [ ] `validateFeed()` erkennt gültige RSS 2.0 Feeds
- [ ] `validateFeed()` erkennt gültige Atom Feeds
- [ ] Ungültige URLs werden sauber abgefangen
- [ ] Sample-Artikel werden korrekt extrahiert
- [ ] `discoverFeed()` findet Feed über `<link>` Tags
- [ ] `discoverFeed()` findet Feed über gängige Pfade
- [ ] Feed-Typ (RSS/Atom) wird korrekt erkannt
- [ ] Timeout wird eingehalten (max 10s)
- [ ] Fehlermeldungen sind klar und hilfreich
- [ ] Auto-Befüllung des Namens aus Feed-Titel funktioniert

## Nicht in dieser Phase
- Keine regelmäßige Feed-Health-Checks (cron)
- Keine Bewertung der Feed-Qualität
- Keine Erkennung von Paywalls
- Kein Scraping von Websites ohne Feed

## Abhängigkeiten
- Phase 9a (sourceStore)
- Phase 9b (SourceManager-Dialog nutzt diesen Service)
- Phase 1 (CORS-Proxy Worker)
