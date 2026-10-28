import React, { useState } from 'react';
import { CalendarCheck, FileSpreadsheet, Mail, X, Bell } from 'lucide-react';
import { ShiftEntry, TabType } from '../../types';
import { monthLabel } from '../../services/shiftUtils';

interface MonthEndReminderProps {
  shifts: ShiftEntry[];
  onNavigateTab: (tab: TabType) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export const MonthEndReminder: React.FC<MonthEndReminderProps> = ({
  shifts,
  onNavigateTab,
  onShowToast
}) => {
  const now = new Date();
  const day = now.getDate();
  const currentYM = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;

  // Wenn Tag >= 24: Erinnerung für laufenden Monat.
  // Wenn Tag <= 6: Erinnerung für den abgelaufenen Vormonat!
  let targetYM = currentYM;
  if (day <= 6) {
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    targetYM = `${prevDate.getFullYear()}-${pad2(prevDate.getMonth() + 1)}`;
  } else if (day < 24) {
    // Monatsmitte: Kein Monatsabschluss-Alarm nötig
    return null;
  }

  const dismissKey = `zeiterfassung_reminder_dismiss_${targetYM}`;
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    return localStorage.getItem(dismissKey) === 'true';
  });

  if (isDismissed) return null;

  // Schichten des Zielmonats ermitteln
  const targetShifts = shifts.filter(s => s && s.datum && s.datum.startsWith(targetYM) && s.nettoStunden > 0);
  if (targetShifts.length === 0) return null;

  const totalHours = targetShifts.reduce((acc, s) => acc + (s.nettoStunden || 0), 0);
  const targetLabel = monthLabel(targetYM);

  const handleDismiss = () => {
    localStorage.setItem(dismissKey, 'true');
    setIsDismissed(true);
  };

  const handleRequestNativeNotification = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      onShowToast('Browser unterstützt keine System-Benachrichtigungen.', 'info');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        new Notification('Zeiterfassung Radiologie', {
          body: `Monatsabschluss für ${targetLabel}: ${targetShifts.length} Dienste (${totalHours.toFixed(1)} h) bereit zum Export.`,
          icon: '/favicon.svg'
        });
        onShowToast('🔔 Benachrichtigungen aktiviert!', 'success');
      } else {
        onShowToast('Benachrichtigungen abgelehnt.', 'info');
      }
    } catch (e: any) {
      onShowToast('Konnte Benachrichtigung nicht anfordern.', 'error');
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-cyan-950/40 via-indigo-950/40 to-slate-900/60 border border-cyan-500/30 p-4 shadow-xl backdrop-blur-xl animate-in fade-in duration-300 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0 mt-0.5 shadow-md shadow-cyan-500/10">
            <CalendarCheck className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1">
                <span>Monatsabschluss fällig</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-cyan-400/20 text-cyan-200 border border-cyan-400/30">
                  {targetLabel}
                </span>
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 leading-snug">
              Du hast für <strong className="text-white font-semibold">{targetLabel}</strong> insgesamt{' '}
              <strong className="text-cyan-300 font-semibold">{targetShifts.length} Dienste</strong> mit{' '}
              <strong className="text-cyan-300 font-semibold">{totalHours.toFixed(1)} Stunden</strong> erfasst.
              Bitte Zeiten prüfen und einreichen.
            </p>
          </div>
        </div>

        {/* Aktions-Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={() => onNavigateTab('export')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export & PDF</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('email')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white border border-white/15 font-bold text-xs transition-all active:scale-95 cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5 text-cyan-300" />
            <span>E-Mail</span>
          </button>

          {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default' && (
            <button
              type="button"
              onClick={handleRequestNativeNotification}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-cyan-300 border border-white/10 transition-all"
              title="Benachrichtigungen erlauben"
              aria-label="Benachrichtigungen erlauben"
            >
              <Bell className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-all"
            title="Diesen Monat schließen"
            aria-label="Schließen"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
