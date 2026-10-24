import { ClinicPayrollRecord, TariffPeriodInfo, SalaryConfig, ShiftEntry, MonthPayoutOverride, OpenClaimItem } from '../types';
import { calculateMonthSalary, calculateCashflowPayout, getTariffForMonth } from './salaryEngine';

/**
 * Reale Abrechnungs- und Tarifregeln der Mühlenkreiskliniken Minden
 * TVöD-K EG 03, 5,00 Std./Monat Grundvertrag (LA 200), Minijob PGS 6500
 */

export interface OpenClaim {
  id: string;
  titel: string;
  zeitraum: string;
  betragNetto: number;
  kategorie: 'anomalie_2025' | 'nachforderung_2026';
  status: 'offen' | 'in_klaerung' | 'beglichen';
  kurzBeschreibung: string;
  details: string[];
}

export const OPEN_CLAIMS: OpenClaim[] = [
  {
    id: 'claim_2025_zuschlaege',
    titel: 'Ausstehende Zeitzuschläge Sep–Dez 2025',
    zeitraum: 'September 2025 – Dezember 2025',
    betragNetto: 181.14,
    kategorie: 'anomalie_2025',
    status: 'offen',
    kurzBeschreibung: 'Zeitzuschläge für 4 Monate wurden vom Klinikum noch nicht ausgezahlt.',
    details: [
      '38,25 Std. Sonntagszuschlag (LA 362) à 4,67 € = 178,63 € (steuer- und VBL-frei)',
      '3,92 Std. Samstagszuschlag (LA 332) à 0,64 € = 2,51 € (abzgl. 1,81 % VBL = 2,46 € netto)',
      'Betrifft: Sep (9,0h So, 0,17h Sa), Okt (3,25h So, 3,75h Sa), Nov (12,0h So), Dez (14,0h So)',
      'Gesamtforderung 2025: 181,14 € netto'
    ]
  },
  {
    id: 'claim_2026_09_abrechnungsfehler',
    titel: 'Abrechnungsfehler Personalabteilung September 2026',
    zeitraum: 'Abrechnungsmonat September 2026',
    betragNetto: 317.98,
    kategorie: 'nachforderung_2026',
    status: 'offen',
    kurzBeschreibung: 'Gravierender HR-Berechnungsfehler: Netto-Nachforderungsanspruch von 317,98 €.',
    details: [
      'Fehler 1: Sozialversicherungstage (SV-Tage) fälschlicherweise auf 0 gesetzt',
      'Fehler 2: August-Grundvergütung (-94,51 €) und August-Zuschlag (-64,80 €) unberechtigt storniert/abgezogen',
      'Fehler 3: Regulärer September-Grundlohn (5,00 Std. LA 200 = 94,51 €) gar nicht vergütet (0,00 €)',
      'Fehler 4: August-Mehrstunden (24,33 Std.) nur mit 17,64 € statt 18,90 € (Stufe 2 ab 01.08.2026) abgerechnet (-30,66 €)',
      'Tatsächliche Überweisung Bank 09/26: 263,81 € (Soll wäre 581,79 €)',
      'Netto-Differenz / Nachforderungsanspruch: 317,98 € netto'
    ]
  }
];

export const TOTAL_OPEN_CLAIMS_NETTO = 181.14 + 317.98; // 499.12 €

/**
 * Reale historische Monatsdaten 2025 & 2026
 */
