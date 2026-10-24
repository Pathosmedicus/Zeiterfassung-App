/**
 * Gaußsche Feiertagsberechnung für Deutschland (inkl. NRW-Feiertage für Minden)
 */

export function getFeiertageFuerJahr(jahr: number): Record<string, string> {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const ostersonntag = new Date(jahr, month - 1, day);

  const addDays = (date: Date, days: number): string => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  return {
    [`${jahr}-01-01`]: "Neujahr",
    [addDays(ostersonntag, -2)]: "Karfreitag",
    [addDays(ostersonntag, 0)]: "Ostersonntag",
    [addDays(ostersonntag, 1)]: "Ostermontag",
    [`${jahr}-05-01`]: "Tag der Arbeit",
    [addDays(ostersonntag, 39)]: "Christi Himmelfahrt",
    [addDays(ostersonntag, 49)]: "Pfingstsonntag",
    [addDays(ostersonntag, 50)]: "Pfingstmontag",
    [addDays(ostersonntag, 60)]: "Fronleichnam", // Gesetzlich in NRW
    [`${jahr}-10-03`]: "Tag d. Dt. Einheit",
    [`${jahr}-11-01`]: "Allerheiligen",         // Gesetzlich in NRW
    [`${jahr}-12-25`]: "1. Weihnachtstag",
    [`${jahr}-12-26`]: "2. Weihnachtstag",
  };
}

export interface DayInfo {
  isHoliday: boolean;
  holidayName: string | null;
  isSunday: boolean;
  isSaturday: boolean;
  isWeekend: boolean;
  bonusHint: string | null;
  dayOfWeekShort: string;
  dayOfWeekNumber: number; // 0 = So, 6 = Sa
}

const WOCHENTAGE_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function getDayInfo(datumStr: string): DayInfo {
  if (!datumStr) {
    return {
      isHoliday: false,
      holidayName: null,
      isSunday: false,
      isSaturday: false,
      isWeekend: false,
      bonusHint: null,
      dayOfWeekShort: '',
      dayOfWeekNumber: 0
    };
  }

  const parts = datumStr.split('-').map(Number);
  const jahr = parts[0];
  const monat = parts[1];
  const tag = parts[2];
  const dateObj = new Date(jahr, monat - 1, tag);
  const dayOfWeekNumber = dateObj.getDay();
  const dayOfWeekShort = WOCHENTAGE_KURZ[dayOfWeekNumber];

  const feiertage = getFeiertageFuerJahr(jahr);
  const holidayName = feiertage[datumStr] || null;
  const isHoliday = Boolean(holidayName);
  const isSunday = dayOfWeekNumber === 0;
  const isSaturday = dayOfWeekNumber === 6;
  const isWeekend = isSunday || isSaturday;

  let bonusHint: string | null = null;
  if (isHoliday) {
    bonusHint = `🎉 ${holidayName} (Feiertagszuschlag 27,21 %)`;
  } else if (isSunday) {
    bonusHint = '☀️ Sonntag (Sonntagszuschlag 27,21 %)';
  } else if (isSaturday) {
    bonusHint = '📅 Samstag (Zuschlag 13:00–21:00 Uhr)';
  }

  return {
    isHoliday,
    holidayName,
    isSunday,
    isSaturday,
    isWeekend,
    bonusHint,
    dayOfWeekShort,
    dayOfWeekNumber
  };
}
