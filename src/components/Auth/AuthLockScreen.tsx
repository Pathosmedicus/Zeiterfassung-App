import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, AlertOctagon, User, Plus, ShieldCheck, Eye, EyeOff, Calendar, Sparkles } from 'lucide-react';
import { storageService } from '../../services/storageService';
import { AppUserSession } from '../../types';

interface AuthLockScreenProps {
  onGoogleLogin: () => Promise<void>;
  onUnlockPin: (userId: string, pin: string, remember: boolean, userName?: string) => Promise<boolean>;
  authError: string | null;
  isSyncing: boolean;
  onClearError: () => void;
}

export const AuthLockScreen: React.FC<AuthLockScreenProps> = ({
  onGoogleLogin,
  onUnlockPin,
  authError,
  isSyncing,
  onClearError
}) => {
  const [registeredUsers, setRegisteredUsers] = useState<AppUserSession[]>([]);
  const [selectedUser, setSelectedUser] = useState<AppUserSession | null>(null);

  // Neuer Nutzer / Schnell-Profil Modus
  const [isNewProfileMode, setIsNewProfileMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);

  const [pinError, setPinError] = useState<string | null>(null);
  const [isUnlockingPin, setIsUnlockingPin] = useState(false);

  useEffect(() => {
    const list = storageService.getRegisteredUsers();
    setRegisteredUsers(list);
    if (list.length > 0) {
      setSelectedUser(list[0]);
    } else {
      setIsNewProfileMode(true);
    }
  }, []);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setPinError('Bitte gib deine PIN oder dein Passwort ein.');
      return;
    }

    let targetUserId = '';
    let targetName = '';

    if (isNewProfileMode) {
      if (!newName.trim()) {
        setPinError('Bitte gib deinen Namen ein.');
        return;
      }
      targetName = newName.trim();
      targetUserId = `local_${targetName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
    } else if (selectedUser) {
      targetUserId = selectedUser.id;
      targetName = selectedUser.name;
    } else {
      setPinError('Bitte wähle ein Profil aus.');
      return;
    }

    setPinError(null);
    setIsUnlockingPin(true);
    try {
      const success = await onUnlockPin(targetUserId, pin.trim(), rememberDevice, targetName);
      if (!success) {
        setPinError('⛔ Ungültige PIN für dieses Profil.');
      }
    } catch (err: any) {
      setPinError(err.message || 'Entschlüsselung fehlgeschlagen.');
    } finally {
      setIsUnlockingPin(false);
    }
  };

  const activeError = authError || pinError;

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Atmosphärischer Cyber-Tresor Hintergrund */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.6)_0%,transparent_100%)] pointer-events-none" />

      {/* Hauptkarte */}
      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Header Glow-Streifen */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />

          {/* Branding & Titel */}
          <div className="flex flex-col items-center text-center mb-6">
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
          {activeError && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5 animate-in shake duration-200">
              <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-rose-300">{activeError}</p>
              </div>
              <button
                onClick={() => { setPinError(null); onClearError(); }}
                className="text-rose-400 hover:text-white text-xs px-1"
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>
          )}

          {/* Option 1: Mit Google anmelden */}
          <div className="mb-5">
            <button
              type="button"
              onClick={onGoogleLogin}
              disabled={isSyncing}
              className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs sm:text-sm transition-all duration-200 shadow-xl shadow-cyan-500/10 active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-60 cursor-pointer"
            >
              {isSyncing ? (
                <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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
              <span>Mit Google anmelden (Jeder Account)</span>
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-1.5">
              Automatische Zuordnung & isolierter Cloud-Speicher
            </p>
          </div>

          {/* Trennlinie */}
          <div className="relative py-2 mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#0b0f19] px-3 text-slate-400 text-[10px] font-bold tracking-widest">
                Oder Persönliches Profil mit PIN
              </span>
            </div>
          </div>

          {/* Gespeicherte lokale Profile auswählen */}
          {registeredUsers.length > 0 && (
            <div className="mb-4">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Profil auf diesem Gerät wählen:
              </label>
              <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-1">
                {registeredUsers.map(u => {
                  const isSelected = !isNewProfileMode && selectedUser?.id === u.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setSelectedUser(u);
                        setIsNewProfileMode(false);
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-sm'
                          : 'bg-white/[0.03] border-white/5 text-slate-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-xs shrink-0">
                          {u.name.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate text-white">{u.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {u.email || (u.authProvider === 'pin' ? 'Lokales Profil' : u.id)}
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="text-[10px] font-bold text-cyan-300 px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40">
                          Aktiv
                        </span>
                      )}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    setIsNewProfileMode(true);
                    setSelectedUser(null);
                  }}
                  className={`w-full p-2 rounded-xl border border-dashed text-left flex items-center justify-center gap-2 transition-all text-xs font-semibold ${
                    isNewProfileMode
                      ? 'bg-cyan-500/10 border-cyan-400 text-cyan-300'
                      : 'border-white/10 text-slate-400 hover:text-white hover:border-white/30'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Neues Kollegen-Profil anlegen</span>
                </button>
              </div>
            </div>
          )}

          {/* Formular für PIN / Login */}
          <form onSubmit={handlePinSubmit} className="space-y-3">
            {isNewProfileMode && (
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Dein Name / Kennung (für neues Profil)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="z. B. Dr. Weber oder Anna"
                    required
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-cyan-400"
                  />
                  <User className="w-4 h-4 text-cyan-400 absolute left-3 top-3" />
                </div>
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1 flex items-center justify-between">
                <span>
                  {isNewProfileMode ? 'Wähle deine persönliche PIN / Passwort' : `PIN für ${selectedUser?.name || 'Profil'}`}
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Mind. 4 Zeichen</span>
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="PIN eingeben..."
                  required
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs font-mono font-semibold focus:outline-none focus:border-cyan-400 tracking-wider"
                />
                <KeyRound className="w-4 h-4 text-cyan-400 absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
              <input
                type="checkbox"
                id="rememberDevice"
                checked={rememberDevice}
                onChange={e => setRememberDevice(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-black/40 border-white/20 text-cyan-500 focus:ring-0 cursor-pointer"
              />
              <label htmlFor="rememberDevice" className="cursor-pointer select-none">
                Auf diesem Gerät autorisiert bleiben
              </label>
            </div>

            <button
              type="submit"
              disabled={isUnlockingPin}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
            >
              {isUnlockingPin ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Entschlüssele...</span>
                </div>
              ) : (
                <span>
                  {isNewProfileMode ? '🚀 Neues Profil starten' : `🔓 Als ${selectedUser?.name || 'Mitarbeiter'} anmelden`}
                </span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