export const HISTORICAL_PAYROLL_RECORDS: ClinicPayrollRecord[] = [
  // --- JAHR 2025 ---
  {
    yearMonth: '2025-08',
    label: 'Aug 2025',
    gesamtStunden: 23.00,
    sonntagStunden: 5.00,
    samstagStunden: 6.00,
    bankIst: 84.25,
    bankSollRegulaer: 84.25,
    differenz: 0.00,
    status: 'ok',
    statusBadge: '✅ Exakt',
    hrNotiz: 'Erster Monat: 5,00h Grundvergütung (LA 200: 85,80 € abzgl. 1,81 % VBL 1,55 € = 84,25 €).'
  },
  {
    yearMonth: '2025-09',
    label: 'Sep 2025',
    gesamtStunden: 24.50,
    sonntagStunden: 9.00,
    samstagStunden: 0.17,
    bankIst: 400.54,
    bankSollRegulaer: 387.54,
    differenz: 13.00,
    status: 'ok',
    statusBadge: '✅ Inkl. Sondererstattung',
    sonderzahlungText: 'Führungszeugnis-Erstattung',
    sonderzahlungBetrag: 13.00,
    hrNotiz: 'Regulär 387,54 € + 13,00 € steuerfreie Erstattung für Führungszeugnis = 400,54 €.'
  },
  {
    yearMonth: '2025-10',
    label: 'Okt 2025',
    gesamtStunden: 28.00,
    sonntagStunden: 3.25,
    samstagStunden: 3.75,
    bankIst: 111.37,
    bankSollRegulaer: 440.00,
    differenz: -328.63,
    status: 'anomaly',
    statusBadge: '⚠️ HR-Fehler: Sep-Mehrstunden vergessen',
    hrNotiz: 'HR-Fehler: Rückrechnung der Sep-Mehrstunden (19,5h * 17,16 € = 334,62 € brutto / 328,56 € netto) wurde vergessen! Nur Grundlohn + Aug-Zuschläge ausgezahlt.'
  },
  {
    yearMonth: '2025-11',
    label: 'Nov 2025',
    gesamtStunden: 25.00,
    sonntagStunden: 12.00,
    samstagStunden: 0.00,
    bankIst: 830.17,
    bankSollRegulaer: 471.78,
    differenz: 358.39,
    status: 'ok',
    statusBadge: '💰 Doppel-Rückrechnung + JSZ',
    sonderzahlungText: 'Jahressonderzahlung + Doppel-Rückrechnung',
    sonderzahlungBetrag: 30.38,
    hrNotiz: 'Doppel-Rückrechnung für Sep (+328,56 € netto) & Okt (+387,53 € netto) + Jahressonderzahlung (+30,38 € brutto / 29,83 € netto) + Nov-Grundlohn (84,25 €) = 830,17 €.'
  },
  {
    yearMonth: '2025-12',
    label: 'Dez 2025',
    gesamtStunden: 14.00,
    sonntagStunden: 14.00,
    samstagStunden: 0.00,
    bankIst: 421.24,
    bankSollRegulaer: 421.24,
    differenz: 0.00,
    status: 'ok',
    statusBadge: '✅ Exakt (Grund + Nov)',
    hrNotiz: 'Nov-Mehrstunden (20h * 17,16 € = 343,20 €) + Dez-Grundlohn (85,80 €) - 1,81 % VBL (7,76 €) = 421,24 €. Hinweis: Zeitzuschläge Sep–Dez stehen weiter aus.'
  },

  // --- JAHR 2026 ---
  {
    yearMonth: '2026-01',
    label: 'Jan 2026',
    gesamtStunden: 29.00,
    sonntagStunden: 12.75,
    samstagStunden: 0.00,
    abgerechnetSonntag: 12.50,
    bankIst: 235.89,
    bankSollRegulaer: 235.89,
    differenz: 0.00,
    status: 'ok',
    statusBadge: '✅ Exakt',
    hrNotiz: 'Dez-Mehrstunden (9h * 17,16 € = 154,44 €) + Jan-Grundlohn (85,80 €) - 1,81 % VBL (4,35 €) = 235,89 €.'
  },
  {
    yearMonth: '2026-02',
    label: 'Feb 2026',
    gesamtStunden: 29.50,
    sonntagStunden: 16.00,
    samstagStunden: 0.75,
    abgerechnetSonntag: 15.25,
    bankIst: 488.63,
    bankSollRegulaer: 488.63,
    differenz: 0.00,
    status: 'ok',
    statusBadge: '✅ Exakt',
    hrNotiz: 'Jan-Mehrstunden (24h * 17,16 € = 411,84 €) + Feb-Grundlohn (85,80 €) - 1,81 % VBL (9,01 €) = 488,63 €.'
  },
  {
    yearMonth: '2026-03',
    label: 'Mär 2026',
    gesamtStunden: 30.00,
    sonntagStunden: 14.75,
    samstagStunden: 0.00,
    nachtStunden: 3.17,
    bankIst: 1039.86,
    bankSollRegulaer: 546.51,
    differenz: 493.35,
    status: 'anomaly',
    statusBadge: '⚠️ HR-Fehler: März zu früh bezahlt',
    hrNotiz: 'HR-Fehler: Neben Feb-Rückrechnung (420,42 €) wurden 28,75h für März bereits im März ausgezahlt (+493,35 €) + Jan-Zuschläge (58,38 €) = 1.039,86 €.'
  },
  {
    yearMonth: '2026-04',
    label: 'Apr 2026',
    gesamtStunden: 29.00,
    sonntagStunden: 12.25,
    samstagStunden: 0.00,
    bankIst: 92.75,
    bankSollRegulaer: 155.94,
    differenz: -63.19,
    status: 'anomaly',
    statusBadge: '📉 Korrektur März-Überzahlung',
    hrNotiz: 'Verrechnung März-Überzahlung: Abzug von -3,75h (-64,35 € brutto / -63,19 € netto) + Feb-Zuschläge (71,69 €) + Apr-Grundlohn (85,80 €) = 92,75 €.'
  },
  {
    yearMonth: '2026-05',
    label: 'Mai 2026',
    gesamtStunden: 29.75,
    sonntagStunden: 13.25,
    samstagStunden: 5.25,
    abgerechnetSamstag: 5.00,
    bankIst: 571.73,
    bankSollRegulaer: 571.74,
    differenz: -0.01,
    status: 'ok',
    statusBadge: '✅ Tariferhöhung (17,64 €)',
    hrNotiz: 'Neuer Grundlohn (88,21 €) + Apr-Mehrstunden (24h * 17,16 € = 411,84 €) + Mär-Zuschläge (68,88 € So + 11,86 € Nacht) - VBL = 571,73 €.'
  },
  {
    yearMonth: '2026-06',
    label: 'Jun 2026',
    gesamtStunden: 30.00,
    sonntagStunden: 14.00,
    samstagStunden: 0.00,
    abgerechnetSonntag: 13.50,
    bankIst: 572.51,
    bankSollRegulaer: 572.51,
    differenz: 0.00,
    status: 'ok',
    statusBadge: '✅ Exakt',
    hrNotiz: 'Mai-Mehrstunden (24,75h * 17,64 € = 436,59 €) + Jun-Grundlohn (88,21 €) + Apr-Zuschläge (12,25h * 4,67 € = 57,21 €) - VBL = 572,51 €.'
  },
  {
    yearMonth: '2026-07',
    label: 'Jul 2026',
    gesamtStunden: 29.50,
    sonntagStunden: 7.00,
    samstagStunden: 6.17,
    bankIst: 594.17,
    bankSollRegulaer: 594.17,
    differenz: 0.00,
    status: 'ok',
    statusBadge: '✅ Inkl. Einmalzahlung',
    sonderzahlungText: 'Tarifl. Einmalzahlung',
    sonderzahlungBetrag: 7.94,
    hrNotiz: 'Jun-Mehrstunden (441,00 €) + Jul-Grundlohn (88,21 €) + Einmalzahlung (7,94 €) + Mai-Zuschläge (63,60 € So + 3,20 € Sa) - VBL = 594,17 €.'
  },
  {
    yearMonth: '2026-08',
    label: 'Aug 2026',
    gesamtStunden: 29.33,
    sonntagStunden: 12.33,
    samstagStunden: 6.25,
    bankIst: 581.96,
    bankSollRegulaer: 581.96,
    differenz: 0.00,
    status: 'ok',
    statusBadge: '✅ Stufenaufstieg Stufe 2 (18,90 €)',
    hrNotiz: 'Neuer Grundlohn Stufe 2 (94,51 €) + Jul-Mehrstunden (24,5h * 17,64 € = 432,18 €) + Jun-Zuschläge (13,5h * 4,80 € = 64,80 €) - VBL = 581,96 €.'
  },
  {
    yearMonth: '2026-09',
    label: 'Sep 2026',
    gesamtStunden: 28.50,
    sonntagStunden: 8.00,
    samstagStunden: 6.50,
    bankIst: 263.81,
    bankSollRegulaer: 581.79,
    differenz: -317.98,
    status: 'claim',
    statusBadge: '🚨 Abrechnungsfehler (317,98 € offen)',
    offenerAnspruch: 317.98,
    hrNotiz: 'HR-FEHLER: SV-Tage fälschlich auf 0 gesetzt, Aug-Grundlohn (-94,51 €) & Aug-Zuschlag (-64,80 €) storniert, Sep-Grundlohn 0,00 €, Aug-Lohn nur mit 17,64 € statt 18,90 € gerechnet -> 317,98 € Netto-Nachforderungsanspruch!'
  },
  {
    yearMonth: '2026-10',
    label: 'Okt 2026',
    gesamtStunden: 29.42,
    sonntagStunden: 19.75,
    samstagStunden: 1.75,
    bankIst: 910.00, // Erwartet inkl. Korrektur
    bankSollRegulaer: 592.02,
    differenz: 317.98,
    status: 'forecast',
    statusBadge: '🔮 Prognose: 592,02 € / 910,00 €',
    hrNotiz: 'Auszahlungsprognose Ende 10/26: Regulär fällig 592,02 € bzw. 910,00 € inkl. Nachzahlung der 317,98 € aus September.'
  }
];

