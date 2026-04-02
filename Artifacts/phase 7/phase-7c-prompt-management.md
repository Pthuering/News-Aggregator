# Spec: Prompt-Verwaltung (Phase 7)

## Zusammenfassung
Verwaltung und Aktualisierung der KI-Prompts über die UI, da diese konkrete Begriffe enthalten, die über Zeit outdated werden können.

## Hintergrund
Die KI-Prompts (Phase 2a) enthalten spezifische Begriffe wie:
- Unternehmen: "INIT", "IVU", "Optibus", "Via", "Swiftly"
- Technologien: "GTFS", "SIRI", "NeTEx", "Edge-AI"
- Förderprogramme: "BMDV", "BMWK", "EU-Förderprogramme"
- Politik: "Mobilitätswende", "KI-Strategie der Bundesregierung"

Diese können sich ändern oder veralten (neue Unternehmen, neue Technologien, neue Ministerien).

## Features / Stichpunkte

### 7c-1 - Prompt-Übersicht
- [ ] Liste aller System-Prompts anzeigen
- [ ] Kategorien: Klassifikation, Matching, Reports, Open Search
- [ ] Letzte Aktualisierung anzeigen (Timestamp)
- [ ] Indikator für "möglicherweise veraltet" (> 6 Monate alt)

### 7c-2 - Prompt bearbeiten
- [ ] Volltext-Editor für jeden Prompt
- [ ] Syntax-Highlighting für Platzhalter ({{variable}})
- [ ] Preview: Wie sieht der Prompt mit echten Daten aus?
- [ ] Versionierung: Alte Versionen speichern & wiederherstellen
- [ ] Diff-Ansicht: Was wurde geändert?

### 7c-3 - Prompt aktualisieren ("Refresh")
- [ ] **Button "Prompts aktualisieren"** in den Settings
- [ ] Prüft auf neue Versionen der Standard-Prompts
- [ ] Zeigt Änderungen an (Changelog)
- [ ] Manuelles Update: User kann neue Begriffe einfügen
- [ ] Automatisches Update: Optional auto-update von zentraler Quelle

### 7c-4 - Begriffs-Verwaltung
- [ ] Zentrale Liste der "dynamischen Begriffe" im Prompt
- [ ] Unternehmen: Hinzufügen/Entfernen von Firmennamen
- [ ] Technologien: Neue Technologien ergänzen
- [ ] Förderprogramme: Aktuelle Programme pflegen
- [ ] Politik: Aktuelle Ministerien/Strategien anpassen
- [ ] Diese Liste wird in den Prompt dynamisch eingefügt

### 7c-5 - Prompt-Testing
- [ ] Test-Modus: Prompt mit Beispiel-Artikel ausprobieren
- [ ] Vergleich: Alter Prompt vs. Neuer Prompt
- [ ] Batch-Test: Mehrere Artikel gleichzeitig testen
- [ ] Ergebnis-Vergleich: Unterschiede in Scores/Tags aufzeigen

### 7c-6 - Prompt-Import/Export
- [ ] Export als JSON/YAML
- [ ] Import von angepassten Prompts
- [ ] Backup-Funktion vor Änderungen
- [ ] Community-Sharing: Prompts teilen & importieren

## Datenmodell (Vorschlag)

### PromptVersion
```javascript
{
  id: string,
  name: string,              // "Klassifikations-Prompt"
  type: "classify" | "match" | "report" | "open-search",
  content: string,           // Der aktuelle Prompt-Text
  version: number,           // Inkrement bei jeder Änderung
  createdAt: string,
  updatedAt: string,
  updatedBy: "user" | "system" | "auto-update",
  changelog: string,         // Was wurde geändert?
  isActive: boolean
}
```

### DynamicTerms
```javascript
{
  category: "companies" | "technologies" | "funding" | "politics",
  terms: [
    { name: "INIT", addedAt: "2024-01-15", active: true },
    { name: "IVU", addedAt: "2024-01-15", active: true },
    { name: "Optibus", addedAt: "2024-01-15", active: false }  // Deaktiviert
  ]
}
```

## UI-Platzierung
- Settings → "KI & Prompts" Tab
- Hauptmenü: "Prompts verwalten" (für Admin-User)
- Artikel-Liste: Kontextmenü "Prompt testen"

## Nicht in dieser Phase
- Keine Prompt-Generierung durch KI (nur manuelle Bearbeitung)
- Keine A/B-Tests zwischen Prompt-Versionen
- Keine automatische Erkennung veralteter Begriffe (nur Zeitstempel)
