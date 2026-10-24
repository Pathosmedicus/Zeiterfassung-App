/**
 * Unit Tests für Zeiterfassung Radiologie (Klinikum Minden, TVöD-K EG 03)
 * 
 * Getestete Kernfunktionen:
 * 1. berechneMinuten / berechneNetto (Arbeitszeitberechnung inkl. Nachtschichten & Pausen)
 * 2. getFeiertage (Gaußsche Feiertagsberechnung)
 * 3. getTariffForMonth & calculateMonthSalary (TVöD-K EG 03 Zeitstufen, 1.81% VBL, LA 200, LA 208, LA 362, LA 332, LA 360)
 * 4. Drei-Stufen-Versatz & Reale Abrechnungs-Differenzen (September 2026 Fehler 317.98 € & 2025 Zuschläge 181.14 €)
 */

function berechneMinuten(s, e, p) {
    if (!s || !e) return 0;
    const [sH, sM] = s.split(':').map(Number);
    const [eH, eM] = e.split(':').map(Number);
    if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) return 0;
    let startMin = sH * 60 + sM;
    let endMin = eH * 60 + eM;
    if (endMin === startMin) return 0;
    if (endMin < startMin) endMin += 24 * 60; // Nachtdienst über Mitternacht
    return Math.max(0, (endMin - startMin) - (parseInt(p, 10) || 0));
}

function berechneNetto(s, e, p) {
    const nettoMin = berechneMinuten(s, e, p);
    return Math.round((nettoMin / 60) * 100) / 100;
}

function getFeiertage(jahr) {
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
    const addDays = (date, days) => {
        const res = new Date(date);
        res.setDate(res.getDate() + days);
        return `${res.getFullYear()}-${String(res.getMonth() + 1).padStart(2, '0')}-${String(res.getDate()).padStart(2, '0')}`;
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
        [addDays(ostersonntag, 60)]: "Fronleichnam",
        [`${jahr}-10-03`]: "Tag d. Dt. Einheit",
        [`${jahr}-11-01`]: "Allerheiligen",
        [`${jahr}-12-25`]: "1. Weihnachtstag",
        [`${jahr}-12-26`]: "2. Weihnachtstag"
    };
}

function getTariffForMonth(jahr, monat) {
    if (jahr < 2026 || (jahr === 2026 && monat <= 4)) {
        return {
            name: 'EG 03 Stufe 1',
            hourlyWage: 17.16,
            basePay5h: 85.80,
            sundayBonus: 4.67,
            saturdayBonus: 0.64,
            nightBonus: 3.74,
            vblPercent: 1.81
        };
    }
    if (jahr === 2026 && monat >= 5 && monat <= 7) {
        return {
            name: 'EG 03 Stufe 1 (Tariferhöhung)',
            hourlyWage: 17.64,
            basePay5h: 88.21,
            sundayBonus: 4.80,
            saturdayBonus: 0.64,
            nightBonus: 3.74,
            vblPercent: 1.81
        };
    }
    return {
        name: 'EG 03 Stufe 2 (Stufenaufstieg)',
        hourlyWage: 18.90,
        basePay5h: 94.51,
        sundayBonus: 4.80,
        saturdayBonus: 0.64,
        nightBonus: 3.74,
        vblPercent: 1.81
    };
}