const MONTH_NAMES_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export function formatMonthLabel(jahr: number, monat: number): string {
  if (monat < 1 || monat > 12) return `${jahr}-${String(monat).padStart(2, '0')}`;
  return `${MONTH_NAMES_DE[monat - 1]} ${jahr}`;
}

/**
 * Dynamische Berechnung der Abrechnungs- und Auszahlungsabgleich-Tabelle
 * für jeden beliebigen Mitarbeiter anhand der erfassten Schichten & Überweisungs-Eingaben
 */
export function getClinicPayrollRecords(
  shifts: ShiftEntry[],
  config: SalaryConfig,
  overrides: Record<string, MonthPayoutOverride> = {},
  resolvedClaims: Record<string, { isResolved: boolean; resolvedDate?: string }> = {}
): ClinicPayrollRecord[] {
  const monthSet = new Set<string>();

  // 1. Reale Referenzmonate (Aug 2025 bis Okt 2026)
  for (const r of HISTORICAL_PAYROLL_RECORDS) {
    monthSet.add(r.yearMonth);
  }

  // 2. Alle Monate mit erfassten Schichten des Mitarbeiters
  for (const s of shifts) {
    if (s.datum && s.datum.length >= 7) {
      monthSet.add(s.datum.substring(0, 7));
    }
  }

  // 3. Alle Monate mit manuellen Bank-Ist Eingaben
  for (const ym of Object.keys(overrides)) {
    monthSet.add(ym);
  }

  const sortedMonths = Array.from(monthSet).sort((a, b) => a.localeCompare(b));

  return sortedMonths.map(yearMonth => {
    const [jahr, monat] = yearMonth.split('-').map(Number);
    const hist = HISTORICAL_PAYROLL_RECORDS.find(h => h.yearMonth === yearMonth);
    const override = overrides[yearMonth];

    // Leistungswert des Monats (gearbeitete Stunden)
    const statsM = calculateMonthSalary(jahr, monat, shifts, config);

    // 3-Stufen-Versatz: Regulär fällige Banküberweisung
    const cashflow = calculateCashflowPayout(jahr, monat, shifts, config);
    const bankSollRegulaer = cashflow.bankAuszahlungSoll;

    // Tatsächliche Banküberweisung (Ist)
    let bankIst: number;
    if (override?.bankIst !== undefined && !isNaN(override.bankIst)) {
      bankIst = override.bankIst;
    } else if (hist) {
      bankIst = hist.bankIst;
    } else {
      bankIst = bankSollRegulaer;
    }

    // Erledigungsstatus (vom Mitarbeiter geschlossen)
    const claimKey = yearMonth === '2026-09' ? 'claim_2026_09_abrechnungsfehler' : `claim_${yearMonth}`;
    const claimResolution = resolvedClaims[claimKey] || resolvedClaims[yearMonth];
    const isResolved = Boolean(override?.isResolved || claimResolution?.isResolved);
    const resolvedDate = override?.resolvedDate || claimResolution?.resolvedDate;

    // Differenz (Ist - Soll)
    const differenz = Math.round((bankIst - bankSollRegulaer) * 100) / 100;

    let status: 'ok' | 'anomaly' | 'claim' | 'forecast' = 'ok';
    let statusBadge = '✅ Exakt';
    let offenerAnspruch: number | undefined = undefined;

    if (isResolved) {
      status = 'ok';
      statusBadge = '✅ Beglichen';
    } else if (yearMonth === '2026-10' && override?.bankIst === undefined) {
      status = 'forecast';
      statusBadge = `🔮 Prognose: ${bankSollRegulaer.toFixed(2)} €`;
    } else if (differenz < -0.05) {
      status = 'claim';
      offenerAnspruch = Math.abs(differenz);
      statusBadge = hist?.status === 'claim'
        ? hist.statusBadge
        : `🚨 Abrechnungsfehler (${Math.abs(differenz).toFixed(2)} € offen)`;
    } else if (differenz > 0.05) {
      status = 'anomaly';
      statusBadge = hist?.statusBadge || `⚠️ Differenz (+${differenz.toFixed(2)} €)`;
    } else {
      status = 'ok';
      statusBadge = hist?.statusBadge || '✅ Exakt';
    }

    return {
      yearMonth,
      label: hist?.label || formatMonthLabel(jahr, monat),
      gesamtStunden: statsM.gesamtDezimal,
      sonntagStunden: statsM.sonntagStunden,
      samstagStunden: statsM.samstagBonusStunden,
      nachtStunden: statsM.nachtStunden,
      abgerechnetSonntag: hist?.abgerechnetSonntag,
      abgerechnetSamstag: hist?.abgerechnetSamstag,
      bankIst,
      bankSollRegulaer,
      differenz,
      status,
      statusBadge,
      sonderzahlungText: override?.sonderzahlungText || hist?.sonderzahlungText,
      sonderzahlungBetrag: override?.sonderzahlungBetrag || hist?.sonderzahlungBetrag,
      hrNotiz: hist?.hrNotiz || (differenz < -0.05
        ? `Abrechnungsfehler erkannt: Erhaltene Bank-Auszahlung (${bankIst.toFixed(2)} €) liegt ${Math.abs(differenz).toFixed(2)} € unter dem Anspruch laut 3-Stufen-Versatz (${bankSollRegulaer.toFixed(2)} €).`
        : `Reguläre Auszahlung nach 3-Stufen-Versatz: LA 200 Grundvertrag (${jahr}-${String(monat).padStart(2, '0')}) + LA 208 Mehrstunden (Vormonat) + Zeitzuschläge (Vor-Vormonat) abzgl. 1,81 % VBL.`),
      offenerAnspruch,
      isResolved,
      resolvedDate
    };
  });
}

