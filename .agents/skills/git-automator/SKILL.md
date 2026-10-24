---
name: git-automator
description: Liest Änderungen über die Versionskontrolle (Git) aus, analysiert den Diff und bereitet strukturierte, verständliche Commits nach Conventional Commits vor.
---

# Git Automator Skill

Dieser Skill wird verwendet, um Git-Änderungen im Projekt sauber, strukturiert und nachvollziehbar zu verwalten.

## Arbeitsablauf:

1. **Status prüfen:**
   - Führe `git status` aus, um geänderte, gelöschte oder neue Dateien zu identifizieren.
   - Falls kein Git-Repository initialisiert ist, biete an, `git init` auszuführen.

2. **Änderungen analysieren:**
   - Untersuche den Diff mit `git diff` bzw. `git diff --cached`.
   - Gruppiere thematisch zusammengehörige Änderungen.

3. **Strukturierte Commit-Nachricht vorschlagen:**
   - Nutze das *Conventional Commits*-Schema:
     - `feat:` für neue Features
     - `fix:` für Fehlerbehebungen
     - `docs:` für Dokumentationsänderungen
     - `style:` für Formatierung und Layout
     - `refactor:` für Code-Umbau ohne Verhaltensänderung
   - Formuliere die Beschreibung auf Deutsch oder Englisch (passend zum Projektstil), kurz und präzise.

4. **Sicherheit:**
   - Vor jedem Commit prüfen, ob sensible Daten (`.env`, Passwörter, Keys) versehentlich gestaged werden.
