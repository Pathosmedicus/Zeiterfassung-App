import { ShiftEntry, SalaryConfig, MonthSalaryStats, CashflowMonthStats, TariffPeriodInfo } from '../types';
import { getFeiertageFuerJahr } from './holidayEngine';

/**
 * Ermittelt die exakten TVöD-K EG 03 Tarifkonditionen für einen Monat (Klinikum Minden)
 * - Bis 30.04.2026: 17,16 € / Grund 85,80 € / So 4,67 € / Sa 0,64 € / Nacht 3,74 €
 * - 01.05.2026 bis 31.07.2026: 17,64 € / Grund 88,21 € / So 4,80 € / Sa 0,64 € / Nacht 3,74 €
 * - Ab 01.08.2026: 18,90 € / Grund 94,51 € / So 4,80 € / Sa 0,64 € / Nacht 3,74 €
 */
export function getTariffForMonth(jahr: number, monat: number, config?: SalaryConfig): TariffPeriodInfo {
  // 1. Bis 30.04.2026 (EG 03 Stufe 1)
  if (jahr < 2026 || (jahr === 2026 && monat <= 4)) {
    return {
      name: 'EG 03 Stufe 1',
      hourlyWage: config?.baseOld ?? 17.16,
      basePay5h: 85.80, // 5.00h * 17.16
      sundayBonus: config?.sunRateOld ?? 4.67,
      saturdayBonus: config?.satRate ?? 0.64,
      nightBonus: config?.nightRate ?? 3.74,
      vblPercent: config?.vblPercent ?? 1.81
    };
  }

  // 2. 01.05.2026 bis 31.07.2026 (Tariferhöhung EG 03 Stufe 1)
  if (jahr === 2026 && monat >= 5 && monat <= 7) {
    return {
      name: 'EG 03 Stufe 1 (Tariferhöhung)',
      hourlyWage: config?.baseMid ?? 17.64,
      basePay5h: 88.21, // Klinikabrechnungswert
      sundayBonus: config?.sunRateNew ?? 4.80,
      saturdayBonus: config?.satRate ?? 0.64,
      nightBonus: config?.nightRate ?? 3.74,
      vblPercent: config?.vblPercent ?? 1.81
    };
  }

  // 3. Ab 01.08.2026 (Stufenaufstieg EG 03 Stufe 2)
  return {
    name: 'EG 03 Stufe 2 (Stufenaufstieg)',
    hourlyWage: config?.baseNew ?? 18.90,
    basePay5h: 94.51, // Klinikabrechnungswert
    sundayBonus: config?.sunRateNew ?? 4.80,
    saturdayBonus: config?.satRate ?? 0.64,
    nightBonus: config?.nightRate ?? 3.74,
    vblPercent: config?.vblPercent ?? 1.81
  };
}

/**
 * Ermittelt den Basisstundenlohn für einen bestimmten Monat
 */
export function getActiveWageForMonth(jahr: number, monat: number, config: SalaryConfig): number {
  return getTariffForMonth(jahr, monat, config).hourlyWage;
}

/**
 * Berechnet die Netto-Arbeitszeit in Minuten unter Berücksichtigung von Pausen
 * und Nachtschichten über Mitternacht.
 */
export function berechneMinuten(kommen: string, gehen: string, pauseMinuten: number = 0): number {
  if (!kommen || !gehen) return 0;
  const [sH, sM] = kommen.split(':').map(Number);
  const [eH, eM] = gehen.split(':').map(Number);
  if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) return 0;

  let startMin = sH * 60 + sM;
  let endMin = eH * 60 + eM;

  if (endMin === startMin) return 0; // z.B. 08:00 - 08:00 -> kein 24h Dienst
  if (endMin < startMin) {
    endMin += 24 * 60; // Nachtdienst über Mitternacht
  }

  const pause = Math.max(0, parseInt(String(pauseMinuten), 10) || 0);
  return Math.max(0, (endMin - startMin) - pause);
}

/**
 * Berechnet Netto-Stunden als Dezimalzahl (z.B. 8.00 oder 7.75)
 */
export function berechneNetto(kommen: string, gehen: string, pauseMinuten: number = 0): number {
  const nettoMin = berechneMinuten(kommen, gehen, pauseMinuten);
  return Math.round((nettoMin / 60) * 100) / 100;
}

/**
 * Berechnet die Gehalts- und Zuschlagsstatistik für einen gesamten Monat (Leistungswert)
 */
