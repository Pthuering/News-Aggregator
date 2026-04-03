# Spec: Filter und Detail-Ansicht einbinden

## Aufgabe
Verbinde FilterBar und ArticleDetail mit der App, sodass die
Artikelliste filterbar ist und Artikel angeklickt werden können.

## Kontext
Lies die Header-Blöcke in:
- `src/App.jsx` → aktuelle Struktur
- `src/components/FilterBar.jsx` → onFilterChange, Props
- `src/components/ArticleDetail.jsx` → articleId, onBack
- `src/stores/articleStore.js` → getArticlesByFilter()

## Änderungen

### App.jsx

Die App bekommt drei Ansichten (einfacher State, kein Router):
1. **Artikelliste** (Default) – FilterBar + ArticleList
2. **Artikel-Detail** – ArticleDetail für einen ausgewählten Artikel
3. **Einstellungen** – Settings-Komponente

Navigation: Tab-Leiste oben mit "Artikel" und "Einstellungen".
Detail-Ansicht wird erreicht durch Klick auf einen Artikel in der Liste.

**Artikelliste-Flow:**
1. App lädt alle Artikel: `articleStore.getAllArticles()`
2. FilterBar gibt `FilterCriteria` an App
3. App ruft `articleStore.getArticlesByFilter(filter)` auf
4. Gefilterte Artikel werden an ArticleList übergeben
5. Klick auf Artikel → wechselt zu Detail-Ansicht

**Verfügbare Tags berechnen:**
- Aus allen klassifizierten Artikeln die Tags extrahieren
- Deduplizieren und alphabetisch sortieren
- Als `availableTags`-Prop an FilterBar übergeben

**Article-Counts:**
- `total`: Gesamtzahl aller Artikel
- `filtered`: Anzahl nach Filterung
- `unclassified`: Anzahl ohne Scores
- Als `articleCounts`-Prop an FilterBar übergeben

### ArticleList.jsx erweitern

- Jeder Artikel ist klickbar (onClick → App wechselt zu Detail)
- Cursor: pointer bei Hover
- Bookmark-Icon in der Liste (kleiner Stern, ohne Detail-Ansicht umschaltbar)

## Akzeptanzkriterien
- [ ] FilterBar ist über der Artikelliste sichtbar
- [ ] Score-Slider filtern die Liste in Echtzeit
- [ ] Tag-Filter funktioniert
- [ ] Freitextsuche funktioniert
- [ ] Klick auf Artikel öffnet Detail-Ansicht
- [ ] Zurück-Button in Detail führt zurück zur gefilterten Liste
- [ ] Filter-State bleibt erhalten nach Zurück aus Detail
- [ ] Tab-Navigation zwischen Artikel und Einstellungen
- [ ] Zähler in FilterBar zeigt korrekte Werte

## Nicht in dieser Spec
- Kein URL-basiertes Routing
- Keine Sortier-Optionen
