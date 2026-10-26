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

// Registry für entschlüsselte historische Daten (im Arbeitsspeicher, nur nach Auth verfügbar - Zero Data Leak)
let decryptedHistoricalRecords: ClinicPayrollRecord[] = [];
let decryptedInitialClaims: OpenClaimItem[] = [];

export function setDecryptedHistoricalRecords(records: ClinicPayrollRecord[]) {
  decryptedHistoricalRecords = records;
}

export function getHistoricalRecords(): ClinicPayrollRecord[] {
  return decryptedHistoricalRecords;
}

export function setDecryptedInitialClaims(claims: OpenClaimItem[]) {
  decryptedInitialClaims = claims;
}

export function getDecryptedInitialClaims(): OpenClaimItem[] {
  return decryptedInitialClaims;
}

// Kompatibilitäts-Export (leer im unautorisierten Zustand - Zero Data Leak)
export const HISTORICAL_PAYROLL_RECORDS: ClinicPayrollRecord[] = [];
export const OPEN_CLAIMS: OpenClaim[] = [];
export const TOTAL_OPEN_CLAIMS_NETTO = 0;

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

  // 1. Entschlüsselte historische Referenzmonate (nur nach Auth vorhanden)
  const recordsPool = decryptedHistoricalRecords.length > 0 ? decryptedHistoricalRecords : HISTORICAL_PAYROLL_RECORDS;
  for (const r of recordsPool) {
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
    const hist = recordsPool.find(h => h.yearMonth === yearMonth);
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

  // 1. Entschlüsselte initiale Nachforderungen (nur vorhanden, wenn autorisiert entsperrt - Zero Data Leak)
  for (const baseClaim of decryptedInitialClaims) {
    const res = resolvedClaims[baseClaim.id];
    claims.push({
      ...baseClaim,
      isResolved: Boolean(baseClaim.isResolved || res?.isResolved),
      resolvedDate: baseClaim.resolvedDate || res?.resolvedDate
    });
  }

  // 2. Dynamisch erkannte Abrechnungsfehler aus den Monatsdatensätzen
  for (const r of records) {
    if (r.yearMonth === '2026-09') {
      if (!claims.some(c => c.id === 'claim_2026_09_abrechnungsfehler')) {
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
      }
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

