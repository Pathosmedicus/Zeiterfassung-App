import ExcelJS from 'exceljs';
import { ShiftEntry, UserProfile, SalaryConfig } from '../types';
import { berechneMinuten, calculateMonthSalary } from './salaryEngine';

/**
 * Exportiert den offiziellen Monatsstundenzettel als Excel-Datei (.xlsx).
 * Exakte Nachbildung des Klinikformats mit grünen (#92D050) & roten Pausen-Zellen.
 */
export async function exportTimesheetExcel(
  jahr: number,
  monat: number,
  shifts: ShiftEntry[],
  userProfile: UserProfile
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Stundenübersichtstabelle', {
    views: [{ showGridLines: false }]
  });

  sheet.columns = [
    { key: 'A', width: 13 }, // Datum
    { key: 'B', width: 7 },  // Von
    { key: 'C', width: 13 }, // Kommen
    { key: 'D', width: 7 },  // Bis
    { key: 'E', width: 13 }, // Gehen
    { key: 'F', width: 11 }, // Pause
    { key: 'G', width: 19 }, // Geleistete Stunden
    { key: 'H', width: 17 }  // Stunden in Zahl
  ];

  const borderAll: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };

  const greenFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF92D050' }
  };

  const redFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFF0000' }
  };

  // Zeile 1: Name
  sheet.getCell('A1').value = 'Name:';
  sheet.getCell('A1').font = { size: 10, bold: false };
  sheet.getCell('B1').value = `${userProfile.vorname} ${userProfile.name}`.trim();
  sheet.getCell('B1').font = { size: 11, bold: true, underline: true };

  // Zeile 2: Personalnummer
  sheet.getCell('A2').value = 'Personalnummer:';
  sheet.getCell('A2').font = { size: 10, bold: false };
  sheet.getCell('B2').value = userProfile.personalnummer;
  sheet.getCell('B2').font = { size: 11, bold: true, underline: true };

  sheet.addRow([]);

  // Zeile 4: Titel "Stundenübersichtstabelle"
  sheet.mergeCells('A4:H4');
  const titleCell = sheet.getCell('A4');
  titleCell.value = 'Stundenübersichtstabelle';
  titleCell.font = { bold: true, size: 15 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  for (let i = 1; i <= 8; i++) sheet.getRow(4).getCell(i).border = borderAll;

  // Zeile 5: Header
  const headerRow = sheet.addRow(['', '', '', '', '', 'Pause', 'Geleistete Stunden', 'Stunden in Zahl']);
  headerRow.font = { size: 10, bold: true };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  for (let i = 1; i <= 8; i++) headerRow.getCell(i).border = borderAll;

  const tageImMonat = new Date(jahr, monat, 0).getDate();
  const shiftMap = new Map(shifts.map(s => [s.datum, s]));
  let summeMinuten = 0;
  let summeDezimal = 0;

  for (let tag = 1; tag <= tageImMonat; tag++) {
    const tagStr = String(tag).padStart(2, '0');
    const monatStr = String(monat).padStart(2, '0');
    const jahrKurz = String(jahr).slice(-2);
    const anzeigeDatum = `${tagStr}.${monatStr}.${jahrKurz}`;
    const suchDatum = `${jahr}-${monatStr}-${tagStr}`;
    const eintrag = shiftMap.get(suchDatum);

    const row = sheet.addRow([anzeigeDatum, '', '', '', '', '', '0:00', 0]);
    row.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let i = 1; i <= 8; i++) row.getCell(i).border = borderAll;
    row.getCell(8).numFmt = '0.00';

    if (eintrag && (eintrag.kommen || eintrag.nettoStunden > 0)) {
      const nettoM = berechneMinuten(eintrag.kommen, eintrag.gehen, eintrag.pauseMinuten);
      summeMinuten += nettoM;
      summeDezimal += eintrag.nettoStunden;
      const std = Math.floor(nettoM / 60);
      const min = nettoM % 60;

      row.getCell(3).value = eintrag.kommen;
      row.getCell(3).fill = greenFill;
      row.getCell(3).font = { bold: true };

      row.getCell(5).value = eintrag.gehen;
      row.getCell(5).fill = greenFill;
      row.getCell(5).font = { bold: true };

      if (eintrag.pauseMinuten > 0) {
        const pauseStd = Math.floor(eintrag.pauseMinuten / 60);
        const pauseMin = eintrag.pauseMinuten % 60;
        row.getCell(6).value = `${String(pauseStd).padStart(2, '0')}:${String(pauseMin).padStart(2, '0')}`;
        row.getCell(6).fill = redFill;
        row.getCell(6).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      }

      row.getCell(7).value = `${std}:${String(min).padStart(2, '0')}`;
      row.getCell(7).fill = greenFill;
      row.getCell(7).font = { bold: true };

      row.getCell(8).value = eintrag.nettoStunden;
      row.getCell(8).fill = greenFill;
      row.getCell(8).font = { bold: true };
    }
  }

  // Merge Von / Bis Spalten
  const endRow = sheet.lastRow ? sheet.lastRow.number : 5 + tageImMonat;
  sheet.mergeCells(`B6:B${endRow}`);
  sheet.getCell('B6').value = 'Von';
  sheet.getCell('B6').alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells(`D6:D${endRow}`);
  sheet.getCell('D6').value = 'Bis';
  sheet.getCell('D6').alignment = { horizontal: 'center', vertical: 'middle' };

  // Schwarzer Trennbalken
  const blackRow = sheet.addRow(['', '', '', '', '', '', '', '']);
  for (let i = 1; i <= 8; i++) {
    blackRow.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
    blackRow.getCell(i).border = borderAll;
  }

  // Gesamt-Zeile
  const gesStd = Math.floor(summeMinuten / 60);
  const gesMin = summeMinuten % 60;
  const gesamtRow = sheet.addRow([
    'Gesamt', '', '', '', '', '',
    `${gesStd}:${String(gesMin).padStart(2, '0')}`,
    Math.round(summeDezimal * 100) / 100
  ]);

  sheet.mergeCells(`A${gesamtRow.number}:F${gesamtRow.number}`);
  sheet.getCell(`A${gesamtRow.number}`).alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getCell(`A${gesamtRow.number}`).font = { bold: true };
  for (let i = 1; i <= 8; i++) gesamtRow.getCell(i).border = borderAll;

  gesamtRow.getCell(7).fill = greenFill;
  gesamtRow.getCell(7).font = { bold: true };
  gesamtRow.getCell(8).fill = greenFill;
  gesamtRow.getCell(8).font = { bold: true };
  gesamtRow.getCell(8).numFmt = '0.00';

  // Unterschriftenzeilen
  sheet.addRow([]);
  sheet.addRow([]);
  const lineRow = sheet.addRow(['', '', '', '', '', '', '', '']);
  for (let i = 1; i <= 3; i++) lineRow.getCell(i).border = { bottom: { style: 'thin' } };
  for (let i = 5; i <= 8; i++) lineRow.getCell(i).border = { bottom: { style: 'thin' } };

  const textRow = sheet.addRow(['Datum und Ort', '', '', '', 'Unterschrift', '', '', '']);
  textRow.font = { bold: true };
  sheet.mergeCells(`A${textRow.number}:C${textRow.number}`);
  sheet.mergeCells(`E${textRow.number}:H${textRow.number}`);

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer, `Stundenuebersicht_${jahr}_${String(monat).padStart(2, '0')}.xlsx`);
}

