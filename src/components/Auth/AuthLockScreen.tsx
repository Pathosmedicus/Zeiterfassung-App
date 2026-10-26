import React from 'react';
import { AlertOctagon, ShieldCheck, Calendar } from 'lucide-react';

interface AuthLockScreenProps {
  onGoogleLogin: () => Promise<void>;
  authError: string | null;
  isSyncing: boolean;
  onClearError: () => void;
}

export const AuthLockScreen: React.FC<AuthLockScreenProps> = ({
  onGoogleLogin,
  authError,
  isSyncing,
  onClearError
}) => {
  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Atmosphärischer Cyber-Tresor Hintergrund */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.6)_0%,transparent_100%)] pointer-events-none" />

      {/* Hauptkarte */}
      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-center">
          {/* Header Glow-Streifen */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />

          {/* Branding & Titel */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-3">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-indigo-500/20 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                <Calendar className="w-8 h-8 text-cyan-400 stroke-[2.2]" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-xl bg-slate-900 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight font-display">
              Zeiterfassung Radiologie
            </h1>
            <p className="text-xs text-cyan-300 font-semibold mt-0.5">
              Multi-User & Geschützter Arbeitsbereich
            </p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
              Jeder Kollege hat einen strikt isolierten Speicher (0 Bytes fremder Datenzugriff).
            </p>
          </div>

          {/* Fehler-Banner */}
          {authError && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5 animate-in shake duration-200 text-left">
              <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-rose-300">{authError}</p>
              </div>
              <button
                onClick={onClearError}
                className="text-rose-400 hover:text-white text-xs px-1"
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>
          )}

          {/* Nur Google-Login */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={onGoogleLogin}
              disabled={isSyncing}
              className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm transition-all duration-200 shadow-xl shadow-cyan-500/10 active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-60 cursor-pointer"
            >
              {isSyncing ? (
                <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>Mit Google anmelden</span>
            </button>
            <p className="text-[11px] text-slate-400">
              Automatische Zuordnung & strikt isolierter Cloud-Speicher
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
