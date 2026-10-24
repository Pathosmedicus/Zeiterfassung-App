---
name: secrets-guard
description: Prüft Dateien vor dem Speichern oder Committen auf versehentlich offengelegte Passwörter, API-Keys oder Tokens und sichert diese in .env-Dateien.
---

# Secrets Guard Skill

Dieser Skill schützt dein Projekt vor versehentlichem Veröffentlichen vertraulicher Zugangsdaten, API-Schlüsseln und Passwörtern.

## Schutz-Regeln:

1. **Typische Muster erkennen:**
   - OpenAI / Anthropic / Google API-Keys (`sk-...`, `AIza...`)
   - AWS Access & Secret Keys
   - Datenbank-Verbindungs-URLs mit Passwörtern (`postgres://user:pass@...`)
   - Private SSH-Keys und Zertifikate (`BEGIN PRIVATE KEY`)
   - Hardcodierte Passwörter in Konfigurationsdateien

2. **Gegenmaßnahmen ergreifen:**
   - **Nie im Quellcode belassen:** Ersetze hardcodierte Geheimnisse durch Umgebungsvariablen (z. B. `process.env.API_KEY`).
   - **.env-Datei verwenden:** Lege sensible Werte in eine lokale `.env`-Datei.
   - **.gitignore absichern:** Stelle sicher, dass `.env` ausnahmslos in der `.gitignore` eingetragen ist, damit sie niemals in Git gespeichert wird.
   - **.env.example bereitstellen:** Lege eine `.env.example` mit Platzhaltern (z. B. `API_KEY=dein_schluessel_hier`) an, damit andere Entwickler wissen, welche Variablen benötigt werden.