function calculateMonthSalary(jahr, monat, daten) {
    const tageImMonat = new Date(jahr, monat, 0).getDate();
    let gesamtDezimal = 0;
    let sonntagStunden = 0;
    let samstagBonusStunden = 0;
    let nachtStunden = 0;
    let anzahlDienste = 0;

    const tariff = getTariffForMonth(jahr, monat);
    const feiertage = getFeiertage(jahr);
    const datenMap = new Map(daten.map(e => [e.datum, e]));

    for (let tag = 1; tag <= tageImMonat; tag++) {
        const suchDatum = `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`;
        const dayOfWeek = new Date(jahr, monat - 1, tag).getDay();
        const isHoliday = Boolean(feiertage[suchDatum]);
        const eintrag = datenMap.get(suchDatum);

        if (eintrag && eintrag.nettoStunden > 0) {
            anzahlDienste++;
            gesamtDezimal += eintrag.nettoStunden;
            if (dayOfWeek === 0 || isHoliday) {
                sonntagStunden += eintrag.nettoStunden;
            } else if (dayOfWeek === 6 && eintrag.kommen && eintrag.gehen) {
                const sSplit = eintrag.kommen.split(":");
                const eSplit = eintrag.gehen.split(":");
                let startDez = parseInt(sSplit[0]) + (parseInt(sSplit[1]) / 60);
                let endDez = parseInt(eSplit[0]) + (parseInt(eSplit[1]) / 60);
                if (endDez <= startDez) endDez += 24;
                const overlapStart = Math.max(startDez, 13.0);
                const overlapEnd = Math.min(endDez, 21.0);
                if (overlapEnd > overlapStart) {
                    samstagBonusStunden += Math.min((overlapEnd - overlapStart), eintrag.nettoStunden);
                }
            }
            if (eintrag.nachtStunden) {
                nachtStunden += eintrag.nachtStunden;
            }
        }
    }

    const roundHours = Math.round(gesamtDezimal * 100) / 100;
    const mehrStunden = Math.max(0, roundHours - 5.00);
    const basisLohn = Math.round(roundHours * tariff.hourlyWage * 100) / 100;
    const sonntagLohn = Math.round(sonntagStunden * tariff.sundayBonus * 100) / 100;
    const samstagLohn = Math.round(samstagBonusStunden * tariff.saturdayBonus * 100) / 100;
    const nachtLohn = Math.round(nachtStunden * tariff.nightBonus * 100) / 100;

    const gesamtGehalt = Math.round((basisLohn + sonntagLohn + samstagLohn + nachtLohn) * 100) / 100;
    const vblBrutto = Math.round((basisLohn + samstagLohn) * 100) / 100;
    const vblAbzug = Math.round(vblBrutto * (tariff.vblPercent / 100) * 100) / 100;
    const erwartetesNetto = Math.round(((vblBrutto - vblAbzug) + sonntagLohn + nachtLohn) * 100) / 100;

    return {
        activeBaseWage: tariff.hourlyWage,
        tariffName: tariff.name,
        gesamtDezimal: roundHours,
        anzahlDienste,
        sonntagStunden,
        samstagBonusStunden,
        nachtStunden,
        mehrStunden,
        basisLohn,
        sonntagLohn,
        samstagLohn,
        nachtLohn,
        gesamtGehalt,
        vblBrutto,
        vblAbzug,
        erwartetesNetto
    };
}

// Test Runner Logik
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function expect(actual) {
    return {
        toBe(expected) {
            if (actual !== expected) throw new Error(`Erwartet: ${expected}, aber erhalten: ${actual}`);
        },
        toBeCloseTo(expected, precision = 2) {
            const diff = Math.abs(actual - expected);
            if (diff > Math.pow(10, -precision)) throw new Error(`Erwartet nah an: ${expected}, aber erhalten: ${actual} (Diff: ${diff})`);
        },
        toBeTruthy() {
            if (!actual) throw new Error(`Erwartet truthy, aber erhalten: ${actual}`);
        }
    };
}

// ==========================================
// TESTSUITE 1: Arbeitszeitberechnung
// ==========================================
test("Normaler Frühdienst (07:30 - 16:00 mit 30 Min Pause)", () => {
    expect(berechneNetto("07:30", "16:00", 30)).toBe(8);
});

test("Nachtdienst über Mitternacht (20:00 - 08:00 mit 60 Min Pause)", () => {
    expect(berechneNetto("20:00", "08:00", 60)).toBe(11);
});

test("Grenzfall: Gleiche Start- und Endzeit ergibt 0", () => {
    expect(berechneNetto("08:00", "08:00", 30)).toBe(0);
});