export function calculateMonthSalary(
  jahr: number,
  monat: number,
  shifts: ShiftEntry[],
  config: SalaryConfig
): MonthSalaryStats {
  const tageImMonat = new Date(jahr, monat, 0).getDate();
  let gesamtDezimal = 0;
  let sonntagStunden = 0;
  let samstagBonusStunden = 0;
  let nachtStunden = 0;
  let anzahlDienste = 0;

  const tariff = getTariffForMonth(jahr, monat, config);
  const feiertage = getFeiertageFuerJahr(jahr);
  const shiftMap = new Map(shifts.map(s => [s.datum, s]));

  for (let tag = 1; tag <= tageImMonat; tag++) {
    const datumStr = `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`;
    const dateObj = new Date(jahr, monat - 1, tag);
    const dayOfWeek = dateObj.getDay();
    const isHoliday = Boolean(feiertage[datumStr]);

    const entry = shiftMap.get(datumStr);
    if (entry && entry.nettoStunden > 0) {
      anzahlDienste++;
      gesamtDezimal += entry.nettoStunden;

      // Sonntag oder gesetzlicher Feiertag (LA 362)
      if (dayOfWeek === 0 || isHoliday) {
        sonntagStunden += entry.nettoStunden;
      }
      // Samstag: Zuschlag für Zeitfenster 13:00 - 21:00 Uhr (LA 332)
      else if (dayOfWeek === 6 && entry.kommen && entry.gehen) {
        const [sH, sM] = entry.kommen.split(':').map(Number);
        const [eH, eM] = entry.gehen.split(':').map(Number);
        if (!isNaN(sH) && !isNaN(eH)) {
          let startDez = sH + (sM / 60);
          let endDez = eH + (eM / 60);
          if (endDez <= startDez) endDez += 24;

          const overlapStart = Math.max(startDez, 13.0);
          const overlapEnd = Math.min(endDez, 21.0);
          if (overlapEnd > overlapStart) {
            samstagBonusStunden += Math.min((overlapEnd - overlapStart), entry.nettoStunden);
          }
        }
      }

      // Nachtstunden: explizit hinterlegt oder berechnet (21:00 - 06:00)
      if (entry.nachtStunden && entry.nachtStunden > 0) {
        nachtStunden += entry.nachtStunden;
      } else if (entry.kommen && entry.gehen) {
        const [sH, sM] = entry.kommen.split(':').map(Number);
        const [eH, eM] = entry.gehen.split(':').map(Number);
        if (!isNaN(sH) && !isNaN(eH)) {
          let startDez = sH + (sM / 60);
          let endDez = eH + (eM / 60);
          if (endDez <= startDez) endDez += 24; // Nachtschicht

          // 21:00 bis 06:00 (bzw. 21.0 bis 30.0)
          let nightOverlap = 0;
          // Nachtzeit vor Mitternacht (21:00 - 24:00)
          const night1Start = Math.max(startDez, 21.0);
          const night1End = Math.min(endDez, 24.0);
          if (night1End > night1Start) nightOverlap += (night1End - night1Start);

          // Nachtzeit nach Mitternacht (24:00 - 30:00 / 06:00)
          const night2Start = Math.max(startDez, 24.0);
          const night2End = Math.min(endDez, 30.0);
          if (night2End > night2Start) nightOverlap += (night2End - night2Start);

          if (nightOverlap > 0) {
            nachtStunden += Math.min(nightOverlap, entry.nettoStunden);
          }
        }
      }
    }
  }

  // Rundung der geleisteten Stunden
  const roundHours = Math.round(gesamtDezimal * 100) / 100;
  const roundSo = Math.round(sonntagStunden * 100) / 100;
  const roundSa = Math.round(samstagBonusStunden * 100) / 100;
  const roundNacht = Math.round(nachtStunden * 100) / 100;

  // Aufteilung in 5.00h Grundvertrag (LA 200) und Mehrstunden (LA 208)
  const grundStunden = Math.min(5.00, roundHours);
  const mehrStunden = Math.max(0, roundHours - 5.00);

  // LA 200 Grundlohn: 5h Pauschale
  const grundLohnLA200 = roundHours > 0 ? tariff.basePay5h : 0;
  const mehrLohnLA208 = Math.round(mehrStunden * tariff.hourlyWage * 100) / 100;
  const basisLohn = Math.round(roundHours * tariff.hourlyWage * 100) / 100;

  // Zeitzuschläge
  const sonntagLohn = Math.round(roundSo * tariff.sundayBonus * 100) / 100;
  const samstagLohn = Math.round(roundSa * tariff.saturdayBonus * 100) / 100;
  const nachtLohn = Math.round(roundNacht * tariff.nightBonus * 100) / 100;

  // Brutto gesamt
  const gesamtGehalt = Math.round((basisLohn + sonntagLohn + samstagLohn + nachtLohn) * 100) / 100;

  // VBL: 1,81 % auf VBL-Brutto (LA 200 + LA 208 + LA 332)
  // Sonntags- (LA 362) und Nachtzuschläge (LA 360) sind komplett steuer- und VBL-frei (0 % Abzug!)
  const vblBrutto = Math.round((basisLohn + samstagLohn) * 100) / 100;
  const vblAbzug = Math.round(vblBrutto * (tariff.vblPercent / 100) * 100) / 100;

  // Erwartetes Netto (Leistungswert)
  const erwartetesNetto = Math.round(((vblBrutto - vblAbzug) + sonntagLohn + nachtLohn) * 100) / 100;

  return {
    activeBaseWage: tariff.hourlyWage,
    tariffName: tariff.name,
    gesamtDezimal: roundHours,
    anzahlDienste,
    sonntagStunden: roundSo,
    samstagBonusStunden: roundSa,
    nachtStunden: roundNacht,
    grundStunden,
    mehrStunden,
    basisLohn,
    grundLohnLA200,
    mehrLohnLA208,
    sonntagLohn,
    samstagLohn,
    nachtLohn,
    gesamtGehalt,
    vblBrutto,
    vblAbzug,
    erwartetesNetto
  };
}

