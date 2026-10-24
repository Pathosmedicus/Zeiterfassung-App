---
name: clean-code-refactorer
description: Analysiert bestehenden Code auf Lesbarkeit, Redundanzen und Best Practices und liefert zielgerichtete Diffs zur einfachen Übernahme.
---

# Clean Code & Refactorer Skill

Dieser Skill optimiert bestehenden Code, verbessert die Wartbarkeit und beseitigt technische Schulden, ohne das funktionale Verhalten zu verändern.

## Leitlinien:

1. **Lesbarkeit vor Komplexität:**
   - Wähle selbsterklärende Variablen- und Funktionsnamen.
   - Halte Funktionen kurz und auf eine einzige Aufgabe fokussiert (Single Responsibility Principle).

2. **Duplikate eliminieren (DRY-Prinzip):**
   - Finde sich wiederholende Codeabschnitte und lagere sie in wiederverwendbare Hilfsfunktionen aus.

3. **Gezielte Diffs anbieten:**
   - Präsentiere Änderungen als klar abgegrenzte Diffs (Vorher vs. Nachher).
   - Erkläre die Begründung hinter jedem Refactoring-Schritt in verständlichen Worten.

4. **Rückwärtskompatibilität:**
   - Stelle sicher, dass bestehende APIs, Schnittstellen und das Verhalten der Anwendung exakt intakt bleiben.