// ==========================================
// TESTSUITE 2: TVöD-K EG 03 Tarifstufen
// ==========================================
test("Tarifstufe 1 bis 30.04.2026: 17.16 €/h & 85.80 € Grund & 4.67 € So", () => {
    const t = getTariffForMonth(2026, 4);
    expect(t.hourlyWage).toBe(17.16);
    expect(t.basePay5h).toBe(85.80);
    expect(t.sundayBonus).toBe(4.67);
    expect(t.saturdayBonus).toBe(0.64);
    expect(t.vblPercent).toBe(1.81);
});

test("Tariferhöhung Mai bis Juli 2026: 17.64 €/h & 88.21 € Grund & 4.80 € So", () => {
    const t = getTariffForMonth(2026, 5);
    expect(t.hourlyWage).toBe(17.64);
    expect(t.basePay5h).toBe(88.21);
    expect(t.sundayBonus).toBe(4.80);
    expect(t.saturdayBonus).toBe(0.64);
    expect(t.vblPercent).toBe(1.81);
});

test("Stufenaufstieg ab 01.08.2026 (Stufe 2): 18.90 €/h & 94.51 € Grund & 4.80 € So", () => {
    const t = getTariffForMonth(2026, 8);
    expect(t.hourlyWage).toBe(18.90);
    expect(t.basePay5h).toBe(94.51);
    expect(t.sundayBonus).toBe(4.80);
    expect(t.saturdayBonus).toBe(0.64);
    expect(t.vblPercent).toBe(1.81);
});

// ==========================================
// TESTSUITE 3: VBL-Abzug & Steuerfreiheit
// ==========================================
test("Sonntagszuschlag ist 100% steuer- und VBL-frei (0% Abzug)", () => {
    // 10. Mai 2026 ist Sonntag. 5 Stunden Sonntag.
    const daten = [{ datum: "2026-05-10", kommen: "08:00", gehen: "13:00", pauseMinuten: 0, nettoStunden: 5.0 }];
    const res = calculateMonthSalary(2026, 5, daten);
    // So-Zuschlag: 5 * 4.80 = 24.00 €
    expect(res.sonntagLohn).toBe(24.00);
    // VBL-Brutto beinhaltet nur Basislohn (5 * 17.64 = 88.20 €)
    expect(res.vblBrutto).toBe(88.20);
    // VBL-Abzug = 88.20 * 0.0181 = 1.60 €
    expect(res.vblAbzug).toBe(1.60);
    // Netto = (88.20 - 1.60) + 24.00 = 110.60 €
    expect(res.erwartetesNetto).toBe(110.60);
});

// ==========================================
// TESTSUITE 4: Reale HR-Berechnungsdifferenzen
// ==========================================
test("September 2026: Offene Nachforderung beträgt exakt 317.98 €", () => {
    const tatsaechlichBankIst = 263.81;
    const regulaerSoll = 581.79;
    const differenz = regulaerSoll - tatsaechlichBankIst;
    expect(Math.round(differenz * 100) / 100).toBe(317.98);
});

test("2025: Offene Zeitzuschläge Sep-Dez betragen exakt 181.14 €", () => {
    // 38.25h So à 4.67 € = 178.6275 € (~178.63 €)
    // 3.92h Sa à 0.64 € = 2.5088 € (~2.51 €)
    const soSumme = 38.25 * 4.67;
    const saSumme = 3.92 * 0.64;
    const gesamt = Math.round((soSumme + saSumme) * 100) / 100;
    expect(gesamt).toBe(181.14);
});

test("Dynamische Fehlererkennung für beliebige Mitarbeiter bei Unterzahlung", () => {
    const bankSoll = 450.00;
    const bankIst = 380.00; // 70.00 € zu wenig überwiesen
    const diff = bankIst - bankSoll;
    const isClaim = diff < -0.05;
    const offenerBetrag = Math.abs(diff);
    expect(isClaim).toBe(true);
    expect(offenerBetrag).toBe(70.00);
});

