# Spec: Förder-Deadline-Alerts

## Aufgabe
Erweitere die Klassifikation, sodass Artikel die Förderfristen
enthalten diese automatisch extrahieren und als Alerts anzeigen.

## Kontext
Lies die Header-Blöcke in:
- `src/config/prompts.js` → getClassifyPrompt()
- `src/services/classifyService.js` → Klassifikations-Flow
- `src/stores/articleStore.js` → Artikel-Schema

## Änderungen

### Datenmodell erweitern

`ClassifiedArticle` bekommt ein optionales Feld:
```
deadline: {
  date: string,         // ISO-8601, extrahiertes Datum
  label: string,        // z.B. "BMDV Förderaufruf Digitalisierung"
  daysRemaining: number  // berechnet bei Anzeige
} | null
```

### Klassifikations-Prompt erweitern

In `getClassifyPrompt()` eine zusätzliche Anweisung ergänzen:
"Wenn der Artikel eine Förderfrist, Einreichungsfrist oder
Bewerbungsdeadline enthält, extrahiere das Datum und eine
kurze Bezeichnung. Gib null zurück wenn keine Frist erkennbar."

Output-Format erweitern um:
```json
"deadline": {
  "date": "2026-06-30",
  "label": "BMDV Förderaufruf Digitalisierung"
}
```

### UI: Deadline-Banner

In der Artikelliste und im Dashboard:
- Artikel mit Deadlines bekommen ein rotes/oranges Banner:
  "⏰ Frist: 30.06.2026 (89 Tage) – BMDV Förderaufruf"
- Farbe: > 60 Tage grün, 30-60 Tage orange, < 30 Tage rot
- Im Dashboard: eigener Bereich "Anstehende Fristen"
  sortiert nach Dringlichkeit

## Akzeptanzkriterien
- [ ] Prompt extrahiert Deadlines aus Förder-Artikeln
- [ ] Deadline wird im Artikel gespeichert
- [ ] Banner zeigt Frist mit Countdown in der Liste
- [ ] Farbkodierung nach Dringlichkeit
- [ ] Dashboard zeigt anstehende Fristen

## Nicht in dieser Spec
- Keine E-Mail/Push-Benachrichtigungen
- Keine Kalender-Integration
