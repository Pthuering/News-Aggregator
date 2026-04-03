# Spec: Parallele KI-Klassifizierung (Phase 7)

## Zusammenfassung
Optimierung der KI-Klassifizierung durch parallele API-Anfragen statt sequentieller Verarbeitung.

## Aktuelles Problem
- Batches von 5 Artikeln werden nacheinander verarbeitet
- Bei 40 unklassifizierten Artikeln = 8 API-Calls à ~5-10 Sekunden = 40-80 Sekunden Wartezeit
- Nutzer sieht nur "Klassifiziere... (3/40)"

## Optimierung: Parallele Verarbeitung

### 7d-1 - Vier parallele Worker-Calls
- [ ] Statt einem Call mit Batch 5 → **vier Calls gleichzeitig**
- [ ] Jeder Call bearbeitet einen Teil der Artikel
- [ ] Beispiel: 40 Artikel → 4 Calls à 10 Artikel parallel
- [ ] Theoretisch 4x schneller

### 7d-2 - Intelligente Aufteilung
- [ ] Anzahl paralleler Calls dynamisch (2-8 je nach Artikelmenge)
- [ ] Bei < 10 Artikeln: nur 1-2 Calls
- [ ] Bei > 50 Artikeln: 6-8 Calls
- [ ] Berücksichtigung API-Rate-Limits

### 7d-3 - Fortschrittsanzeige
- [ ] Echte Fortschrittsanzeige pro Worker-Call
- [ ] Gesamtfortschritt über alle Calls
- [ ] Visualisierung: 4 Fortschrittsbalken oder zusammengefasst
- [ ] "Call 1: 8/10, Call 2: 5/10, Call 3: 3/10, Call 4: 0/10"

### 7d-4 - Fehlerbehandlung
- [ ] Ein fehlgeschlagener Call stoppt nicht die anderen
- [ ] Retry nur für den fehlgeschlagenen Call
- [ ] Am Ende: Ergebnis aus allen Calls zusammenführen

## Technische Umsetzung

### Beispiel-Code (Konzept)
```javascript
// Aktuell: Sequentiell
for (const batch of batches) {
  await classifyBatch(batch); // Wartet auf jeden Batch
}

// Optimiert: Parallel mit Promise.all
const workers = 4;
const chunks = splitIntoChunks(articles, workers);
const results = await Promise.all(
  chunks.map(chunk => classifyBatch(chunk))
);
```

### Worker-Anpassung
- [ ] Worker muss mehr als 5 Artikel pro Call verarbeiten können
- [ ] Oder: Mehrere Worker-Instanzen (rss-proxy-1, rss-proxy-2, ...)
- [ ] Alternative: Ein Worker, aber Queue-System für parallele Requests

## Performance-Ziele
- [ ] 20 Artikel: < 10 Sekunden (statt ~20s)
- [ ] 50 Artikel: < 15 Sekunden (statt ~50s)
- [ ] 100 Artikel: < 30 Sekunden (statt ~100s)

## Risiken & Lösungen
| Risiko | Lösung |
|--------|--------|
| API Rate-Limit | Max 4-8 Calls parallel, Exponential Backoff |
| Worker überlastet | Queue-System oder mehrere Worker-Instanzen |
| Browser-Limit paralleler Requests | Web Workers oder Service Worker nutzen |

## Abhängigkeiten
- Phase 2d (aktuelle Klassifizierung muss funktionieren)
- Möglicherweise mehrere Cloudflare Worker-Instanzen
