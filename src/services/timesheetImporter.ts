import * as XLSX from 'xlsx';
import type { ShiftEntry } from '../types';

function berechneNetto(kommen: string, gehen: string, pauseMinuten: number = 0): number {
  if (!kommen || !gehen) return 0;
  const [sH, sM] = kommen.split(':').map(Number);
  const [eH, eM] = gehen.split(':').map(Number);
  if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) return 0;
  const startMin = sH * 60 + sM;
  let endMin = eH * 60 + eM;
  if (endMin === startMin) return 0;
  if (endMin < startMin) endMin += 24 * 60;
  const pause = Math.max(0, parseInt(String(pauseMinuten), 10) || 0);
  const nettoMin = Math.max(0, endMin - startMin - pause);
  return Math.round((nettoMin / 60) * 100) / 100;
}

export interface ImportedShiftRow extends ShiftEntry {
  rowId: string;
  selected: boolean;
  sourceSheet: string;
  sourceFile: string;
}

export interface SheetImportSummary {
  sheetId: string;
  sheetName: string;
  fileName: string;
  shiftCount: number;
  detectedYear?: number;
  detectedMonth?: number;
}

export interface TimesheetParseResult {
  shifts: ImportedShiftRow[];
  sheets: SheetImportSummary[];
  monthsList: string[]; // Sorted YYYY-MM list
  monthsRangeLabel: string; // e.g. "Aug 2025 – Okt 2026"
  hasFallbackDateRows: boolean;
}

const DE_MONTH_SHORT = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'
];

const MONTH_NAME_MAP: Record<string, number> = {
  januar: 1, january: 1, jan: 1,
  februar: 2, february: 2, feb: 2,
  märz: 3, maerz: 3, mrz: 3, mär: 3, march: 3, mar: 3,
  april: 4, apr: 4,
  mai: 5, may: 5,
  juni: 6, june: 6, jun: 6,
  juli: 7, july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sept: 9, sep: 9,
  oktober: 10, october: 10, okt: 10, oct: 10,
  november: 11, nov: 11,
  dezember: 12, december: 12, dez: 12, dec: 12
};

const HEADER_KEYWORDS = {
  datum: ['datum', 'tag', 'date', 'arbeitstag', 'kalendertag', 'day', 'datum/tag', 'diensttag'],
  kommen: ['kommen', 'beginn', 'start', 'von', 'arbeitsbeginn', 'dienstbeginn', 'anfang', 'from', 'in', 'uhrzeit von', 'zeit von'],
  gehen: ['gehen', 'ende', 'bis', 'arbeitsende', 'dienstende', 'schluss', 'to', 'out', 'uhrzeit bis', 'zeit bis'],
  pause: ['pause', 'pause (min)', 'pause in min', 'pause in std', 'pause (std)', 'pausen', 'pausenzeit', 'break', 'abzug pause', 'pause min', 'pause std'],
  netto: ['stunden in zahl', 'geleistete stunden', 'nettostunden', 'netto-stunden', 'netto', 'stunden', 'arbeitszeit', 'gesamtstunden', 'dauer', 'std.', 'std', 'hours', 'ist-stunden', 'ist'],
  notiz: ['notiz', 'bemerkung', 'kommentar', 'schichttyp', 'dienst', 'art', 'tätigkeit', 'notes']
};

const IGNORE_ROW_KEYWORDS = [
  'gesamt',
  'summe',
  'total',
  'übertrag',
  'uebertrag',
  'unterschrift',
  'datum und ort',
  'stundenübersichtstabelle',
  'stundenuebersichtstabelle',
  'personalnummer',
  'abteilung:',
  'mindestlohn',
  'kontostand'
];

/**
 * Formatiert ein YYYY-MM als kurzes deutsches Label, z.B. "Aug 2025"
 */
export function formatYearMonthLabel(ym: string): string {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (month < 1 || month > 12) return ym;
  return `${DE_MONTH_SHORT[month - 1]} ${year}`;
}

/**
 * Baut eine Zusammenfassung der erkannten Monate (z.B. "Aug 2025 – Okt 2026")
 */
export function buildMonthsSummary(shifts: { datum: string; selected?: boolean }[]): {
  monthsList: string[];
  monthsRangeLabel: string;
} {
  const active = shifts.filter(s => s.selected !== false && /^\d{4}-\d{2}-\d{2}$/.test(s.datum));
  const monthsSet = new Set<string>();
  for (const s of active) {
    monthsSet.add(s.datum.substring(0, 7));
  }
  const monthsList = Array.from(monthsSet).sort();
  if (monthsList.length === 0) {
    return { monthsList: [], monthsRangeLabel: '' };
  }
  if (monthsList.length === 1) {
    return { monthsList, monthsRangeLabel: formatYearMonthLabel(monthsList[0]) };
  }
  const first = formatYearMonthLabel(monthsList[0]);
  const last = formatYearMonthLabel(monthsList[monthsList.length - 1]);
  return { monthsList, monthsRangeLabel: `${first} – ${last}` };
}

/**
 * Extrahiert Jahr (z.B. 2025, 2026) und Monat (1..12) aus einem Text
 * wie "Aug 25", "September 2025", "Okt 26", "Stundenuebersicht_2026_10.xlsx", "08/2025"
 */
