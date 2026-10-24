import { jsPDF } from 'jspdf';
import { ShiftEntry, UserProfile } from '../types';
import { berechneMinuten } from './salaryEngine';

const MONATSNAMEN = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

/**
 * Erzeugt das offizielle Stundenzettel-PDF als gestochen scharfe Vektorgrafik.
 * Exakte 1:1 Nachbildung des Formulars der Mühlenkreiskliniken Minden.
 */
export function generateTimesheetPDF(
  jahr: number,
  monat: number,
  shifts: ShiftEntry[],
  userProfile: UserProfile
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const tageImMonat = new Date(jahr, monat, 0).getDate();
  const shiftMap = new Map(shifts.map(s => [s.datum, s]));

  const marginL = 15;
  let curY = 14;

  // Header: Name, Personalnummer & Abteilung
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  doc.text("Name:", marginL, curY);
  doc.setFont("helvetica", "bold");
  const fullName = `${userProfile.vorname} ${userProfile.name}`.trim() || " ";
  doc.text(fullName, marginL + 35, curY);
  const nameW = doc.getTextWidth(fullName);
  if (fullName.trim()) {
    doc.setLineWidth(0.2);
    doc.line(marginL + 35, curY + 0.8, marginL + 35 + Math.max(nameW, 50), curY + 0.8);
  }

  curY += 6;
  doc.setFont("helvetica", "normal");
  doc.text("Personalnummer:", marginL, curY);
  doc.setFont("helvetica", "bold");
  const pNrText = userProfile.personalnummer || " ";
  doc.text(pNrText, marginL + 35, curY);
  const nrW = doc.getTextWidth(pNrText);
  if (pNrText.trim()) {
    doc.line(marginL + 35, curY + 0.8, marginL + 35 + Math.max(nrW, 35), curY + 0.8);
  }

  // Zusätzliche Klinik-/Abteilungszeile falls vorhanden
  if (userProfile.abteilung) {
    curY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    const abtText = `${userProfile.abteilung} • ${userProfile.klinik}`;
    doc.text(abtText, marginL, curY);
    doc.setTextColor(0, 0, 0);
  }

  curY += 5;

  // Spaltenbreiten (Summe = 180mm auf 210mm A4-Breite)
  // [Datum, Von, Kommen, Bis, Gehen, Pause, Geleistete Std, Std in Zahl]
  const colW = [22, 11, 22, 11, 22, 24, 36, 32];
  const totalW = colW.reduce((a, b) => a + b, 0);
  const colX: number[] = [];
  let accX = marginL;
  for (const w of colW) {
    colX.push(accX);
    accX += w;
  }

  // Titelzeile: "Stundenübersichtstabelle"
  const titleH = 8.5;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.rect(marginL, curY, totalW, titleH, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Stundenübersichtstabelle", marginL + totalW / 2, curY + 6.0, { align: "center" });
  curY += titleH;

  // Header-Zeile
  const headH = 6.2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const headers = ["", "", "", "", "", "Pause", "Geleistete Stunden", "Stunden in Zahl"];
  for (let c = 0; c < 8; c++) {
    doc.rect(colX[c], curY, colW[c], headH);
    if (headers[c]) {
      doc.text(headers[c], colX[c] + colW[c] / 2, curY + 4.3, { align: "center" });
    }
  }
  curY += headH;

  // Tageszeilen
  const rowH = 5.7;
  const bodyStartY = curY;
  let summeMinuten = 0;
  let summeDezimal = 0;

  for (let tag = 1; tag <= tageImMonat; tag++) {
    const tagStr = String(tag).padStart(2, '0');
    const monatStr = String(monat).padStart(2, '0');
    const jahrKurz = String(jahr).slice(-2);
    const anzeigeDatum = `${tagStr}.${monatStr}.${jahrKurz}`;
    const suchDatum = `${jahr}-${monatStr}-${tagStr}`;
    const eintrag = shiftMap.get(suchDatum);

    let netM = 0;
    let arbeitszeitHHMM = "0:00";
    let dezimalStr = "0,00";
    let pauseHHMM = "";

    if (eintrag && (eintrag.kommen || eintrag.nettoStunden > 0)) {
      netM = berechneMinuten(eintrag.kommen, eintrag.gehen, eintrag.pauseMinuten);
      summeMinuten += netM;
      summeDezimal += eintrag.nettoStunden;
      const std = Math.floor(netM / 60);
      const min = netM % 60;
      arbeitszeitHHMM = `${std}:${String(min).padStart(2, '0')}`;
      dezimalStr = eintrag.nettoStunden.toFixed(2).replace('.', ',');

      if (eintrag.pauseMinuten > 0) {
        const pStd = Math.floor(eintrag.pauseMinuten / 60);
        const pMin = eintrag.pauseMinuten % 60;
        pauseHHMM = `${String(pStd).padStart(2, '0')}:${String(pMin).padStart(2, '0')}`;
      }
    }

    // Spalte 0: Datum
    doc.setFillColor(255, 255, 255);
    doc.rect(colX[0], curY, colW[0], rowH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(anzeigeDatum, colX[0] + colW[0] / 2, curY + 4.0, { align: "center" });

    // Spalte 2: Kommen
    if (eintrag && eintrag.kommen) {
      doc.setFillColor(146, 208, 80); // #92D050 Klinik-Grün
      doc.rect(colX[2], curY, colW[2], rowH, "FD");
      doc.setFont("helvetica", "bold");
      doc.text(eintrag.kommen, colX[2] + colW[2] / 2, curY + 4.0, { align: "center" });
    } else {
      doc.rect(colX[2], curY, colW[2], rowH);
    }

    // Spalte 4: Gehen
    if (eintrag && eintrag.gehen) {
      doc.setFillColor(146, 208, 80);
      doc.rect(colX[4], curY, colW[4], rowH, "FD");
      doc.setFont("helvetica", "bold");
      doc.text(eintrag.gehen, colX[4] + colW[4] / 2, curY + 4.0, { align: "center" });
    } else {
      doc.rect(colX[4], curY, colW[4], rowH);
    }

    // Spalte 5: Pause
    if (eintrag && eintrag.pauseMinuten > 0) {
      doc.setFillColor(239, 68, 68); // #EF4444 Rot
      doc.rect(colX[5], curY, colW[5], rowH, "FD");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(pauseHHMM, colX[5] + colW[5] / 2, curY + 4.0, { align: "center" });
      doc.setTextColor(0, 0, 0);
    } else {
      doc.rect(colX[5], curY, colW[5], rowH);
    }

    // Spalte 6: Geleistete Stunden
    if (eintrag && eintrag.nettoStunden > 0) {
      doc.setFillColor(146, 208, 80);
      doc.rect(colX[6], curY, colW[6], rowH, "FD");
      doc.setFont("helvetica", "bold");
    } else {
      doc.rect(colX[6], curY, colW[6], rowH);
      doc.setFont("helvetica", "normal");
    }
    doc.text(arbeitszeitHHMM, colX[6] + colW[6] / 2, curY + 4.0, { align: "center" });

    // Spalte 7: Stunden in Zahl
    if (eintrag && eintrag.nettoStunden > 0) {
      doc.setFillColor(146, 208, 80);
      doc.rect(colX[7], curY, colW[7], rowH, "FD");
      doc.setFont("helvetica", "bold");
    } else {
      doc.rect(colX[7], curY, colW[7], rowH);
      doc.setFont("helvetica", "normal");
    }
    doc.text(dezimalStr, colX[7] + colW[7] / 2, curY + 4.0, { align: "center" });

    curY += rowH;
  }

  // Durchgehende Spalten "Von" (Spalte 1) und "Bis" (Spalte 3)
  const totalBodyH = tageImMonat * rowH;
  doc.setFillColor(255, 255, 255);
  doc.rect(colX[1], bodyStartY, colW[1], totalBodyH, "FD");
  doc.rect(colX[3], bodyStartY, colW[3], totalBodyH, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text("Von", colX[1] + colW[1] / 2, bodyStartY + totalBodyH / 2, { align: "center" });
  doc.text("Bis", colX[3] + colW[3] / 2, bodyStartY + totalBodyH / 2, { align: "center" });

  // Schwarzer Trennbalken
  const sepH = 2.4;
  doc.setFillColor(0, 0, 0);
  doc.rect(marginL, curY, totalW, sepH, "FD");
  curY += sepH;

  // Gesamtzeile
  const sumH = 6.8;
  const first6W = colW[0] + colW[1] + colW[2] + colW[3] + colW[4] + colW[5];
  doc.setFillColor(255, 255, 255);
  doc.rect(marginL, curY, first6W, sumH, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Gesamt", marginL + first6W / 2, curY + 4.7, { align: "center" });

  const gesStd = Math.floor(summeMinuten / 60);
  const gesMin = summeMinuten % 60;
  doc.setFillColor(146, 208, 80);
  doc.rect(colX[6], curY, colW[6], sumH, "FD");
  doc.text(`${gesStd}:${String(gesMin).padStart(2, '0')}`, colX[6] + colW[6] / 2, curY + 4.7, { align: "center" });

  doc.setFillColor(146, 208, 80);
  doc.rect(colX[7], curY, colW[7], sumH, "FD");
  doc.text(summeDezimal.toFixed(2).replace('.', ','), colX[7] + colW[7] / 2, curY + 4.7, { align: "center" });
  curY += sumH;

  // Unterschriftsfeld
  curY += 14;
  doc.setLineWidth(0.3);
  doc.line(marginL, curY, marginL + 65, curY);
  doc.line(marginL + 95, curY, marginL + totalW, curY);

  curY += 4.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Datum und Ort", marginL, curY);
  doc.text("Unterschrift", marginL + 95, curY);

  return doc;
}

export function downloadTimesheetPDF(
  jahr: number,
  monat: number,
  shifts: ShiftEntry[],
  userProfile: UserProfile
): string {
  const doc = generateTimesheetPDF(jahr, monat, shifts, userProfile);
  const monatName = MONATSNAMEN[monat - 1];
  const filename = `Stundenuebersicht_${monatName}_${jahr}.pdf`;
  doc.save(filename);
  return filename;
}