/**
 * Berechnet die tatsächliche Bank-Überweisung für Monat M nach der realen Drei-Stufen-Versatzlogik:
 * 1. Laufender Monat (M): 5.00 Std. Grundvergütung (LA 200)
 * 2. Rückrechnung Vormonat (M-1): (Gesamtstunden(M-1) - 5h) * Stundenlohn(M-1) als LA 208
 * 3. Zeitzuschläge aus Vor-Vormonat (M-2): Sonntag (LA 362), Samstag (LA 332), Nacht (LA 360)
 * 4. VBL-Abzug: exakt 1.81 % auf VBL-Brutto (LA 200 + LA 208 + LA 332)
 */
export function calculateCashflowPayout(
  jahr: number,
  monat: number,
  shifts: ShiftEntry[],
  config: SalaryConfig
): CashflowMonthStats {
  const auszahlungsMonat = `${jahr}-${String(monat).padStart(2, '0')}`;
  const tariffM = getTariffForMonth(jahr, monat, config);

  // 1. Laufender Monat M: LA 200 Grundvergütung
  const laufenderMonatLA200 = tariffM.basePay5h;

  // 2. Vormonat M-1: Aushilfsstunden LA 208
  let yM1 = monat === 1 ? jahr - 1 : jahr;
  let mM1 = monat === 1 ? 12 : monat - 1;
  const statsM1 = calculateMonthSalary(yM1, mM1, shifts, config);
  const vormonatMehrstundenLA208 = statsM1.mehrLohnLA208;
  const vormonatStunden = statsM1.gesamtDezimal;

  // 3. Vor-Vormonat M-2: Zeitzuschläge
  let yM2 = mM1 === 1 ? yM1 - 1 : yM1;
  let mM2 = mM1 === 1 ? 12 : mM1 - 1;
  const statsM2 = calculateMonthSalary(yM2, mM2, shifts, config);
  const vorVormonatSonntagLA362 = statsM2.sonntagLohn;
  const vorVormonatSamstagLA332 = statsM2.samstagLohn;
  const vorVormonatNachtLA360 = statsM2.nachtLohn;

  // VBL-Berechnung
  const vblBrutto = Math.round((laufenderMonatLA200 + vormonatMehrstundenLA208 + vorVormonatSamstagLA332) * 100) / 100;
  const vblAbzug = Math.round(vblBrutto * (tariffM.vblPercent / 100) * 100) / 100;

  // Reguläre Netto-Überweisung
  const bankAuszahlungSoll = Math.round(
    ((vblBrutto - vblAbzug) + vorVormonatSonntagLA362 + vorVormonatNachtLA360) * 100
  ) / 100;

  return {
    auszahlungsMonat,
    laufenderMonatLA200,
    vormonatMehrstundenLA208,
    vormonatStunden,
    vorVormonatSonntagLA362,
    vorVormonatSamstagLA332,
    vorVormonatNachtLA360,
    sonderzahlungen: 0,
    vblBrutto,
    vblAbzug,
    bankAuszahlungSoll
  };
}