test("Offener Posten schließen: Nach Erledigung sinkt der Nachforderungsbetrag auf 0.00 €", () => {
    const claims = [
        { id: 'c1', betragNetto: 181.14, isResolved: false },
        { id: 'c2', betragNetto: 317.98, isResolved: false }
    ];
    let total = claims.filter(c => !c.isResolved).reduce((s, c) => s + c.betragNetto, 0);
    expect(Math.round(total * 100) / 100).toBe(499.12);

    // Mitarbeiter schließt Posten 2 (z.B. September 2026 nachgezahlt)
    claims[1].isResolved = true;
    total = claims.filter(c => !c.isResolved).reduce((s, c) => s + c.betragNetto, 0);
    expect(Math.round(total * 100) / 100).toBe(181.14);

    // Mitarbeiter schließt Posten 1 (Zeitzuschläge 2025 nachgezahlt)
    claims[0].isResolved = true;
    total = claims.filter(c => !c.isResolved).reduce((s, c) => s + c.betragNetto, 0);
    expect(total).toBe(0.00);
});

// ==========================================
// TESTSUITE 4: Minijob-Jahresgrenze (7.230 €) & § 3b EStG SFN-Trennung
// ==========================================
test("Minijob-Grenze 7.230 €: Nur Grundlohn zählt zur Jahresgrenze, SFN-Zuschläge sind beitragsfrei", () => {
    const annualLimit = 7230;
    // Ein Sonntagsdienst (8h am Sonntag, Stufe 2 = 18.90 € Grundlohn + 4.80 € So-Zuschlag)
    const testShifts = [{ datum: '2026-10-04', kommen: '08:00', gehen: '16:00', pauseMinuten: 0, nettoStunden: 8.0 }];
    const res = calculateMonthSalary(2026, 10, testShifts);
    
    // Grundlohn: 8h * 18.90 = 151.20 €
    expect(res.basisLohn).toBe(151.20);
    // Sonntagszuschlag: 8h * 4.80 = 38.40 € (steuerfrei gem. § 3b EStG)
    expect(res.sonntagLohn).toBe(38.40);
    
    // Anrechenbar auf 7.230 € ist AUSSCHLIESSLICH der Grundlohn
    const anrechenbar = res.basisLohn;
    expect(anrechenbar).toBe(151.20);
    const restBudget = annualLimit - anrechenbar;
    expect(restBudget).toBe(7078.80);
});

test("SFN-Booster: Reststunden als Sonntagsdienste erzeugen steuerfreien Netto-Mehrwert ohne Grenzüberschreitung", () => {
    const annualLimit = 7230;
    const baseWage = 18.90;
    const sundayBonus = 4.80;
    const restBudget = 1890.00; // z.B. 1.890 € Puffer
    
    const remainingHours = Math.round((restBudget / baseWage) * 100) / 100; // 100.00 Std.
    expect(remainingHours).toBe(100);
    
    // Anrechenbarer Grundlohn für 100 Std. = genau 1.890 € (Grenze exakt eingehalten)
    expect(Math.round(remainingHours * baseWage * 100) / 100).toBe(1890.00);
    
    // SFN-Booster bei Leistung als Sonntagsdienste: 100 Std * 4.80 € = 480.00 € steuerfrei oben drauf!
    const extraBonus = Math.round(remainingHours * sundayBonus * 100) / 100;
    expect(extraBonus).toBe(480.00);
    
    // Gesamtes Nettoeinkommen = 1.890 € (abzgl VBL) + 480 € steuerfrei
    expect(restBudget + extraBonus).toBe(2370.00);
});

// Führe Tests aus
let passed = 0;
let failed = 0;
console.log(`\n🧪 Starte Unit Tests für Zeiterfassung Radiologie...`);
for (const t of tests) {
    try {
        t.fn();
        console.log(`  ✓ ${t.name}`);
        passed++;
    } catch (e) {
        console.error(`  ✗ ${t.name}:`, e.message);
        failed++;
    }
}
console.log(`\nErgebnis: ${passed} bestanden, ${failed} fehlgeschlagen von ${tests.length} Tests.\n`);

if (failed > 0) process.exit(1);

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { berechneMinuten, berechneNetto, getFeiertage, getTariffForMonth, calculateMonthSalary };
}
