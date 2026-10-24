---
name: bug-hunter
description: Analysiert Terminal-Ausgaben, Logs und Stacktraces automatisch bei Fehlermeldungen, lokalisiert die fehlerhafte Codezeile und schlägt eine direkte Lösung vor.
---

# Bug Hunter & Debugger Skill

Dieser Skill dient der schnellen und zielgerichteten Lokalisierung und Behebung von Fehlern im Code oder Terminal.

## Arbeitsablauf:

1. **Fehler erfassen:**
   - Lies Fehlermeldungen, Stacktraces und Exit-Codes aus dem Terminal oder den Logs aus.
   - Identifiziere die genaue Datei, Zeilennummer und Art des Fehlers (z. B. SyntaxError, TypeError, UnhandledPromiseRejection).

2. **Ursachenanalyse in einfacher Sprache:**
   - Erkläre dem Nutzer in verständlichen Worten (ohne übermäßigen Jargon), warum der Fehler aufgetreten ist.

3. **Lösung vorbereiten:**
   - Öffne die betroffene Datei an der exakten Zeile.
   - Bereite eine minimale, saubere Korrektur vor, die das Problem löst, ohne bestehende Logik zu beschädigen.

4. **Validieren:**
   - Führe den fehlschlagenden Befehl oder Test nach der Korrektur erneut im Terminal aus, um zu beweisen, dass der Fehler behoben ist.