/**
 * Exportiert den Jahres-Gehaltsabgleich als Excel-Datei
 */
export async function exportSalaryReportExcel(
  jahr: number,
  shifts: ShiftEntry[],
  salaryConfig: SalaryConfig
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Gehaltsabgleich ${jahr}`, {
    views: [{ showGridLines: true }]
  });

  sheet.columns = [
    { header: 'Monat', key: 'monat', width: 14 },
    { header: 'Stundenlohn (€)', key: 'lohn', width: 16 },
    { header: 'Gesamtstunden', key: 'gesamt', width: 16 },
    { header: 'So/Feiertag (h)', key: 'sonntag', width: 16 },
    { header: 'Samstag (h)', key: 'samstag', width: 16 },
    { header: 'Brutto (€)', key: 'brutto', width: 16 },
    { header: 'VBL Abzug (€)', key: 'vbl', width: 16 },
    { header: 'Erwartetes Netto (€)', key: 'netto', width: 20 }
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

  const monthNames = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];

  let sumHours = 0;
  let sumBrutto = 0;
  let sumVbl = 0;
  let sumNetto = 0;

  for (let m = 1; m <= 12; m++) {
    const stats = calculateMonthSalary(jahr, m, shifts, salaryConfig);
    sumHours += stats.gesamtDezimal;
    sumBrutto += stats.gesamtGehalt;
    sumVbl += stats.vblAbzug;
    sumNetto += stats.erwartetesNetto;

    const row = sheet.addRow({
      monat: `${monthNames[m - 1]} ${jahr}`,
      lohn: stats.activeBaseWage,
      gesamt: stats.gesamtDezimal,
      sonntag: stats.sonntagStunden,
      samstag: stats.samstagBonusStunden,
      brutto: stats.gesamtGehalt,
      vbl: stats.vblAbzug,
      netto: stats.erwartetesNetto
    });

    row.alignment = { horizontal: 'right' };
    row.getCell(1).alignment = { horizontal: 'left' };
    row.getCell(2).numFmt = '#,##0.00 €';
    row.getCell(3).numFmt = '#,##0.00 "h"';
    row.getCell(4).numFmt = '#,##0.00 "h"';
    row.getCell(5).numFmt = '#,##0.00 "h"';
    row.getCell(6).numFmt = '#,##0.00 €';
    row.getCell(7).numFmt = '#,##0.00 €';
    row.getCell(8).numFmt = '#,##0.00 €';
    row.getCell(8).font = { bold: true };
  }

  // Summenzeile
  const totalRow = sheet.addRow({
    monat: 'GESAMT JAHR',
    lohn: '',
    gesamt: Math.round(sumHours * 100) / 100,
    sonntag: '',
    samstag: '',
    brutto: Math.round(sumBrutto * 100) / 100,
    vbl: Math.round(sumVbl * 100) / 100,
    netto: Math.round(sumNetto * 100) / 100
  });

  totalRow.font = { bold: true };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  totalRow.getCell(3).numFmt = '#,##0.00 "h"';
  totalRow.getCell(6).numFmt = '#,##0.00 €';
  totalRow.getCell(7).numFmt = '#,##0.00 €';
  totalRow.getCell(8).numFmt = '#,##0.00 €';

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer, `Gehaltsabgleich_${jahr}_Radiologie.xlsx`);
}

function triggerDownload(buffer: ExcelJS.Buffer, filename: string): void {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
