---
name: unit-test-generator
description: Erkennt die geöffnete Datei und schreibt automatisch präzise Tests für Zielfunktionen oder Komponenten inkl. Randfällen und Mocks.
---

# Unit Test Generator Skill

Dieser Skill automatisiert das Erstellen verlässlicher und robuster Unit-Tests.

## Arbeitsablauf:

1. **Kontext erfassen:**
   - Analysiere die Datei, in der sich die zu testende Funktion/Komponente befindet.
   - Prüfe vorhandene Test-Frameworks im Projekt (z. B. Vitest, Jest, Pytest). Falls keines vorhanden ist, schlage das am besten passende vor.

2. **Test-Umfang definieren:**
   - **Happy Path:** Normale, erwartete Eingaben und deren Rückgabewerte.
   - **Edge Cases:** Leere Eingaben, `null`/`undefined`, Grenzwerte, ungültige Datentypen.
   - **Error Handling:** Prüfe, ob Fehler korrekt geworfen oder abgefangen werden.

3. **Mocks & Isolation:**
   - Isoliere externe Abhängigkeiten (z. B. Datenbankabfragen, Netzwerk-Calls) durch geeignete Mocks oder Stubs.

4. **Verifizierung:**
   - Erstelle die Testdatei (z. B. `*.test.js` oder `*.spec.ts`).
   - Führe die Tests im Terminal aus und stelle sicher, dass alle Tests grün (erfolgreich) durchlaufen.