export function extractYearMonthFromText(text: string): { year?: number; month?: number } {
  if (!text) return {};
  const clean = text.toLowerCase().replace(/[_.,()-]+/g, ' ').trim();

  let detectedYear: number | undefined;
  let detectedMonth: number | undefined;

  // 1. Suche nach Monatsnamen (Januar..Dezember, Jan..Dez)
  const tokens = clean.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i].replace(/[^a-zäöüß]/g, '');
    if (tok && MONTH_NAME_MAP[tok]) {
      detectedMonth = MONTH_NAME_MAP[tok];
      // Prüfe Nachbar-Tokens auf Jahreszahl (z.B. "Aug 25" oder "2025 Aug")
      for (const idx of [i + 1, i - 1]) {
        if (idx >= 0 && idx < tokens.length) {
          const numTok = tokens[idx].replace(/\D/g, '');
          if (/^20[2-3]\d$/.test(numTok)) {
            detectedYear = parseInt(numTok, 10);
            break;
          } else if (/^[2-3]\d$/.test(numTok)) {
            detectedYear = 2000 + parseInt(numTok, 10);
            break;
          }
        }
      }
      break;
    }
  }

  // Auch zusammengeschriebene Muster wie "Aug25", "Okt2026", "Sep25" prüfen
  if (!detectedMonth) {
    const combinedMatch = text
      .toLowerCase()
      .match(/(januar|februar|märz|maerz|mrz|april|mai|juni|juli|august|september|sept|oktober|november|dezember|jan|feb|mär|mar|apr|may|jun|jul|aug|sep|okt|oct|nov|dez|dec)[_.\-\s/']*(\d{2,4})/i);
    if (combinedMatch) {
      const mKey = combinedMatch[1].toLowerCase();
      if (MONTH_NAME_MAP[mKey]) {
        detectedMonth = MONTH_NAME_MAP[mKey];
        const yRaw = parseInt(combinedMatch[2], 10);
        if (yRaw >= 2020 && yRaw <= 2035) detectedYear = yRaw;
        else if (yRaw >= 20 && yRaw <= 35) detectedYear = 2000 + yRaw;
      }
    }
  }

  // 2. Numerische Muster: YYYY-MM, YYYY_MM, MM-YYYY, MM.YYYY, MM/YY
  if (!detectedYear || !detectedMonth) {
    const isoMatch = text.match(/(?:^|\D)(20[2-3]\d)[_.\-\s/](0?[1-9]|1[0-2])(?:\D|$)/);
    if (isoMatch) {
      detectedYear = detectedYear || parseInt(isoMatch[1], 10);
      detectedMonth = detectedMonth || parseInt(isoMatch[2], 10);
    }
  }

  if (!detectedYear || !detectedMonth) {
    const deMatch = text.match(/(?:^|\D)(0?[1-9]|1[0-2])[_.\-/](20[2-3]\d|[2-3]\d)(?:\D|$)/);
    if (deMatch) {
      const m = parseInt(deMatch[1], 10);
      const yRaw = parseInt(deMatch[2], 10);
      const y = yRaw < 100 ? 2000 + yRaw : yRaw;
      if (m >= 1 && m <= 12 && y >= 2020 && y <= 2035) {
        detectedMonth = detectedMonth || m;
        detectedYear = detectedYear || y;
      }
    }
  }

  // 3. Alleinstehendes 4-stelliges Jahr (z.B. Tabellenblatt "2025" oder "2026")
  if (!detectedYear) {
    const yearOnly = text.match(/(?:^|\D)(20[2-3]\d)(?:\D|$)/);
    if (yearOnly) {
      detectedYear = parseInt(yearOnly[1], 10);
    }
  }

  return { year: detectedYear, month: detectedMonth };
}

/**
 * Konvertiert ein Excel-Seriendatum (z.B. 45956 -> 2025-10-26) in YYYY-MM-DD
 */
export function excelSerialToIsoDate(serial: number): string | null {
  const days = Math.floor(serial);
  // Gültigkeitsbereich: ca. 2018 (43101) bis 2035 (49674)
  if (!Number.isFinite(days) || days < 43100 || days > 49700) return null;
  const utcMs = Math.round((days - 25569) * 86400 * 1000);
  const d = new Date(utcMs);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  if (year < 2018 || year > 2035) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Validiert ein Datum und gibt YYYY-MM-DD zurück
 */
function buildValidIsoDate(year: number, month: number, day: number): string | null {
  if (year < 2018 || year > 2035 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const maxDay = new Date(year, month, 0).getDate();
  if (day > maxDay) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Parst einen Datumswert (String, Zahl, Date) tolerant in YYYY-MM-DD.
 * Unterstützt:
 * - "26.10.2026", "26.10.25", "1.8.25"
 * - "2026-10-26", "2026/10/26"
 * - "26.10." (mit Jahr aus Kontext)
 * - Excel-Seriendatum (z.B. 45956)
 * - Reine Tageszahl 1..31 oder "01.", "Mo 01." (wenn Monat & Jahr aus Blatt/Datei bekannt sind)
 */
export function parseFlexibleDate(
  rawCell: any,
  formattedCell: string,
  contextYear?: number,
  contextMonth?: number,
  allowDayOnly: boolean = false
): { isoDate: string | null; usedFallbackContext: boolean } {
  // 1. Date-Objekt
  if (rawCell instanceof Date && !isNaN(rawCell.getTime())) {
    const y = rawCell.getFullYear();
    const m = rawCell.getMonth() + 1;
    const d = rawCell.getDate();
    if (y >= 2018 && y <= 2035) {
      return { isoDate: buildValidIsoDate(y, m, d), usedFallbackContext: false };
    }
  }

  // 2. Numerisches Excel-Seriendatum (z.B. 45956)
  if (typeof rawCell === 'number' && rawCell >= 43100 && rawCell <= 49700) {
    const iso = excelSerialToIsoDate(rawCell);
    if (iso) return { isoDate: iso, usedFallbackContext: false };
  }

  const candidates = [formattedCell, rawCell != null ? String(rawCell) : '']
    .map(s => String(s || '').trim())
    .filter(Boolean);

  for (const str of candidates) {
    // Wochentags-Präfixe wie "Mo, 26.10.2025" oder "So. 01.08.25" bereinigen
    const cleaned = str.replace(/^(mo|di|mi|do|fr|sa|so|mon|tue|wed|thu|fri|sat|sun)[a-zäöü]*[.,\s]+/i, '').trim();

    // A) Deutsches Format: DD.MM.YYYY oder DD.MM.YY (auch mit / oder -)
    const deFull = cleaned.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (deFull) {
      const day = parseInt(deFull[1], 10);
      const month = parseInt(deFull[2], 10);
      let year = parseInt(deFull[3], 10);
      if (year < 100) year += 2000;
      const iso = buildValidIsoDate(year, month, day);
      if (iso) return { isoDate: iso, usedFallbackContext: false };
    }

    // B) ISO-Format: YYYY-MM-DD oder YYYY/MM/DD
    const isoMatch = cleaned.match(/^(20[1-3]\d)[./-](\d{1,2})[./-](\d{1,2})(?:T.*)?$/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10);
      const day = parseInt(isoMatch[3], 10);
      const iso = buildValidIsoDate(year, month, day);
      if (iso) return { isoDate: iso, usedFallbackContext: false };
    }

    // C) Amerikanisches Format aus SheetJS raw: false (M/D/YY oder M/D/YYYY) falls Monat <= 12 und Tag > 12
    const usMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (usMatch) {
      const first = parseInt(usMatch[1], 10);
      const second = parseInt(usMatch[2], 10);
      let year = parseInt(usMatch[3], 10);
      if (year < 100) year += 2000;
      if (first <= 12 && second > 12) {
        const iso = buildValidIsoDate(year, first, second);
        if (iso) return { isoDate: iso, usedFallbackContext: false };
      }
    }

    // D) Excel-Seriendatum als String (z.B. "45956")
    if (/^\d{5}(?:[.,]\d+)?$/.test(cleaned)) {
      const serial = parseFloat(cleaned.replace(',', '.'));
      const iso = excelSerialToIsoDate(serial);
      if (iso) return { isoDate: iso, usedFallbackContext: false };
    }

    // E) Kurzdatum ohne Jahr: "26.10." oder "26.10" (wenn Jahr aus Blatt/Datei bekannt)
    if (contextYear) {
      const deShort = cleaned.match(/^(\d{1,2})\.(\d{1,2})\.?$/);
      if (deShort) {
        const day = parseInt(deShort[1], 10);
        const month = parseInt(deShort[2], 10);
        const iso = buildValidIsoDate(contextYear, month, day);
        if (iso) return { isoDate: iso, usedFallbackContext: true };
      }
    }

    // F) Nur Tag 1..31 (z.B. "1", "01.", "15", "15. Mo") in Datum/Tag-Spalte
    if (allowDayOnly && contextYear && contextMonth) {
      const dayMatch = cleaned.match(/^(\d{1,2})\.?(?:\s*(?:mo|di|mi|do|fr|sa|so)[a-z]*)?$/i);
      if (dayMatch) {
        const day = parseInt(dayMatch[1], 10);
        const iso = buildValidIsoDate(contextYear, contextMonth, day);
        if (iso) return { isoDate: iso, usedFallbackContext: true };
      }
    }
  }

  return { isoDate: null, usedFallbackContext: false };
}

/**
 * Konvertiert Uhrzeiten aus Excel / CSV / Text in das Format "HH:MM".
 * Unterstützt:
 * - "07:30", "7:30", "12:00:00" -> "07:30", "12:00"
 * - "24:00", "24:00:00", "00:00" -> "00:00"
 * - "12.00", "07.30" -> "12:00", "07:30"
 * - Excel-Dezimalzeiten: 0.5 -> "12:00", 0.3125 -> "07:30"
 * - Kompakte Ziffern in Zeitspalten: "0730", "730", "8" -> "07:30", "08:00"
 */
export function parseFlexibleTime(
  rawCell: any,
  formattedCell: string,
  isDedicatedTimeCol: boolean = false
): string | null {
  if (rawCell === null || rawCell === undefined || rawCell === '') {
    if (!formattedCell) return null;
  }

  // 1. Date-Objekt (z.B. Excel-Zeitwert)
  if (rawCell instanceof Date && !isNaN(rawCell.getTime())) {
    const h = rawCell.getHours();
    const m = rawCell.getMinutes();
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // 2. Prüfe zuerst den formatierten String auf HH:MM(:SS)
  const strCandidates = [formattedCell, rawCell != null ? String(rawCell) : '']
    .map(s => String(s || '').trim())
    .filter(Boolean);

  for (const rawStr of strCandidates) {
    const s = rawStr.replace(/\s*uhr$/i, '').trim();
    if (!s || s === '-' || s === '--:--' || s === '0:00') {
      // WICHTIG: In "Geleistete Stunden" steht oft "0:00" für freie Tage;
      // in einer echten Kommen/Gehen-Spalte ist "00:00" jedoch Mitternacht!
      if (s === '00:00' || (s === '0:00' && isDedicatedTimeCol)) {
        return '00:00';
      }
      continue;
    }

    // HH:MM oder HH:MM:SS (inkl. AM/PM falls Excel englisch formatiert)
    const colonMatch = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i);
    if (colonMatch) {
      let h = parseInt(colonMatch[1], 10);
      const m = parseInt(colonMatch[2], 10);
      const ampm = colonMatch[4]?.toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      if (h === 24 && m === 0) return '00:00';
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
  }

  // 3. Numerischer Excel-Dezimalwert (z.B. 0.5 -> 12:00, 0.3125 -> 07:30, 1.0 -> 00:00)
  if (typeof rawCell === 'number' && Number.isFinite(rawCell)) {
    if (rawCell > 0 && rawCell <= 1) {
      const totalMinutes = Math.round(rawCell * 24 * 60) % (24 * 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    if (rawCell === 0 && isDedicatedTimeCol && formattedCell && formattedCell.includes('00:00')) {
      return '00:00';
    }
  }

  // 4. Weitere String-Varianten in Zeitspalten: "0.5", "12.00", "07.30", "0730"
  for (const rawStr of strCandidates) {
    const s = rawStr.replace(/\s*uhr$/i, '').trim();

    // Excel-Dezimalzeit als String: "0.5", "0,5", "0.3125", "0.75"
    if (/^0[.,]\d+$/.test(s)) {
      const dec = parseFloat(s.replace(',', '.'));
      if (dec > 0 && dec < 1) {
        const totalMinutes = Math.round(dec * 24 * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }

    // Punkt-Notation: "12.00", "7.30", "16.00", "24.00"
    const dotMatch = s.match(/^(\d{1,2})\.(\d{2})$/);
    if (dotMatch) {
      const h = parseInt(dotMatch[1], 10);
      const m = parseInt(dotMatch[2], 10);
      if (h === 24 && m === 0) return '00:00';
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }

    // Kompakte Ziffern in expliziter Kommen/Gehen-Spalte: "0730", "1600", "8"
    if (isDedicatedTimeCol && /^\d{1,4}$/.test(s)) {
      let h = -1;
      let m = 0;
      if (s.length <= 2) {
        h = parseInt(s, 10);
      } else if (s.length === 3) {
        h = parseInt(s.slice(0, 1), 10);
        m = parseInt(s.slice(1), 10);
      } else if (s.length === 4) {
        h = parseInt(s.slice(0, 2), 10);
        m = parseInt(s.slice(2), 10);
      }
      if (h === 24 && m === 0) return '00:00';
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
  }

  return null;
}

/**
 * Parst eine Zeitspanne in einer einzigen Zelle, z.B. "07:30 - 16:00" oder "07:30–16:00"
 */
function parseTimeRangeCell(text: string): { kommen: string; gehen: string } | null {
  if (!text) return null;
  const m = text
    .trim()
    .match(/^(\d{1,2}[:.]\d{2})\s*(?:[-–—]|bis|to)\s*(\d{1,2}[:.]\d{2})(?:\s*uhr)?$/i);
  if (!m) return null;
  const k = parseFlexibleTime(m[1], m[1], true);
  const g = parseFlexibleTime(m[2], m[2], true);
  if (k && g) return { kommen: k, gehen: g };
  return null;
}

/**
 * Parst die Pause intelligent und gibt immer Minuten (z.B. 15, 30, 45, 60) zurück:
 * - "0:30", "00:30", "00:45", "1:00" -> 30, 45, 60 Min
 * - "15", "30", "45", "60", "30 Min" -> 15, 30, 45, 60 Min
 * - "0,25", "0.25", "0,5", "0.5", "0,75", "1,0" (Stunden) -> 15, 30, 45, 60 Min
 * - Excel-Zeitbruchzahl (z.B. 0.02083333 für 00:30) -> 30 Min
 */
export function parseFlexiblePause(
  rawCell: any,
  formattedCell: string,
  headerHint: string = ''
): number {
  const isHoursHeader = /std|stunde|hour|\bh\b/i.test(headerHint);

  const strCandidates = [formattedCell, rawCell != null ? String(rawCell) : '']
    .map(s => String(s || '').trim())
    .filter(Boolean);

  for (const str of strCandidates) {
    if (!str || str === '-' || str === '0' || str === '0:00' || str === '00:00' || str === '0,00' || str === '0.00') {
      return 0;
    }

    // 1. HH:MM(:SS) Format wie "0:30", "00:30", "01:00", "0:45:00"
    const colonMatch = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (colonMatch) {
      const h = parseInt(colonMatch[1], 10);
      const m = parseInt(colonMatch[2], 10);
      return h * 60 + m;
    }

    // 2. Explizite Einheit im Zelltext: "30 min", "0,5 std", "0.5 h"
    const minUnit = str.match(/^(\d+(?:[.,]\d+)?)\s*(?:min|m\b)/i);
    if (minUnit) {
      return Math.round(parseFloat(minUnit[1].replace(',', '.')));
    }
    const stdUnit = str.match(/^(\d+(?:[.,]\d+)?)\s*(?:std|stunde|h\b)/i);
    if (stdUnit) {
      return Math.round(parseFloat(stdUnit[1].replace(',', '.')) * 60);
    }
  }

  // 3. Numerische Auswertung
  let numVal: number | null = null;
  if (typeof rawCell === 'number' && Number.isFinite(rawCell)) {
    numVal = rawCell;
  } else if (strCandidates.length > 0) {
    const cleanedNum = strCandidates[0].replace(',', '.').replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleanedNum);
    if (Number.isFinite(parsed)) numVal = parsed;
  }

  if (numVal === null || numVal <= 0) return 0;

  // Excel-Zeitwert als Bruchteil von 24h (z.B. 00:15 = 0.0104167, 00:30 = 0.0208333, 00:45 = 0.03125, 01:00 = 0.0416667)
  if (numVal > 0 && numVal < 0.12) {
    const asExcelMins = numVal * 1440;
    if (Math.abs(Math.round(asExcelMins) - asExcelMins) < 0.05 && Math.round(asExcelMins) % 5 === 0) {
      return Math.round(asExcelMins);
    }
  }

  // Dezimalstunden (z.B. 0.25 -> 15, 0.5 -> 30, 0.75 -> 45, 1.0 -> 60, 1.5 -> 90)
  if (isHoursHeader || (numVal > 0 && numVal <= 4)) {
    return Math.round(numVal * 60);
  }

  // Minuten (z.B. 15, 20, 30, 45, 60, 90)
  return Math.round(numVal);
}

/**
 * Parst Netto-Stunden aus einer Zelle (Dezimalzahl wie 8.00 / "8,00" oder HH:MM wie "8:00")
 */
export function parseFlexibleHours(rawCell: any, formattedCell: string): number {
  const strCandidates = [formattedCell, rawCell != null ? String(rawCell) : '']
    .map(s => String(s || '').trim())
    .filter(Boolean);

  for (const str of strCandidates) {
    const colonMatch = str.match(/^(\d{1,2}):(\d{2})$/);
    if (colonMatch) {
      const h = parseInt(colonMatch[1], 10);
      const m = parseInt(colonMatch[2], 10);
      return Math.round(((h * 60 + m) / 60) * 100) / 100;
    }
  }

  if (typeof rawCell === 'number' && Number.isFinite(rawCell)) {
    if (rawCell > 0 && rawCell < 1) {
      // Falls als Excel-Zeit (z.B. 8:00 -> 0.33333) gespeichert
      const hasColonFormat = strCandidates.some(s => s.includes(':'));
      if (hasColonFormat) {
        return Math.round(rawCell * 24 * 100) / 100;
      }
    }
    if (rawCell >= 0 && rawCell <= 24) {
      return Math.round(rawCell * 100) / 100;
    }
  }

  for (const str of strCandidates) {
    const cleaned = str.replace(/\s*(?:std\.?|h)\s*$/i, '').replace(',', '.').trim();
    const val = parseFloat(cleaned);
    if (Number.isFinite(val) && val >= 0 && val <= 24) {
      return Math.round(val * 100) / 100;
    }
  }

  return 0;
}

interface ColumnMapping {
  headerRowIndex: number;
  datumCol: number;
  kommenCol: number;
  gehenCol: number;
  pauseCol: number;
  pauseHeaderHint: string;
  nettoCol: number;
  notizCol: number;
}

function normalizeHeaderCell(val: any): string {
  return String(val ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesHeaderKeyword(cellText: string, keywords: string[]): boolean {
  if (!cellText) return false;
  for (const kw of keywords) {
    if (cellText === kw || cellText.startsWith(kw + ' ') || cellText.includes(kw)) {
      return true;
    }
  }
  return false;
}

/**
 * Erkennt die Spaltenzuordnung (Smart Column Mapping) in einer Tabelle
 */
function detectColumnMapping(rawRows: any[][], fmtRows: string[][]): ColumnMapping {
  const mapping: ColumnMapping = {
    headerRowIndex: -1,
    datumCol: -1,
    kommenCol: -1,
    gehenCol: -1,
    pauseCol: -1,
    pauseHeaderHint: '',
    nettoCol: -1,
    notizCol: -1
  };

  const scanLimit = Math.min(rawRows.length, 20);

  // 1. Prüfe auf das offizielle 8-Spalten Klinikformat ("Stundenübersichtstabelle")
  // Spalten: [0: Datum, 1: "Von", 2: Kommen, 3: "Bis", 4: Gehen, 5: "Pause", 6: "Geleistete Stunden", 7: "Stunden in Zahl"]
  for (let r = 0; r < scanLimit; r++) {
    const row = fmtRows[r] || rawRows[r] || [];
    const normalized = row.map(normalizeHeaderCell);
    const pauseIdx = normalized.findIndex(c => c === 'pause');
    const geleisteteIdx = normalized.findIndex(c => c.includes('geleistete stunden'));
    if (pauseIdx >= 4 && geleisteteIdx > pauseIdx) {
      return {
        headerRowIndex: r,
        datumCol: 0,
        kommenCol: 2,
        gehenCol: 4,
        pauseCol: pauseIdx,
        pauseHeaderHint: String(row[pauseIdx] || ''),
        nettoCol: geleisteteIdx + 1 < row.length ? geleisteteIdx + 1 : geleisteteIdx,
        notizCol: -1
      };
    }
  }

  // 2. Allgemeine Header-Suche nach deutschen & englischen Spaltennamen
  let bestScore = 0;
  for (let r = 0; r < scanLimit; r++) {
    const row = fmtRows[r] || rawRows[r] || [];
    const normalized = row.map(normalizeHeaderCell);

    let dCol = -1;
    let kCol = -1;
    let gCol = -1;
    let pCol = -1;
    let pHint = '';
    let nCol = -1;
    let noteCol = -1;

    for (let c = 0; c < normalized.length; c++) {
      const cell = normalized[c];
      if (!cell) continue;

      if (dCol === -1 && matchesHeaderKeyword(cell, HEADER_KEYWORDS.datum)) {
        dCol = c;
      } else if (pCol === -1 && matchesHeaderKeyword(cell, HEADER_KEYWORDS.pause)) {
        pCol = c;
        pHint = String(row[c] || '');
      } else if (kCol === -1 && matchesHeaderKeyword(cell, HEADER_KEYWORDS.kommen)) {
        kCol = c;
      } else if (gCol === -1 && matchesHeaderKeyword(cell, HEADER_KEYWORDS.gehen)) {
        gCol = c;
      } else if (nCol === -1 && matchesHeaderKeyword(cell, HEADER_KEYWORDS.netto)) {
        nCol = c;
      } else if (noteCol === -1 && matchesHeaderKeyword(cell, HEADER_KEYWORDS.notiz)) {
        noteCol = c;
      }
    }

    const score =
      (dCol !== -1 ? 2 : 0) +
      (kCol !== -1 ? 2 : 0) +
      (gCol !== -1 ? 2 : 0) +
      (pCol !== -1 ? 1 : 0) +
      (nCol !== -1 ? 1 : 0);

    if (score > bestScore && score >= 3) {
      bestScore = score;
      mapping.headerRowIndex = r;
      mapping.datumCol = dCol;
      mapping.kommenCol = kCol;
      mapping.gehenCol = gCol;
      mapping.pauseCol = pCol;
      mapping.pauseHeaderHint = pHint;
      mapping.nettoCol = nCol;
      mapping.notizCol = noteCol;
    }
  }

  // Spezialfall: Falls in der Klinik-Vorlage "Von" in Spalte 1 und die Uhrzeit in Spalte 2 steht
  if (mapping.kommenCol !== -1 && mapping.headerRowIndex >= 0) {
    const sampleRow = fmtRows[mapping.headerRowIndex + 1] || [];
    if (normalizeHeaderCell(sampleRow[mapping.kommenCol]) === 'von' && mapping.kommenCol + 1 < sampleRow.length) {
      mapping.kommenCol += 1;
    }
    if (mapping.gehenCol !== -1 && normalizeHeaderCell(sampleRow[mapping.gehenCol]) === 'bis' && mapping.gehenCol + 1 < sampleRow.length) {
      mapping.gehenCol += 1;
    }
  }

  return mapping;
}

/**
 * Parst ein einzelnes Tabellenblatt (2D-Array aus Rohwerten und formatierten Texten)
 */
export function parseSheetRows(
  rawRows: any[][],
  fmtRows: string[][],
  sheetName: string,
  fileName: string,
  fallbackYearMonth: string
): {
  shifts: ImportedShiftRow[];
  detectedYear?: number;
  detectedMonth?: number;
  usedFallbackContext: boolean;
} {
  // 1. Jahr & Monat aus Sheet-Name, Dateiname und den ersten Zeilen ermitteln
  const fromSheet = extractYearMonthFromText(sheetName);
  const fromFile = extractYearMonthFromText(fileName);

  let headerTextContext: { year?: number; month?: number } = {};
  for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
    const rowStr = (fmtRows[r] || rawRows[r] || []).join(' ');
    const extracted = extractYearMonthFromText(rowStr);
    if (extracted.year || extracted.month) {
      headerTextContext = {
        year: headerTextContext.year || extracted.year,
        month: headerTextContext.month || extracted.month
      };
    }
  }

  // Zusätzlich: Prüfe, ob in den Zeilen bereits vollständige Daten (z.B. 01.08.25) stehen,
  // um für eventuelle Nur-Tag-Zeilen im selben Blatt das korrekte Jahr/Monat zu kennen
  let dominantYear: number | undefined;
  let dominantMonth: number | undefined;
  for (let r = 0; r < rawRows.length; r++) {
    const rRaw = rawRows[r] || [];
    const rFmt = fmtRows[r] || [];
    for (let c = 0; c < Math.min(rRaw.length, 4); c++) {
      const fullCheck = parseFlexibleDate(rRaw[c], rFmt[c] || '', undefined, undefined, false);
      if (fullCheck.isoDate) {
        dominantYear = parseInt(fullCheck.isoDate.substring(0, 4), 10);
        dominantMonth = parseInt(fullCheck.isoDate.substring(5, 7), 10);
        break;
      }
    }
    if (dominantYear && dominantMonth) break;
  }

  const [fbYStr, fbMStr] = (fallbackYearMonth || '').split('-');
  const fallbackYear = parseInt(fbYStr, 10) || new Date().getFullYear();
  const fallbackMonth = parseInt(fbMStr, 10) || new Date().getMonth() + 1;

  const explicitYear = fromSheet.year || dominantYear || headerTextContext.year || fromFile.year;
  const explicitMonth = fromSheet.month || dominantMonth || headerTextContext.month || fromFile.month;

  const contextYear = explicitYear || fallbackYear;
  const contextMonth = explicitMonth || fallbackMonth;
  const isFallbackMonthUsed = !explicitYear || !explicitMonth;

  const mapping = detectColumnMapping(rawRows, fmtRows);
  const startRow = mapping.headerRowIndex >= 0 ? mapping.headerRowIndex + 1 : 0;

  const parsedShifts: ImportedShiftRow[] = [];
  let anyRowUsedFallback = false;

  for (let r = startRow; r < rawRows.length; r++) {
    const rRaw = rawRows[r] || [];
    const rFmt = (fmtRows[r] || []).map(v => String(v ?? '').trim());

    if (rRaw.length === 0 && rFmt.length === 0) continue;

    // Summen- und Fußzeilen überspringen ("Gesamt", "Summe", "Unterschrift", etc.)
    const joinedLower = rFmt.join(' ').toLowerCase();
    if (!joinedLower.trim()) continue;
    if (IGNORE_ROW_KEYWORDS.some(kw => joinedLower.includes(kw))) continue;

    // 1. Datum ermitteln
    let isoDate: string | null = null;
    let dateColUsed = -1;
    let usedFallback = false;

    if (mapping.datumCol >= 0 && mapping.datumCol < Math.max(rRaw.length, rFmt.length)) {
      const res = parseFlexibleDate(
        rRaw[mapping.datumCol],
        rFmt[mapping.datumCol] || '',
        contextYear,
        contextMonth,
        true
      );
      if (res.isoDate) {
        isoDate = res.isoDate;
        dateColUsed = mapping.datumCol;
        usedFallback = res.usedFallbackContext && isFallbackMonthUsed;
      }
    }

    // Fallback: Suche Datum in den ersten 3 Spalten
    if (!isoDate) {
      for (let c = 0; c < Math.min(Math.max(rRaw.length, rFmt.length), 3); c++) {
        const res = parseFlexibleDate(
          rRaw[c],
          rFmt[c] || '',
          contextYear,
          contextMonth,
          c === 0 && mapping.headerRowIndex >= 0
        );
        if (res.isoDate) {
          isoDate = res.isoDate;
          dateColUsed = c;
          usedFallback = res.usedFallbackContext && isFallbackMonthUsed;
          break;
        }
      }
    }

    if (!isoDate) continue;

    // 2. Kommen & Gehen ermitteln
    let kommen: string | null = null;
    let gehen: string | null = null;
    let pauseMinuten = 0;
    let pauseFound = false;
    let explicitNetto = 0;

    if (mapping.kommenCol >= 0 && mapping.gehenCol >= 0) {
      // Prüfe auch auf Zeitspanne in einer Zelle ("07:30 - 16:00")
      const rangeInKommen = parseTimeRangeCell(rFmt[mapping.kommenCol] || String(rRaw[mapping.kommenCol] ?? ''));
      if (rangeInKommen) {
        kommen = rangeInKommen.kommen;
        gehen = rangeInKommen.gehen;
      } else {
        kommen = parseFlexibleTime(rRaw[mapping.kommenCol], rFmt[mapping.kommenCol] || '', true);
        gehen = parseFlexibleTime(rRaw[mapping.gehenCol], rFmt[mapping.gehenCol] || '', true);
      }
    }

    // Pause aus gemappter Spalte
    if (mapping.pauseCol >= 0) {
      const pRaw = rRaw[mapping.pauseCol];
      const pFmt = rFmt[mapping.pauseCol] || '';
      if (pRaw !== '' && pRaw != null || pFmt !== '') {
        pauseMinuten = parseFlexiblePause(pRaw, pFmt, mapping.pauseHeaderHint);
        pauseFound = true;
      }
    }

    // Netto-Stunden aus gemappter Spalte
    if (mapping.nettoCol >= 0) {
      explicitNetto = parseFlexibleHours(rRaw[mapping.nettoCol], rFmt[mapping.nettoCol] || '');
    }

    // Falls keine Header-Spalten für Kommen/Gehen erkannt wurden (oder leer):
    // Intelligenter Zeilen-Scan über die restlichen Zellen
    if (!kommen || !gehen) {
      const timeTokens: { col: number; time: string }[] = [];
      const maxCols = Math.max(rRaw.length, rFmt.length);

      for (let c = 0; c < maxCols; c++) {
        if (c === dateColUsed || c === mapping.pauseCol || c === mapping.nettoCol) continue;
        const cellRaw = rRaw[c];
        const cellFmt = rFmt[c] || '';
        const lower = cellFmt.toLowerCase();
        if (lower === 'von' || lower === 'bis' || !cellFmt && (cellRaw === '' || cellRaw == null)) continue;

        // Zeitspanne "07:30 - 16:00" in einer Zelle?
        const range = parseTimeRangeCell(cellFmt || String(cellRaw ?? ''));
        if (range) {
          kommen = range.kommen;
          gehen = range.gehen;
          break;
        }

        const t = parseFlexibleTime(cellRaw, cellFmt, false);
        if (t) {
          timeTokens.push({ col: c, time: t });
        }
      }

      if ((!kommen || !gehen) && timeTokens.length >= 2) {
        kommen = timeTokens[0].time;
        gehen = timeTokens[1].time;

        // Falls in derselben Zeile eine 3. Zeit wie "00:30" (Pause) folgt und noch keine Pause erkannt wurde
        if (!pauseFound && timeTokens.length >= 3) {
          const thirdCol = timeTokens[2].col;
          const thirdPause = parseFlexiblePause(rRaw[thirdCol], rFmt[thirdCol] || '');
          // Typische Pause <= 120 Min
          if (thirdPause > 0 && thirdPause <= 120) {
            pauseMinuten = thirdPause;
            pauseFound = true;
          }
        }
      }
    }

    // Falls weder Kommen noch Gehen vorhanden ist, prüfe ob es eine reine Stunden-Zeile ist oder ein leerer Tag
    if (!kommen || !gehen) {
      if (explicitNetto > 0) {
        // Synthetisiere Start- und Endzeit ab 08:00 für reine Netto-Stunden-Tabellen
        kommen = '08:00';
        const endMinutes = 8 * 60 + Math.round(explicitNetto * 60) + pauseMinuten;
        const eH = Math.floor(endMinutes / 60) % 24;
        const eM = endMinutes % 60;
        gehen = `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`;
      } else {
        // Leerer Tag ohne Dienst -> ignorieren
        continue;
      }
    }

    // Netto-Stunden berechnen aus kommen, gehen und pauseMinuten
    let nettoStunden = berechneNetto(kommen, gehen, pauseMinuten);

    // Falls keine Pausen-Spalte vorhanden war, aber eine Netto-Stunden-Spalte existiert,
    // die kleiner als Brutto ist (z.B. Brutto 8.5h, Netto-Spalte 8.0h -> 30 Min Pause),
    // erkennen wir die Pause automatisch!
    if (!pauseFound && explicitNetto > 0 && nettoStunden > explicitNetto) {
      const diffMinutes = Math.round((nettoStunden - explicitNetto) * 60);
      if (diffMinutes > 0 && diffMinutes <= 120 && diffMinutes % 5 === 0) {
        pauseMinuten = diffMinutes;
        nettoStunden = berechneNetto(kommen, gehen, pauseMinuten);
      }
    }

    // Falls berechnetes Netto 0 ist, aber eine explizite Netto-Spalte > 0 existiert
    if (nettoStunden <= 0 && explicitNetto > 0) {
      nettoStunden = explicitNetto;
    }

    // Tage mit 0,00 Stunden ignorieren
    if (nettoStunden <= 0) continue;

    if (usedFallback) {
      anyRowUsedFallback = true;
    }

    const notiz =
      mapping.notizCol >= 0 && rFmt[mapping.notizCol]
        ? rFmt[mapping.notizCol]
        : undefined;

    parsedShifts.push({
      rowId: `${fileName}_${sheetName}_${isoDate}_${r}`,
      selected: true,
      sourceSheet: sheetName,
      sourceFile: fileName,
      datum: isoDate,
      kommen,
      gehen,
      pauseMinuten,
      nettoStunden,
      schichtTyp: 'Importiert',
      notiz
    });
  }

  // Dedupliziere innerhalb desselben Tabellenblatts pro Kalendertag (letzter gültiger Eintrag gewinnt)
  const byDate = new Map<string, ImportedShiftRow>();
  for (const s of parsedShifts) {
    byDate.set(s.datum, s);
  }
  const uniqueShifts = Array.from(byDate.values()).sort((a, b) => a.datum.localeCompare(b.datum));

  return {
    shifts: uniqueShifts,
    detectedYear: explicitYear,
    detectedMonth: explicitMonth,
    usedFallbackContext: anyRowUsedFallback
  };
}

/**
 * Parst CSV- oder Copy-Paste-Text in ein 2D-Array von Zellen
 */
export function parseTextToGrid(text: string): string[][] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  // Trennzeichen erkennen: Tab (\t) aus Excel Copy-Paste, Semikolon (;), Komma (,) oder mehrere Leerzeichen
  const sample = lines.slice(0, 10).join('\n');
  let delimiter: string | RegExp = '\t';
  if (sample.includes('\t')) {
    delimiter = '\t';
  } else if (sample.split(';').length > lines.length) {
    delimiter = ';';
  } else if (sample.split(',').length > lines.length * 2) {
    delimiter = ',';
  } else {
    delimiter = /\s{2,}|\s+/;
  }

  return lines.map(line => {
    if (typeof delimiter === 'string') {
      return line.split(delimiter).map(cell => cell.replace(/^["']|["']$/g, '').trim());
    }
    return line.split(delimiter).map(cell => cell.trim());
  });
}

/**
 * Extrahiert Textzeilen aus einer PDF-Datei (unterstützt unkomprimierte und FlateDecode-komprimierte PDF-Streams,
 * wie sie von jsPDF / Excel / Browser-PDF-Exporten erzeugt werden)
 */
async function extractRowsFromPdfBuffer(buffer: ArrayBuffer): Promise<string[][]> {
  const bytes = new Uint8Array(buffer);
  const latin1 = new TextDecoder('latin1').decode(bytes);
  const extractedStrings: string[] = [];

  // Hilfsfunktion: PDF-String-Literale (...) und Hex-Strings <...> aus einem Content-Stream lesen
  const collectTjStrings = (content: string) => {
    const regex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*(?:Tj|')|\[((?:[^[\]]|\([^()]*\))*)\]\s*TJ/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(content)) !== null) {
      const raw = m[1] !== undefined
        ? m[1]
        : (m[2].match(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g) || [])
            .map(s => s.slice(1, -1))
            .join('');
      const unescaped = raw
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\')
        .trim();
      if (unescaped) extractedStrings.push(unescaped);
    }
  };

  collectTjStrings(latin1);

  // DecompressionStream für FlateDecode-Streams (Standard in modernen Browsern & Node 18+)
  if (typeof DecompressionStream !== 'undefined') {
    const streamRegex = /stream\r?\n/g;
    let match: RegExpExecArray | null;
    while ((match = streamRegex.exec(latin1)) !== null) {
      const startOffset = match.index + match[0].length;
      const endIdx = latin1.indexOf('endstream', startOffset);
      if (endIdx === -1) continue;
      let sub = bytes.subarray(startOffset, endIdx);
      // Trim trailing CR/LF before endstream
      while (sub.length > 0 && (sub[sub.length - 1] === 0x0a || sub[sub.length - 1] === 0x0d)) {
        sub = sub.subarray(0, sub.length - 1);
      }
      if (sub.length < 4) continue;

      for (const format of ['deflate', 'deflate-raw'] as const) {
        try {
          const ds = new DecompressionStream(format);
          const writer = ds.writable.getWriter();
          writer.write(sub);
          writer.close();
          const decompressedBuf = await new Response(ds.readable).arrayBuffer();
          const decompressedText = new TextDecoder('latin1').decode(decompressedBuf);
          collectTjStrings(decompressedText);
          break;
        } catch {
          // Kein gültiger zlib/deflate Stream -> nächsten probieren
        }
      }
    }
  }

  // Gruppiere aufeinanderfolgende Tokens anhand von Datums-Tokens (z.B. "01.10.26" oder "01.10.2026") in Zeilen
  const rows: string[][] = [];
  let currentRow: string[] = [];
  for (const token of extractedStrings) {
    if (/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(token)) {
      if (currentRow.length > 0) rows.push(currentRow);
      currentRow = [token];
    } else if (currentRow.length > 0) {
      if (token.toLowerCase() === 'gesamt' || token.toLowerCase() === 'von' || token.toLowerCase() === 'bis') {
        if (token.toLowerCase() === 'gesamt') {
          rows.push(currentRow);
          currentRow = [];
        }
        continue;
      }
      currentRow.push(token);
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);

  return rows;
}

/**
 * Hauptfunktion: Parst eine oder mehrere hochgeladene Dateien (.xlsx, .xls, .csv, .pdf, .txt, .json)
 */
export async function parseTimesheetFiles(
  files: File[] | FileList,
  fallbackYearMonth: string
): Promise<TimesheetParseResult> {
  const fileArray = Array.from(files);
  const allShifts: ImportedShiftRow[] = [];
  const sheetSummaries: SheetImportSummary[] = [];
  let hasFallbackDateRows = false;

  for (const file of fileArray) {
    const lowerName = file.name.toLowerCase();

    // 1. JSON-Backup-Dateien ebenfalls fehlertolerant unterstützen
    if (lowerName.endsWith('.json')) {
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const rawArr = Array.isArray(json)
          ? json
          : Array.isArray(json.shifts)
          ? json.shifts
          : Array.isArray(json.meine_arbeitszeiten)
          ? json.meine_arbeitszeiten
          : [];
        const jsonShifts: ImportedShiftRow[] = [];
        for (let i = 0; i < rawArr.length; i++) {
          const item = rawArr[i];
          if (item && item.datum && item.kommen && item.gehen) {
            const pMin = Number(item.pauseMinuten) || 0;
            const netto = Number(item.nettoStunden) || berechneNetto(item.kommen, item.gehen, pMin);
            if (netto > 0) {
              jsonShifts.push({
                rowId: `${file.name}_json_${item.datum}_${i}`,
                selected: true,
                sourceSheet: 'JSON-Backup',
                sourceFile: file.name,
                datum: item.datum,
                kommen: item.kommen,
                gehen: item.gehen,
                pauseMinuten: pMin,
                nettoStunden: netto,
                schichtTyp: item.schichtTyp || 'Importiert',
                notiz: item.notiz
              });
            }
          }
        }
        allShifts.push(...jsonShifts);
        sheetSummaries.push({
          sheetId: `${file.name}::JSON-Backup`,
          sheetName: 'JSON-Backup',
          fileName: file.name,
          shiftCount: jsonShifts.length
        });
      } catch {
        // Ignoriere fehlerhaftes JSON
      }
      continue;
    }

    // 2. PDF-Stundenzettel
    if (lowerName.endsWith('.pdf')) {
      const buffer = await file.arrayBuffer();
      const pdfRows = await extractRowsFromPdfBuffer(buffer);
      const parsed = parseSheetRows(pdfRows, pdfRows, 'PDF-Stundenzettel', file.name, fallbackYearMonth);
      if (parsed.usedFallbackContext) hasFallbackDateRows = true;
      allShifts.push(...parsed.shifts);
      sheetSummaries.push({
        sheetId: `${file.name}::PDF-Stundenzettel`,
        sheetName: 'PDF-Stundenzettel',
        fileName: file.name,
        shiftCount: parsed.shifts.length,
        detectedYear: parsed.detectedYear,
        detectedMonth: parsed.detectedMonth
      });
      continue;
    }

    // 3. CSV / TSV / TXT
    if (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv') || lowerName.endsWith('.txt')) {
      const text = await file.text();
      const grid = parseTextToGrid(text);
      const parsed = parseSheetRows(grid, grid, file.name, file.name, fallbackYearMonth);
      if (parsed.usedFallbackContext) hasFallbackDateRows = true;
      allShifts.push(...parsed.shifts);
      sheetSummaries.push({
        sheetId: `${file.name}::${file.name}`,
        sheetName: file.name,
        fileName: file.name,
        shiftCount: parsed.shifts.length,
        detectedYear: parsed.detectedYear,
        detectedMonth: parsed.detectedMonth
      });
      continue;
    }

    // 4. Excel (.xlsx, .xls, .ods) über SheetJS (alle Tabellenblätter durchsuchen!)
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: false,
      cellNF: true,
      cellText: true
    });

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, {
        header: 1,
        raw: true,
        defval: ''
      });
      const fmtRows = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        raw: false,
        defval: ''
      });

      const parsed = parseSheetRows(rawRows, fmtRows, sheetName, file.name, fallbackYearMonth);
      if (parsed.usedFallbackContext) hasFallbackDateRows = true;

      if (parsed.shifts.length > 0 || workbook.SheetNames.length === 1) {
        allShifts.push(...parsed.shifts);
        sheetSummaries.push({
          sheetId: `${file.name}::${sheetName}`,
          sheetName,
          fileName: file.name,
          shiftCount: parsed.shifts.length,
          detectedYear: parsed.detectedYear,
          detectedMonth: parsed.detectedMonth
        });
      }
    }
  }

  // Sortiere alle erkannten Schichten chronologisch nach Datum
  allShifts.sort((a, b) => a.datum.localeCompare(b.datum));

  const { monthsList, monthsRangeLabel } = buildMonthsSummary(allShifts);

  return {
    shifts: allShifts,
    sheets: sheetSummaries,
    monthsList,
    monthsRangeLabel,
    hasFallbackDateRows
  };
}

/**
 * Parst direkt per Copy-&-Paste eingefügten Text (z.B. aus Excel markierte Zeilen)
 */
export function parsePastedTimesheetText(
  pastedText: string,
  fallbackYearMonth: string
): TimesheetParseResult {
  const grid = parseTextToGrid(pastedText);
  const parsed = parseSheetRows(grid, grid, 'Copy & Paste', 'Zwischenablage', fallbackYearMonth);
  const { monthsList, monthsRangeLabel } = buildMonthsSummary(parsed.shifts);

  return {
    shifts: parsed.shifts,
    sheets: [
      {
        sheetId: 'Zwischenablage::Copy & Paste',
        sheetName: 'Copy & Paste',
        fileName: 'Zwischenablage',
        shiftCount: parsed.shifts.length,
        detectedYear: parsed.detectedYear,
        detectedMonth: parsed.detectedMonth
      }
    ],
    monthsList,
    monthsRangeLabel,
    hasFallbackDateRows: parsed.usedFallbackContext
  };
}
