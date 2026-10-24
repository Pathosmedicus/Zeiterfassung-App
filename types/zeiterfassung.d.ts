/**
 * TypeScript Typdefinitionen für Zeiterfassung Radiologie
 * Generiert durch api-integrator Skill
 */

/** Ein einzelner Arbeitszeiteintrag */
export interface ArbeitszeitEintrag {
    /** ISO-Datumsformat: YYYY-MM-DD */
    datum: string;
    /** Format: HH:MM (z.B. "07:30") */
    kommen: string;
    /** Format: HH:MM (z.B. "16:00") */
    gehen: string;
    /** Pausendauer in Minuten */
    pauseMinuten: number;
    /** Berechnete Netto-Arbeitsstunden in Dezimal (z.B. 8.00) */
    nettoStunden: number;
}

/** Lohn- und Zuschlagskonfiguration */
export interface LohnConfig {
    /** Basisstundenlohn bis Juli 2026 in Euro */
    baseOld: number;
    /** Basisstundenlohn ab August 2026 in Euro */
    baseNew: number;
    /** Zuschlagssatz für Sonn- und Feiertage in Prozent (z.B. 27.21) */
    sunPercent: number;
    /** Zuschlagssatz für Samstage (13-21 Uhr) in Prozent (z.B. 3.73) */
    satPercent: number;
    /** Abzug für VBL in Prozent (z.B. 1.87) */
    vblPercent: number;
    /** Monatliche Minijob-Grenze in Euro (z.B. 603) */
    limit: number;
    /** Jährliche Minijob-Grenze in Euro (z.B. 7236) */
    annualLimit: number;
}

/** Ergebnis der monatlichen Gehaltsberechnung */
export interface MonthSalaryStats {
    /** Aktiver Basisstundenlohn für diesen Monat */
    activeBaseWage: number;
    /** Gesamte Arbeitsstunden im Monat */
    gesamtDezimal: number;
    /** Anzahl geleisteter Schichten */
    anzahlDienste: number;
    /** Stunden an Sonn- oder Feiertagen */
    sonntagStunden: number;
    /** Bonusrelevante Samstagsstunden (13-21 Uhr) */
    samstagBonusStunden: number;
    /** Basisvergütung in Euro */
    basisLohn: number;
    /** Zuschlag für Sonn-/Feiertage in Euro */
    sonntagLohn: number;
    /** Zuschlag für Samstage in Euro */
    samstagLohn: number;
    /** Bruttogehalt inklusive aller Zuschläge */
    gesamtGehalt: number;
    /** Abzug für Zusatzversorgung (VBL) */
    vblAbzug: number;
    /** Erwarteter Nettoauszahlungsbetrag */
    erwartetesNetto: number;
}

/** Struktur der Feiertags-API Antwort */
export interface FeiertagApiItem {
    datum: string;
    hinweis: string;
}

export type FeiertageApiResponse = Record<string, FeiertagApiItem>;

/** Benutzerprofil */
export interface BenutzerProfil {
    name: string;
    vorname: string;
    personalnummer: string;
}
