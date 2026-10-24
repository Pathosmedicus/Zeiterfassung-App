-- SQLite Schema für Zeiterfassung Radiologie
-- Erstellt durch sqlite-helper Skill

PRAGMA foreign_keys = ON;

-- 1. Benutzerprofil
CREATE TABLE IF NOT EXISTS benutzer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    vorname TEXT NOT NULL DEFAULT '',
    personalnummer TEXT NOT NULL DEFAULT '',
    erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
    aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Arbeitszeiteinträge / Schichten
CREATE TABLE IF NOT EXISTS schichten (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    benutzer_id INTEGER REFERENCES benutzer(id) ON DELETE CASCADE,
    datum TEXT NOT NULL,                -- Format: YYYY-MM-DD
    kommen TEXT NOT NULL,               -- Format: HH:MM
    gehen TEXT NOT NULL,                -- Format: HH:MM
    pause_minuten INTEGER NOT NULL DEFAULT 0 CHECK (pause_minuten >= 0),
    netto_stunden REAL NOT NULL CHECK (netto_stunden >= 0),
    erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
    aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(benutzer_id, datum)
);

-- Index für schnelle Monats- und Jahresabfragen
CREATE INDEX IF NOT EXISTS idx_schichten_datum ON schichten(datum);
CREATE INDEX IF NOT EXISTS idx_schichten_benutzer_datum ON schichten(benutzer_id, datum);

-- 3. Lohn- und Tarifeinstellungen
CREATE TABLE IF NOT EXISTS lohn_einstellungen (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Einzelsatz-Konfiguration
    base_old REAL NOT NULL DEFAULT 17.16,
    base_new REAL NOT NULL DEFAULT 18.90,
    sun_percent REAL NOT NULL DEFAULT 27.21,
    sat_percent REAL NOT NULL DEFAULT 3.73,
    vbl_percent REAL NOT NULL DEFAULT 1.87,
    minijob_limit INTEGER NOT NULL DEFAULT 603,
    annual_limit INTEGER NOT NULL DEFAULT 7236,
    aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Standard-Tarifwerte einfügen falls nicht vorhanden
INSERT OR IGNORE INTO lohn_einstellungen (id, base_old, base_new, sun_percent, sat_percent, vbl_percent, minijob_limit, annual_limit)
VALUES (1, 17.16, 18.90, 27.21, 3.73, 1.87, 603, 7236);

-- 4. E-Mail Versandhistorie
CREATE TABLE IF NOT EXISTS email_historie (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monat_jahr TEXT NOT NULL,           -- z.B. "2026-05"
    empfaenger TEXT NOT NULL,
    versand_datum DATETIME DEFAULT CURRENT_TIMESTAMP
);
