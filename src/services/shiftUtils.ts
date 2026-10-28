/**
 * Reine Hilfsfunktionen (ohne Browser-/React-Abhängigkeiten) für:
 * - Zusammenführen von lokalen und Cloud-Schichten inkl. Lösch-Tombstones
 * - Ruhezeit-Prüfung (ArbZG: mind. 11 h zwischen zwei Diensten)
 * - Jahresgrenze-Status (Minijob)
 * - CSV- und iCal-Export
 *
 * WICHTIG: Diese Datei darf nur `import type` verwenden, damit sie in den
 * Node-Tests (test/shiftUtils.test.js) direkt ausgeführt werden kann.
 */
import type { ShiftEntry } from '../types';

export type DeletedShiftMap = Record<string, { datum: string; deletedAt: string }>;

const MONATSNAMEN_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function toTime(iso?: string): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// ---------------------------------------------------------------------------
// 1. MERGE (lokal + Cloud) MIT TOMBSTONES
// ---------------------------------------------------------------------------

/**
 * Führt lokale und Cloud-Schichten pro Kalendertag zusammen:
 * - Pro Tag gewinnt der Eintrag mit dem neueren `updatedAt`. Bei Gleichstand gewinnt die Cloud.
 * - Lösch-Tombstones werden vereinigt (der jüngere `deletedAt` gewinnt).
 * - Eine Schicht bleibt nur erhalten, wenn sie NEUER ist als ihr Tombstone.
 *
 * Dadurch gehen offline erfasste Schichten nicht verloren, und gelöschte Schichten
 * erwachen nicht wieder zum Leben.
 */
export function mergeShiftsWithTombstones(
  localShifts: ShiftEntry[] = [],
  cloudShifts: ShiftEntry[] = [],
  localDeleted: DeletedShiftMap = {},
  cloudDeleted: DeletedShiftMap = {}
): { shifts: ShiftEntry[]; deleted: DeletedShiftMap } {
  // Tombstones vereinigen
  const deleted: DeletedShiftMap = { ...(cloudDeleted || {}) };
  for (const [datum, item] of Object.entries(localDeleted || {})) {
    const existing = deleted[datum];
    if (!existing || toTime(item.deletedAt) >= toTime(existing.deletedAt)) {
      deleted[datum] = item;
    }
  }

  // Pro Tag die neuere Schicht wählen
  const byDay = new Map<string, ShiftEntry>();
  for (const s of cloudShifts || []) {
    if (s && s.datum) byDay.set(s.datum, s);
  }
  for (const s of localShifts || []) {
    if (!s || !s.datum) continue;
    const cloud = byDay.get(s.datum);
    if (!cloud || toTime(s.updatedAt) > toTime(cloud.updatedAt)) {
      byDay.set(s.datum, s);
    }
  }

  // Tombstones anwenden: Schicht überlebt nur, wenn sie neuer als das Löschen ist
  const shifts: ShiftEntry[] = [];
  for (const s of byDay.values()) {
    const tomb = deleted[s.datum];
    if (tomb && toTime(s.updatedAt) <= toTime(tomb.deletedAt)) continue;
    shifts.push(s);
  }
  shifts.sort((a, b) => a.datum.localeCompare(b.datum));

  return { shifts, deleted };
}

/** Vergleicht zwei Schichtlisten inhaltlich (für die Entscheidung, ob ein Push nötig ist). */
export function sameShiftSet(a: ShiftEntry[] = [], b: ShiftEntry[] = []): boolean {
  if (a.length !== b.length) return false;
  const key = (s: ShiftEntry) =>
    [s.datum, s.kommen, s.gehen, s.pauseMinuten, s.nettoStunden, s.schichtTyp ?? '', s.notiz ?? '', s.nachtStunden ?? '', s.updatedAt ?? ''].join('|');
  const mapB = new Map(b.map(s => [s.datum, key(s)]));
  return a.every(s => mapB.get(s.datum) === key(s));
}

