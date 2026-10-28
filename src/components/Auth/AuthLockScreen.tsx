import React, { useState, useEffect } from 'react';
import { AlertOctagon, ShieldCheck, Calendar, Fingerprint, KeyRound, Sparkles, User, Check, ArrowRight } from 'lucide-react';
import { APP_VERSION, APP_BUILD_DATE } from '../../version';
import { webAuthnService } from '../../services/webAuthnService';
import { storageService } from '../../services/storageService';

interface AuthLockScreenProps {
  onGoogleLogin: () => Promise<void>;
  onUnlockWithPin: (userId: string, pin: string, remember: boolean, userName?: string) => Promise<boolean>;
  onBiometricLogin: () => Promise<boolean>;
  authError: string | null;
  isSyncing: boolean;
  onClearError: () => void;
}

export const AuthLockScreen: React.FC<AuthLockScreenProps> = ({
  onGoogleLogin,
  onUnlockWithPin,
  onBiometricLogin,
  authError,
  isSyncing,
  onClearError
}) => {
  const [mode, setMode] = useState<'google' | 'pin'>('google');
  const [hasBiometrics, setHasBiometrics] = useState<boolean>(() => webAuthnService.hasRegisteredBiometrics());
  const [isBioLoading, setIsBioLoading] = useState<boolean>(false);

  // Schnell-Profil Felder
  const registeredUsers = storageService.getRegisteredUsers();
  const [selectedUserId, setSelectedUserId] = useState<string>(() => {
    return registeredUsers[0]?.id || 'mohammadmattar1971@gmail.com';
  });
  const [customName, setCustomName] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [remember, setRemember] = useState<boolean>(true);
  const [pinSubmitting, setPinSubmitting] = useState<boolean>(false);

  useEffect(() => {
    setHasBiometrics(webAuthnService.hasRegisteredBiometrics());
  }, []);

  const handleBiometricClick = async () => {
    setIsBioLoading(true);
    try {
      await onBiometricLogin();
    } finally {
      setIsBioLoading(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pin.trim().length < 4) {
      return;
    }
    setPinSubmitting(true);
    try {
      const targetUser = registeredUsers.find(u => u.id === selectedUserId);
      const userName = targetUser?.name || customName.trim() || undefined;
      const success = await onUnlockWithPin(selectedUserId, pin.trim(), remember, userName);
      if (!success) {
        setPin('');
      }
    } finally {
      setPinSubmitting(false);
    }
  };

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

            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight font-display">
                Zeiterfassung Radiologie
              </h1>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {APP_VERSION}
              </span>
            </div>
            <p className="text-xs text-cyan-300 font-semibold mt-1">
              Multi-User & Geschützter Arbeitsbereich
            </p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
              Jeder Mitarbeiter hat einen strikt isolierten Speicher (0 Bytes fremder Datenzugriff).
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
                className="text-rose-400 hover:text-white text-xs px-1 cursor-pointer"
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>
          )}

          {/* Biometrie-Schnell-Button (falls auf Gerät registriert) */}
          {hasBiometrics && (
            <div className="mb-4">
              <button
                type="button"
                onClick={handleBiometricClick}
                disabled={isBioLoading || isSyncing}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-600/30 via-indigo-600/30 to-blue-600/30 hover:from-cyan-600/40 hover:to-blue-600/40 text-cyan-200 border border-cyan-500/40 font-bold text-sm transition-all duration-200 shadow-lg shadow-cyan-500/10 active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
              >
                {isBioLoading ? (
                  <div className="w-5 h-5 border-2 border-cyan-300/30 border-t-cyan-300 rounded-full animate-spin" />
                ) : (
                  <Fingerprint className="w-5 h-5 text-cyan-300" />
                )}
                <span>Mit Touch ID / Face ID entsperren</span>
              </button>
            </div>
          )}

          {/* Anmelde-Modus Umschalter (Google vs. Offline-PIN) */}
          <div className="flex items-center p-1 bg-black/40 border border-white/10 rounded-2xl mb-4">
            <button
              type="button"
              onClick={() => setMode('google')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                mode === 'google'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Google Cloud
            </button>
            <button
              type="button"
              onClick={() => setMode('pin')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                mode === 'pin'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Offline PIN / Schnell-Profil
            </button>
          </div>

          {/* Google Login Tab */}
          {mode === 'google' && (
            <div className="space-y-3 pt-1 animate-in fade-in duration-200">
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
          )}

          {/* PIN / Schnell-Profil Tab (100% Offline fähig!) */}
          {mode === 'pin' && (
            <form onSubmit={handlePinSubmit} className="space-y-3 pt-1 text-left animate-in fade-in duration-200">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Mitarbeiter / Profil auswählen:
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-black/60 border border-white/15 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-cyan-400"
                >
                  <option value="mohammadmattar1971@gmail.com">Mohammad Almatar (Eigentümer)</option>
                  {registeredUsers
                    .filter(u => u.id !== 'mohammadmattar1971@gmail.com')
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email || u.id})
                      </option>
                    ))}
                  <option value="__new__">+ Neues Team-Profil anlegen</option>
                </select>
              </div>

              {selectedUserId === '__new__' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Dein Name:
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Vor- und Nachname"
                    required
                    className="w-full px-3.5 py-2.5 bg-black/60 border border-white/15 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-cyan-400"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    PIN eingeben:
                  </label>
                  <span className="text-[10px] text-cyan-400 font-medium">Mind. 4 Zeichen</span>
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="PIN eingeben..."
                  autoFocus
                  required
                  className="w-full px-4 py-3 bg-black/60 border border-white/15 focus:border-cyan-400 rounded-xl text-white font-mono text-center tracking-widest text-lg font-bold focus:outline-none transition-all"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="rounded border-white/20 bg-black/40 text-cyan-500 focus:ring-0"
                  />
                  <span className="text-[11px]">Angemeldet bleiben</span>
                </label>
                <span className="text-[10px] text-emerald-400 font-semibold">100% Offline-fähig</span>
              </div>

              <button
                type="submit"
                disabled={pinSubmitting || isSyncing || pin.length < 4}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-cyan-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                {pinSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Profil entsperren</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Version-Footer zur einfachen Verfolgung von Aktualisierungen */}
          <div className="mt-6 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>Stand: {APP_BUILD_DATE}</span>
            <span className="text-cyan-400 font-semibold">{APP_VERSION}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
