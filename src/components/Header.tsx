import React from 'react';
import { ChevronLeft, ChevronRight, Sun, Moon, Calendar, Sparkles, Cloud, LogIn, LogOut, CheckCircle2, RefreshCw } from 'lucide-react';
import { User } from 'firebase/auth';
import { MonthSalaryStats } from '../types';

interface HeaderProps {
  currentYearMonth: string; // YYYY-MM
  onMonthChange: (newYearMonth: string) => void;
  stats: MonthSalaryStats;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  userName: string;
  firebaseUser: User | null;
  onLogin: () => void;
  onLogout: () => void;
  isSyncing?: boolean;
  onManualSync?: () => void;
  lastSyncTime?: Date | null;
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
  firebaseUser,
  onLogin,
  onLogout,
  isSyncing,
  onManualSync,
  lastSyncTime
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

  return (
    <header className="sticky top-0 z-40 bg-[#0b0f1a]/85 backdrop-blur-xl border-b border-white/10 transition-colors duration-200">
      <div className="max-w-4xl mx-auto px-4 py-3">
        {/* Obere Zeile: Branding & Firebase Auth & Theme Switcher */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-400 grid place-items-center text-white shadow-md shadow-violet-500/20 shrink-0">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-lg font-bold text-white tracking-tight leading-tight truncate">
                  Zeiterfassung
                </h1>
                <span className="hidden sm:inline-flex items-center text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  Radiologie
                </span>
              </div>
              <p className="text-[11px] text-[var(--muted)] font-medium truncate">
                {userName || 'Mitarbeiter'} • Radiologie
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Google Account Status / Login & Cloud Sync Button */}
            {firebaseUser ? (
              <div className="flex items-center gap-1.5">
                <div
                  className="flex items-center gap-2 pl-1 pr-2.5 py-1 bg-white/5 hover:bg-white/10 border border-emerald-500/30 rounded-full text-xs font-semibold shadow-sm transition-all"
                  title={`Angemeldet als ${firebaseUser.email}`}
                >
                  {firebaseUser.photoURL ? (
                    <img
                      src={firebaseUser.photoURL}
                      alt="Google User"
                      className="w-5 h-5 rounded-full ring-1 ring-emerald-400"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center justify-center">
                      G
                    </div>
                  )}
                  <span className="text-slate-200 hidden md:inline max-w-[120px] truncate">
                    {firebaseUser.displayName || firebaseUser.email?.split('@')[0]}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isSyncing ? 'bg-amber-400 animate-spin' : 'bg-emerald-400 animate-pulse'
                    }`}
                    title={isSyncing ? 'Synchronisiere mit Cloud...' : 'Google Cloud aktiv'}
                  />
                  <button
                    type="button"
                    onClick={onLogout}
                    className="text-xs text-slate-400 hover:text-rose-400 transition-colors ml-0.5 font-bold px-1"
                    title="Von Google abmelden"
                  >
                    ✕
                  </button>
                </div>

                {onManualSync && (
                  <button
                    type="button"
                    onClick={onManualSync}
                    disabled={isSyncing}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all active:scale-95 shadow-sm"
                    title={
                      lastSyncTime
                        ? `Zuletzt synchronisiert: ${lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} Uhr • Klicken zum Synchronisieren`
                        : 'Jetzt mit Cloud synchronisieren'
                    }
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-400' : 'text-cyan-400'}`} />
                    <span className="hidden sm:inline">
                      {isSyncing ? 'Sync...' : 'Sync'}
                    </span>
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onLogin}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-600/20 to-indigo-600/20 hover:from-blue-600/30 hover:to-indigo-600/30 border border-blue-500/30 text-blue-300 transition-all shadow-sm active:scale-95"
                title="Mit Google anmelden für Cloud-Synchronisation"
              >
                <LogIn className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Google Login</span>
              </button>
            )}

            {/* Dark / Light Toggle */}
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-xl bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 border border-white/10 transition-all duration-200 active:scale-95"
              title={isDarkMode ? 'Zu Hellmodus wechseln' : 'Zu Dunkelmodus wechseln'}
              aria-label="Theme umschalten"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
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

          {/* Direkter Live-Stundenzähler Badge */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 border border-white/10 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <div className="text-right">
                <div className="text-xs font-black text-cyan-300 font-display">
                  {stats.gesamtDezimal.toFixed(2)} h
                </div>
              </div>
            </div>

            <div className="hidden sm:flex items-center px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold font-display">
              ~ {stats.erwartetesNetto.toFixed(2)} €
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