/** Vergleicht zwei Tombstone-Maps (gleiche Daten und gleicher deletedAt). */
export function sameDeletedMap(a: DeletedShiftMap = {}, b: DeletedShiftMap = {}): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(k => b[k] && b[k].deletedAt === a[k].deletedAt);
}

// ---------------------------------------------------------------------------
// 2. RUHEZEIT-PRÜFUNG
// ---------------------------------------------------------------------------

/** Minuten seit Epoche für Datum + Uhrzeit (UTC-Arithmetik, daher ohne Sommerzeit-Effekte). */
function toMinutes(datum: string, hhmm: string): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum);
  const t = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!d || !t) return null;
  const h = Number(t[1]);
  const m = Number(t[2]);
  if (h > 23 || m > 59) return null;
  return Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), h, m) / 60000;
}

/** Start- und Endzeitpunkt (Minuten seit Epoche); Ende vor/gleich Start = nächster Tag. */
export function getShiftSpan(shift: ShiftEntry): { start: number; end: number } | null {
  const start = toMinutes(shift.datum, shift.kommen);
  let end = toMinutes(shift.datum, shift.gehen);
  if (start === null || end === null) return null;
  if (end <= start) end += 24 * 60;
  return { start, end };
}

/**
 * Prüft die gesetzliche Ruhezeit (Standard 11 h) zwischen der neuen Schicht und ihren
 * unmittelbaren Nachbarn. Gibt einen Hinweistext zurück oder null, wenn alles in Ordnung ist.
 * Schichten ohne Arbeitszeit (0 h) und der Eintrag desselben Tages werden ignoriert.
 */
export function checkRestTime(
  shifts: ShiftEntry[],
  newShift: ShiftEntry,
  minHours: number = 11
): string | null {
  const span = getShiftSpan(newShift);
  if (!span || !(newShift.nettoStunden > 0)) return null;

  let prevEnd: number | null = null;
  let prevDatum = '';
  let nextStart: number | null = null;
  let nextDatum = '';

  for (const other of shifts) {
    if (!other || other.datum === newShift.datum || !(other.nettoStunden > 0)) continue;
    const o = getShiftSpan(other);
    if (!o) continue;
    if (o.start <= span.start) {
      if (prevEnd === null || o.end > prevEnd) {
        prevEnd = o.end;
        prevDatum = other.datum;
      }
    } else if (nextStart === null || o.start < nextStart) {
      nextStart = o.start;
      nextDatum = other.datum;
    }
  }

  const minMinutes = minHours * 60;
  const fmt = (min: number) => `${Math.floor(Math.abs(min) / 60)} h ${pad2(Math.abs(min) % 60)} min`;

  if (prevEnd !== null) {
    const gap = span.start - prevEnd;
    if (gap < 0) return `Überschneidung mit dem Dienst vom ${formatDe(prevDatum)}.`;
    if (gap < minMinutes) {
      return `Nur ${fmt(gap)} Ruhezeit nach dem Dienst vom ${formatDe(prevDatum)} (empfohlen: ${minHours} h).`;
    }
  }
  if (nextStart !== null) {
    const gap = nextStart - span.end;
    if (gap < 0) return `Überschneidung mit dem Dienst vom ${formatDe(nextDatum)}.`;
    if (gap < minMinutes) {
      return `Nur ${fmt(gap)} Ruhezeit vor dem Dienst vom ${formatDe(nextDatum)} (empfohlen: ${minHours} h).`;
    }
  }
  return null;
}

function formatDe(datum: string): string {
  const [y, m, d] = datum.split('-');
  return `${d}.${m}.${y}`;
}

// ---------------------------------------------------------------------------
// 3. JAHRESGRENZE (Minijob)
// ---------------------------------------------------------------------------

export type LimitLevel = 'ok' | 'warn' | 'over';

/** Bewertet den bisherigen Jahresverdienst gegen die Jahresgrenze (Warnung ab 90 %). */
export function annualLimitStatus(
  total: number,
  limit: number
): { ratio: number; level: LimitLevel } {
  if (!(limit > 0)) return { ratio: 0, level: 'ok' };
  const ratio = total / limit;
  if (ratio > 1) return { ratio, level: 'over' };
  if (ratio >= 0.9) return { ratio, level: 'warn' };
  return { ratio, level: 'ok' };
}