/**
 * Ermittelt alle offenen und erledigten Nachforderungen dynamisch
 */
export function getDynamicOpenClaims(
  records: ClinicPayrollRecord[],
  resolvedClaims: Record<string, { isResolved: boolean; resolvedDate?: string }> = {}
): OpenClaimItem[] {
  const claims: OpenClaimItem[] = [];

  // 1. Feste Nachforderung: Ausstehende Zeitzuschläge Sep–Dez 2025 (181,14 €)
  const zuschlaege2025Resolution = resolvedClaims['claim_2025_zuschlaege'];
  claims.push({
    id: 'claim_2025_zuschlaege',
    titel: 'Ausstehende Zeitzuschläge Sep–Dez 2025',
    zeitraum: 'September 2025 – Dezember 2025',
    betragNetto: 181.14,
    kategorie: 'anomalie_2025',
    isResolved: Boolean(zuschlaege2025Resolution?.isResolved),
    resolvedDate: zuschlaege2025Resolution?.resolvedDate,
    kurzBeschreibung: 'Zeitzuschläge für 4 Monate wurden vom Klinikum noch nicht ausgezahlt.',
    details: [
      '38,25 Std. Sonntagszuschlag (LA 362) à 4,67 € = 178,63 € (steuer- und VBL-frei)',
      '3,92 Std. Samstagszuschlag (LA 332) à 0,64 € = 2,51 € (abzgl. 1,81 % VBL = 2,46 € netto)',
      'Betrifft: Sep (9,0h So, 0,17h Sa), Okt (3,25h So, 3,75h Sa), Nov (12,0h So), Dez (14,0h So)',
      'Gesamtforderung 2025: 181,14 € netto'
    ]
  });

  // 2. Dynamisch erkannte Abrechnungsfehler aus den Monatsdatensätzen
  for (const r of records) {
    if (r.yearMonth === '2026-09') {
      const sepResolution = resolvedClaims['claim_2026_09_abrechnungsfehler'] || resolvedClaims['2026-09'];
      const isResolved = Boolean(r.isResolved || sepResolution?.isResolved);
      const diffBetrag = Math.abs(r.differenz) > 0.05 ? Math.abs(r.differenz) : 317.98;
      claims.push({
        id: 'claim_2026_09_abrechnungsfehler',
        yearMonth: '2026-09',
        titel: 'Abrechnungsfehler Personalabteilung September 2026',
        zeitraum: 'Abrechnungsmonat September 2026',
        betragNetto: diffBetrag,
        kategorie: 'nachforderung_2026',
        isResolved,
        resolvedDate: r.resolvedDate || sepResolution?.resolvedDate,
        kurzBeschreibung: 'Gravierender HR-Berechnungsfehler: Netto-Nachforderungsanspruch von 317,98 €.',
        details: [
          'Fehler 1: Sozialversicherungstage (SV-Tage) fälschlicherweise auf 0 gesetzt',
          'Fehler 2: August-Grundvergütung (-94,51 €) und August-Zuschlag (-64,80 €) unberechtigt storniert/abgezogen',
          'Fehler 3: Regulärer September-Grundlohn (5,00 Std. LA 200 = 94,51 €) gar nicht vergütet (0,00 €)',
          'Fehler 4: August-Mehrstunden (24,33 Std.) nur mit 17,64 € statt 18,90 € (Stufe 2 ab 01.08.2026) abgerechnet (-30,66 €)',
          `Tatsächliche Überweisung Bank 09/26: ${r.bankIst.toFixed(2)} € (Soll wäre ${r.bankSollRegulaer.toFixed(2)} €)`,
          `Netto-Differenz / Nachforderungsanspruch: ${diffBetrag.toFixed(2)} € netto`
        ]
      });
    } else if (r.status === 'claim' || (r.differenz < -0.05 && r.yearMonth !== '2025-10')) {
      const claimId = `claim_${r.yearMonth}`;
      const res = resolvedClaims[claimId] || resolvedClaims[r.yearMonth];
      const isResolved = Boolean(r.isResolved || res?.isResolved);
      const diffBetrag = Math.abs(r.differenz);
      claims.push({
        id: claimId,
        yearMonth: r.yearMonth,
        titel: `Abrechnungsdifferenz ${r.label}`,
        zeitraum: `Abrechnungsmonat ${r.label}`,
        betragNetto: diffBetrag,
        kategorie: 'dynamisch',
        isResolved,
        resolvedDate: r.resolvedDate || res?.resolvedDate,
        kurzBeschreibung: `Tatsächliche Überweisung (${r.bankIst.toFixed(2)} €) liegt unter dem Soll-Anspruch (${r.bankSollRegulaer.toFixed(2)} €).`,
        details: [
          `Geleistete Arbeitszeit: ${r.gesamtStunden.toFixed(2)} Stunden im Leistungsmonat`,
          `Tatsächlich überwiesen: ${r.bankIst.toFixed(2)} € (Ist-Zahlung)`,
          `Regulär fälliger Nettoanspruch (3-Stufen-Versatz): ${r.bankSollRegulaer.toFixed(2)} € (Soll)`,
          `Offener Netto-Differenzbetrag: ${diffBetrag.toFixed(2)} € Netto`
        ]
      });
    }
  }

  return claims;
}

