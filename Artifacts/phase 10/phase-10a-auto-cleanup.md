# Spec: Auto-Bereinigung irrelevanter Artikel

## Aufgabe
Nach der Klassifizierung sollen Artikel, die in allen vier
Bewertungslinsen einen Score von 0 haben, automatisch aus
der Datenbank gelöscht werden.

## Kontext
Lies die Header-Blöcke in:
- `src/services/classifyService.js` → classifyNew(), classifyBatchWithWorker()
- `src/stores/articleStore.js` → updateArticle(), deleteArticle()

## Änderungen

### articleStore.js erweitern

Falls noch nicht vorhanden, eine `deleteArticle(id)` Funktion
ergänzen, die den Artikel aus der IndexedDB entfernt.

```javascript
export async function deleteArticle(id) {
  const db = await openDB();
  await db.delete("articles", id);
}
```

### classifyService.js anpassen

Nach dem Speichern der Klassifikationsergebnisse in
`classifyNew()` (sowohl im Batch- als auch im Einzel-Modus):

1. Prüfe ob alle vier Scores exakt 0 sind:
   ```
   scores.oepnv_direkt === 0 &&
   scores.tech_transfer === 0 &&
   scores.foerder === 0 &&
   scores.markt === 0
   ```
2. Wenn ja: Artikel sofort per `deleteArticle(id)` entfernen
3. Zähler `removed` im Ergebnis mitführen

### Rückgabewert erweitern

`classifyNew()` gibt aktuell `{ classified, failed, errors }` zurück.
Erweitere um:
```
{ classified, failed, removed, errors }
```
`removed` = Anzahl der Artikel die wegen Komplett-Irrelevanz
gelöscht wurden. `classified` zählt nur die behaltenen Artikel.

### UI: Feedback in App.jsx

Nach der Klassifizierung die Meldung anpassen:
- Aktuell: "X klassifiziert, Y fehlgeschlagen"
- Neu: "X klassifiziert, Z entfernt (irrelevant), Y fehlgeschlagen"
- Nur anzeigen wenn `removed > 0`

### classifySingle() ebenfalls anpassen

Auch bei Einzel-Klassifikation via `classifySingle()` prüfen
und ggf. löschen statt speichern. Rückgabe `null` wenn gelöscht.

## Akzeptanzkriterien
- [ ] Artikel mit allen Scores = 0 werden nach Klassifikation gelöscht
- [ ] `deleteArticle()` existiert im articleStore
- [ ] `classifyNew()` gibt `removed`-Zähler zurück
- [ ] UI zeigt Anzahl entfernter Artikel an
- [ ] `classifySingle()` löscht ebenfalls bei Komplett-0
- [ ] Bereits klassifizierte Artikel werden nicht nachträglich geprüft

## Nicht in dieser Spec
- Kein konfigurierbarer Schwellwert (nur exakt alle 0)
- Kein Papierkorb / Undo für gelöschte Artikel
- Keine Batch-Bereinigung bestehender Artikel