// ---------------------------------------------------------------------------
// 4. CSV-EXPORT (Excel-DE-kompatibel: Semikolon, Komma-Dezimal, UTF-8-BOM)
// ---------------------------------------------------------------------------

function csvCell(value: string | number | undefined): string {
  let text = value === undefined || value === null ? '' : String(value);
  // Schutz vor CSV-/Formel-Injection in Excel
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[;"\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

function deNumber(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
}

/** Erzeugt den CSV-Text aller Schichten eines Monats (YYYY-MM), inklusive Summenzeile. */
export function shiftsToCsv(shifts: ShiftEntry[], yearMonth: string): string {
  const rows = shifts
    .filter(s => s && s.datum && s.datum.startsWith(yearMonth))
    .sort((a, b) => a.datum.localeCompare(b.datum));

  const lines: string[] = [
    ['Datum', 'Wochentag', 'Kommen', 'Gehen', 'Pause (Min)', 'Netto (h)', 'Schichttyp', 'Notiz'].join(';')
  ];
  let total = 0;
  for (const s of rows) {
    const [y, m, d] = s.datum.split('-').map(Number);
    const wd = WOCHENTAGE[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    total += s.nettoStunden || 0;
    lines.push(
      [
        csvCell(formatDe(s.datum)),
        csvCell(wd),
        csvCell(s.kommen),
        csvCell(s.gehen),
        csvCell(s.pauseMinuten),
        csvCell(deNumber(s.nettoStunden || 0)),
        csvCell(s.schichtTyp),
        csvCell(s.notiz)
      ].join(';')
    );
  }
  lines.push(['Summe', '', '', '', '', deNumber(total), '', ''].join(';'));
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------
// 5. iCAL-EXPORT (RFC 5545, lokale Zeit ohne Zeitzone = "floating")
// ---------------------------------------------------------------------------

function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Faltet Zeilen > 70 Zeichen gemäß RFC 5545 (Fortsetzungszeile beginnt mit Leerzeichen). */
function icsFold(line: string): string {
  const chars = Array.from(line);
  if (chars.length <= 70) return line;
  const parts: string[] = [];
  let i = 0;
  parts.push(chars.slice(i, i + 70).join(''));
  i += 70;
  while (i < chars.length) {
    parts.push(' ' + chars.slice(i, i + 69).join(''));
    i += 69;
  }
  return parts.join('\r\n');
}

function icsDateTime(minutes: number): string {
  const d = new Date(minutes * 60000);
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}00`
  );
}

/** Erzeugt eine .ics-Datei mit einem Termin je Schicht. `now` ist für Tests injizierbar. */
export function shiftsToIcs(shifts: ShiftEntry[], now: Date = new Date()): string {
  const stamp =
    `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}` +
    `T${pad2(now.getUTCHours())}${pad2(now.getUTCMinutes())}${pad2(now.getUTCSeconds())}Z`;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zeiterfassung//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  const sorted = shifts
    .filter(s => s && s.datum && s.nettoStunden > 0)
    .sort((a, b) => a.datum.localeCompare(b.datum));

  for (const s of sorted) {
    const span = getShiftSpan(s);
    if (!span) continue;
    const titel = `${s.schichtTyp || 'Dienst'} (${deNumber(s.nettoStunden)} h)`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.datum}@zeiterfassung`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDateTime(span.start)}`,
      `DTEND:${icsDateTime(span.end)}`,
      `SUMMARY:${icsEscape(titel)}`
    );
    const beschreibung = [`Pause: ${s.pauseMinuten || 0} Min`, s.notiz ? `Notiz: ${s.notiz}` : ''].filter(Boolean).join('\n');
    lines.push(`DESCRIPTION:${icsEscape(beschreibung)}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

/** Kurzer Anzeigename eines Monats, z. B. "Okt 2026" (für Dateinamen/Toasts). */
export function monthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return `${MONATSNAMEN_KURZ[(m || 1) - 1]} ${y}`;
}
