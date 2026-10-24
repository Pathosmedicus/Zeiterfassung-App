---
name: sqlite-helper
description: Verbindet sich mit lokalen Datenbanken (z. B. SQLite), liest Schemata aus, hilft bei sicheren SQL-Abfragen und erstellt Migrationen.
---

# SQLite & Database Helper Skill

Dieser Skill vereinfacht die Arbeit mit lokalen Datenbankdateien und strukturierten Daten im Projekt.

## Arbeitsablauf:

1. **Datenbankdatei lokalisieren:**
   - Suche nach bestehenden Datenbankdateien (z. B. `*.db`, `*.sqlite`, `*.sqlite3`).
   - Falls noch keine Datenbank existiert, bereite die Initialisierung vor.

2. **Schema & Struktur inspizieren:**
   - Lies Tabellen und Spalten aus (z. B. via `PRAGMA table_info(table_name)` oder `.schema`).
   - Stelle die Struktur für den Nutzer übersichtlich als Tabelle dar.

3. **Sichere Abfragen erstellen:**
   - Verwende stets parametrisierte Abfragen (Prepared Statements), um SQL-Injections zu verhindern.
   - Schreibe lesbare `SELECT`-, `INSERT`-, `UPDATE`- oder `DELETE`-Operationen.

4. **Migrationen & Backups:**
   - Vor strukturellen Schema-Änderungen immer ein lokales Backup der Datenbankdatei anlegen oder empfehlen.
