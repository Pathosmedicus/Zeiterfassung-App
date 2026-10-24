import React, { useState } from 'react';
import { FileText, FileSpreadsheet, Printer, Mail, Download, Sparkles, TrendingUp } from 'lucide-react';
import { ShiftEntry, UserProfile, SalaryConfig } from '../../types';
import { downloadTimesheetPDF } from '../../services/pdfService';
import { exportTimesheetExcel, exportSalaryReportExcel } from '../../services/excelService';

interface ExportActionsProps {
  currentYearMonth: string;
  shifts: ShiftEntry[];
  userProfile: UserProfile;
  salaryConfig: SalaryConfig;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

const MONATSNAMEN = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

export const ExportActions: React.FC<ExportActionsProps> = ({
  currentYearMonth,
  shifts,
  userProfile,
  salaryConfig,
  onShowToast
}) => {
  const [jStr, mStr] = currentYearMonth.split('-');
  const jahr = parseInt(jStr, 10);
  const monat = parseInt(mStr, 10);
  const monatName = MONATSNAMEN[monat - 1];

  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleDownloadPDF = () => {
    try {
      setLoadingAction('pdf');
      const filename = downloadTimesheetPDF(jahr, monat, shifts, userProfile);
      onShowToast(`✅ ${filename} erfolgreich heruntergeladen!`, 'success');
    } catch (err: any) {
      onShowToast(`Fehler beim PDF-Export: ${err?.message}`, 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      setLoadingAction('excel');
      await exportTimesheetExcel(jahr, monat, shifts, userProfile);
      onShowToast('✅ Excel-Stundenzettel heruntergeladen!', 'success');
    } catch (err: any) {
      onShowToast(`Fehler beim Excel-Export: ${err?.message}`, 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDownloadYearReport = async () => {
    try {
      setLoadingAction('year');
      await exportSalaryReportExcel(jahr, shifts, salaryConfig);
      onShowToast(`✅ Jahres-Gehaltsabgleich für ${jahr} heruntergeladen!`, 'success');
    } catch (err: any) {
      onShowToast(`Fehler beim Jahresabgleich: ${err?.message}`, 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  const handleSendEmail = () => {
    try {
      // 1. Zuerst PDF automatisch herunterladen
      downloadTimesheetPDF(jahr, monat, shifts, userProfile);

      // 2. Mailto Link öffnen
      const recipient = localStorage.getItem('email_recipient') || '';
      let subject = localStorage.getItem('email_subject') || 'Stundenübersicht {MONAT} {JAHR}';
      let body = localStorage.getItem('email_body') ||
        'Sehr geehrte Damen und Herren,\n\nanbei sende ich Ihnen meine Stundenübersicht für den Monat {MONAT} {JAHR}.\n\nMit freundlichen Grüßen,\n{VORNAME} {NAME}';

      subject = subject
        .replace(/{MONAT}/g, monatName)
        .replace(/{JAHR}/g, String(jahr))
        .replace(/{NAME}/g, userProfile.name)
        .replace(/{VORNAME}/g, userProfile.vorname);

      body = body
        .replace(/{MONAT}/g, monatName)
        .replace(/{JAHR}/g, String(jahr))
        .replace(/{NAME}/g, userProfile.name)
        .replace(/{VORNAME}/g, userProfile.vorname);

      onShowToast('✅ PDF heruntergeladen! E-Mail-Programm öffnet sich...', 'success');

      setTimeout(() => {
        window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }, 700);
    } catch (err: any) {
      onShowToast(`Fehler beim E-Mail-Export: ${err?.message}`, 'error');
    }
  };

  return (
    <div className="bg-white/[0.04] backdrop-blur-xl rounded-3xl p-5 border border-white/10 shadow-2xl space-y-4">
      <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-300">
        Dokument-Exporte & Aktionen ({monatName} {jahr})
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={handleDownloadPDF}
          disabled={loadingAction !== null}
          className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-violet-500/25 active:scale-95 transition-all"
        >
          <FileText className="w-4 h-4" />
          <span>Vektor-PDF herunterladen</span>
        </button>

        <button
          onClick={handleDownloadExcel}
          disabled={loadingAction !== null}
          className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 active:scale-95 transition-all"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Excel-Stundenzettel (.xlsx)</span>
        </button>

        <button
          onClick={handleDownloadYearReport}
          disabled={loadingAction !== null}
          className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white font-bold text-xs border border-white/10 active:scale-95 transition-all"
        >
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          <span>Jahres-Gehaltsabgleich {jahr}</span>
        </button>

        <button
          onClick={handleBrowserPrint}
          className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white font-bold text-xs border border-white/10 active:scale-95 transition-all"
        >
          <Printer className="w-4 h-4 text-slate-400" />
          <span>Direkt Drucken (A4)</span>
        </button>
      </div>

      <button
        onClick={handleSendEmail}
        className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
      >
        <Mail className="w-4 h-4 text-cyan-300" />
        <span>PDF herunterladen + E-Mail öffnen</span>
      </button>
    </div>
  );
};
