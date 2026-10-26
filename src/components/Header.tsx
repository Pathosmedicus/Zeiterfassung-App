import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Calendar,
  Sparkles,
  Cloud,
  LogIn,
  LogOut,
  RefreshCw,
  Lock,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { User } from 'firebase/auth';
import { MonthSalaryStats, AppUserSession } from '../types';

interface HeaderProps {
  currentYearMonth: string; // YYYY-MM
  onMonthChange: (newYearMonth: string) => void;
  stats: MonthSalaryStats;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  userName: string;
  activeSession?: AppUserSession | null;
  firebaseUser: User | null;
  onLogin: () => void;
  onLogout: () => void;
  isSyncing?: boolean;
  onManualSync?: () => void;
  onOpenSyncModal?: () => void;
  onOpenCloudModal?: () => void;
  lastSyncTime?: Date | null;
  onLockApp?: () => void;
}

const MONATSNAMEN = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

export const Header: React.FC<HeaderProps> = ({
  currentYearMonth,
  onMonthChange,
  stats,
  isDarkMode,
  onToggleTheme,
  userName,
  activeSession,
  firebaseUser,
  onLogin,
  onLogout,
  isSyncing,
  onManualSync,
  onOpenSyncModal,
  onOpenCloudModal,
  lastSyncTime,
  onLockApp
}) => {
  const [jahrStr, monatStr] = currentYearMonth.split('-');
  const jahr = parseInt(jahrStr, 10);
  const monat = parseInt(monatStr, 10);
  const monatName = MONATSNAMEN[monat - 1] || 'Monat';

  const handlePrevMonth = () => {
    let newYear = jahr;
    let newMonth = monat - 1;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    onMonthChange(`${newYear}-${String(newMonth).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    let newYear = jahr;
    let newMonth = monat + 1;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    onMonthChange(`${newYear}-${String(newMonth).padStart(2, '0')}`);
  };

  const displayName = activeSession?.name || userName || firebaseUser?.displayName || 'Mitarbeiter';
  const displayEmail = activeSession?.email || firebaseUser?.email || '';

  return (
    <header className="sticky top-0 z-40 bg-[#070a13]/90 backdrop-blur-2xl border-b border-white/10 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5">
        {/* Obere Zeile: Branding, User Badge, Sync & Logout */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          {/* Logo & Mitarbeiterinfo */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-400 grid place-items-center text-white shadow-md shadow-violet-500/20 shrink-0">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-display text-base sm:text-lg font-bold text-white tracking-tight leading-tight truncate">
                  Zeiterfassung
                </h1>
                <span className="hidden sm:inline-flex items-center text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  Radiologie
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate flex items-center gap-1.5">
                <span className="text-cyan-300 font-semibold">{displayName}</span>
                <span>•</span>
                <span className="truncate">Klinikum</span>
              </p>
            </div>
          </div>

          {/* Steuerungsleiste rechts */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Cloud-Status Badge & Button (Cloud 🟢) */}
            <button
              type="button"
              onClick={onOpenCloudModal || onOpenSyncModal || onManualSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-emerald-500/40 hover:border-emerald-500/70 rounded-full text-xs font-semibold shadow-sm shadow-emerald-500/10 transition-all active:scale-95 cursor-pointer"
              title="Cloud 🟢 Status: Klicken für Gmail-Cloud Optionen, Smart-Merge & Backups"
            >
              <Cloud className={`w-3.5 h-3.5 ${isSyncing ? 'animate-pulse text-amber-400' : 'text-emerald-400'}`} />
              <span className="text-slate-200 text-xs font-bold">Cloud</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isSyncing
                    ? 'bg-amber-400 animate-spin'
                    : 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50'
                }`}
              />
            </button>

            {/* BLAUER LOGOUT-BUTTON: Sauberes Abmelden & Zurückkehren zum Login-Bildschirm */}
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-md shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
              title="Aktuellen Nutzer abmelden und zurück zum Anmeldebildschirm wechseln"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Abmelden</span>
            </button>

            {/* Tresor Sperren Button */}
            {onLockApp && (
              <button
                type="button"
                onClick={onLockApp}
                className="p-2 rounded-xl bg-white/5 text-slate-300 hover:text-cyan-300 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 transition-all duration-200 active:scale-95 flex items-center"
                title="🔒 Tresor sperren (Geschützter Bereich)"
                aria-label="Tresor sperren"
              >
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
              </button>
            )}

            {/* Dark / Light Toggle */}
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-xl bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 border border-white/10 transition-all duration-200 active:scale-95"
              title={isDarkMode ? 'Zu Hellmodus wechseln' : 'Zu Dunkelmodus wechseln'}
              aria-label="Theme umschalten"
            >
              {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-300" />}
            </button>
          </div>
        </div>

        {/* Untere Zeile: Monatsauswahl & Direkter Stunden-Gesamtzähler */}
        <div className="flex items-center justify-between gap-3 glass p-1.5 rounded-2xl border border-white/10 backdrop-blur-xl">
          {/* Monats-Stepper */}
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-all active:scale-90"
              title="Vorheriger Monat"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="relative flex items-center">
              <span className="font-display text-sm font-bold text-white px-2 py-1 select-none tracking-tight">
                {monatName} {jahr}
              </span>
              <input
                type="month"
                value={currentYearMonth}
                onChange={e => e.target.value && onMonthChange(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Monat auswählen"
              />
            </div>

            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-all active:scale-90"
              title="Nächster Monat"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Stundenzähler des aktiven Monats */}
          <div className="flex items-center gap-3 pr-2">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block leading-none">
                {monatName}
              </span>
              <span className="font-mono text-base font-black text-cyan-300 leading-tight">
                {stats.gesamtDezimal.toFixed(2)}
                <span className="text-xs font-medium text-slate-400 ml-1">h</span>
              </span>
            </div>

            <div className="hidden sm:block h-7 w-px bg-white/10" />

            <div className="hidden sm:block text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block leading-none">
                Dienste
              </span>
              <span className="font-mono text-base font-bold text-white leading-tight">
                {stats.anzahlDienste}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
