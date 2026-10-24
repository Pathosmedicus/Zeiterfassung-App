-- Beispiel-Abfragen & Prepared Statements für Zeiterfassung
-- (sqlite-helper Skill)

-- 1. Monats-Summen und Statistik (Parameter: ?1 = Jahr-Monat wie '2026-05%')
SELECT 
    COUNT(*) AS anzahl_schichten,
    ROUND(SUM(netto_stunden), 2) AS gesamt_stunden,
    MIN(kommen) AS fruehester_dienst,
    MAX(gehen) AS spaetester_dienst
FROM schichten
WHERE datum LIKE ?1 AND netto_stunden > 0;

-- 2. Upsert einer Schicht (Einfügen oder Aktualisieren)
INSERT INTO schichten (benutzer_id, datum, kommen, gehen, pause_minuten, netto_stunden, aktualisiert_am)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, CURRENT_TIMESTAMP)
ON CONFLICT(benutzer_id, datum) DO UPDATE SET
    kommen = excluded.kommen,
    gehen = excluded.gehen,
    pause_minuten = excluded.pause_minuten,
    netto_stunden = excluded.netto_stunden,
    aktualisiert_am = CURRENT_TIMESTAMP;

-- 3. Jahresübersicht nach Monaten gruppiert
SELECT 
    substr(datum, 1, 7) AS monat,
    COUNT(*) AS schichten_count,
    ROUND(SUM(netto_stunden), 2) AS summe_stunden
FROM schichten
WHERE substr(datum, 1, 4) = ?1
GROUP BY substr(datum, 1, 7)
ORDER BY monat ASC;