/**
 * Berechnet die Summe aller aktuell offenen (unbeglichenen) Nachforderungen
 */
export function getTotalOpenClaimsNetto(claims: OpenClaimItem[]): number {
  return Math.round(
    claims
      .filter(c => !c.isResolved)
      .reduce((sum, c) => sum + c.betragNetto, 0) * 100
  ) / 100;
}

/**
 * Erstellt den offiziellen Klärungstext für die Personalabteilung (Klinikum Minden)
 * Vollständig dynamisch für beliebige Mitarbeiter und aktive Nachforderungen
 */
export function generateHrClaimEmailText(
  profile: { name: string; vorname: string; personalnummer: string; abteilung?: string; klinik?: string },
  claims?: OpenClaimItem[]
): { subject: string; body: string } {
  const pName = profile.name || 'Mustermann';
  const pVorname = profile.vorname || 'Max';
  const pNr = profile.personalnummer || '123456';
  const pAbt = profile.abteilung || 'Radiologie & Nuklearmedizin';
  const pKlinik = profile.klinik || 'Universitätsklinikum';

  // Falls claims übergeben wurden, berücksichtige nur unbeglichene
  const activeClaims = claims
    ? claims.filter(c => !c.isResolved)
    : [
        {
          titel: 'Fehlerhafte Abrechnung September 2026',
          betragNetto: 317.98,
          details: [
            'Die Sozialversicherungstage wurden fälschlicherweise auf 0 gesetzt.',
            'Die reguläre Grundvergütung für September (LA 200, 5,00 Std. à 18,90 € = 94,51 €) wurde nicht vergütet (0,00 €).',
            'Zudem wurden die Grundvergütung für August (-94,51 €) sowie die Zeitzuschläge für August (-64,80 €) rückwirkend storniert/abgezogen.',
            'Die Aushilfsstunden für August (24,33 Std.) wurden fälschlich mit dem alten Satz von 17,64 € statt mit der ab dem 01.08.2026 wirksamen Stufe 2 (18,90 €) berechnet (-30,66 € Differenz).',
            'Tatsächliche Überweisung Bank 09/2026: 263,81 € | Regulärer Anspruch: 581,79 €'
          ]
        },
        {
          titel: 'Ausstehende Zeitzuschläge September bis Dezember 2025',
          betragNetto: 181.14,
          details: [
            'Sonntagsstunden (LA 362): 38,25 Std. à 4,67 € = 178,63 € (steuer- und VBL-frei)',
            'Samstagsstunden 13–21 Uhr (LA 332): 3,92 Std. à 0,64 € = 2,51 € (abzgl. 1,81 % VBL = 2,46 €)'
          ]
        }
      ];

  const totalSum = Math.round(activeClaims.reduce((acc, c) => acc + c.betragNetto, 0) * 100) / 100;

  if (activeClaims.length === 0) {
    return {
      subject: `Abrechnungsprüfung Minijob Radiologie – Personal-Nr. ${pNr} (${pVorname} ${pName})`,
      body: `Sehr geehrte Damen und Herren der Personalabteilung,

ich möchte Ihnen mitteilen, dass bezüglich meiner Entgeltabrechnungen als studentische Hilfskraft im Institut für Radiologie (Personalnummer: ${pNr}) aktuell alle bisherigen Nachforderungen und Auszahlungen vollständig beglichen und geklärt sind.

Vielen Dank für Ihre freundliche Unterstützung.

Mit freundlichen Grüßen,
${pVorname} ${pName}
Personalnummer: ${pNr}
${pAbt}
${pKlinik}`
    };
  }

  const subject = `Dringende Klärung Abrechnung / Nachberechnung Minijob Radiologie – Personal-Nr. ${pNr} (${pVorname} ${pName})`;

  const sections = activeClaims.map((claim, idx) => {
    const detailLines = claim.details.map(d => `• ${d}`).join('\n');
    return `================================================================================
${idx + 1}. ${claim.titel.toUpperCase()} (OFFENER ANSPRUCH: ${claim.betragNetto.toFixed(2)} € NETTO)
================================================================================
${detailLines}
-> Offener Nachforderungsanspruch: ${claim.betragNetto.toFixed(2)} € NETTO`;
  }).join('\n\n');

  const body = `Sehr geehrte Damen und Herren der Personalabteilung,

ich wende mich an Sie bezüglich meiner Entgeltabrechnungen als studentische Hilfskraft im Institut für Radiologie (Personalnummer: ${pNr}). Bei der detaillierten Prüfung meiner Abrechnungen nach TVöD-K EG 03 (5,00 Std./Monat Grundvertrag, PGS 6500) sind folgende Nachforderungsansprüche offen:

${sections}

================================================================================
GESAMTER OFFENER NACHZAHLUNGSBETRAG: ${totalSum.toFixed(2)} € NETTO
================================================================================

Ich bitte Sie höflich, diese Punkte zu prüfen und die Korrekturen mit der kommenden Abrechnung zur Auszahlung zu veranlassen.

Für Rückfragen stehe ich Ihnen jederzeit gerne zur Verfügung.

Mit freundlichen Grüßen,
${pVorname} ${pName}
Personalnummer: ${pNr}
${pAbt}
${pKlinik}`;

  return { subject, body };
}

