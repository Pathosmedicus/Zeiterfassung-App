import React, { useState } from 'react';
import { Shield, KeyRound, Lock, CheckCircle2, Eye, EyeOff, UserCheck, Smartphone } from 'lucide-react';
import { vaultService, isMohammad, MOHAMMAD_EMAIL } from '../../services/vaultService';
import { storageService } from '../../services/storageService';

interface VaultConfigProps {
  onLockApp: () => void;
  onOpenSyncModal?: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const VaultConfig: React.FC<VaultConfigProps> = ({
  onLockApp,
  onOpenSyncModal,
  onShowToast
}) => {
  const session = storageService.getActiveSession();
  const [currentPass, setCurrentPass] = useState(vaultService.getDefaultPass());
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isChangingPin, setIsChangingPin] = useState(false);

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin || newPin.trim().length < 4) {
      onShowToast('Die neue PIN muss mindestens 4 Zeichen lang sein.', 'error');
      return;
    }
    if (newPin !== confirmPin) {
      onShowToast('Die eingegebenen PINs stimmen nicht überein.', 'error');
      return;
    }
    try {
      if (session) {
        await vaultService.setUserPin(session.id, newPin.trim());
      }
      vaultService.setCustomPin(newPin.trim());
      setCurrentPass(newPin.trim());
      setNewPin('');
      setConfirmPin('');
      setIsChangingPin(false);
      onShowToast('🔒 Neue PIN erfolgreich für dieses Profil gespeichert!', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Fehler beim Speichern der PIN.', 'error');
    }
  };

  const isOwner = session?.isOwner || isMohammad(session?.email || session?.id);

  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden group">
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/15 transition-all duration-700" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide font-display flex items-center gap-2">
              <span>Sicherheit & Daten-Isolation</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                AES-256-GCM
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Multi-User Zero-Data-Leak: Jeder Nutzer besitzt einen isolierten Speicherbereich
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenSyncModal && (
            <button
              type="button"
              onClick={onOpenSyncModal}
              className="px-3 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Geräte-Sync</span>
            </button>
          )}

          <button
            type="button"
            onClick={onLockApp}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-rose-500/10 text-slate-300 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 text-xs font-bold transition-all flex items-center gap-2"
          >
            <Lock className="w-3.5 h-3.5 text-rose-400" />
            <span>Tresor sperren</span>
          </button>
        </div>
      </div>

      {/* Sicherheits-Parameter Übersicht */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
          <div className="flex items-center gap-2 text-slate-400 text-[11px] mb-1 font-semibold">
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Aktiver Benutzerbereich:</span>
          </div>
          <div className="font-mono text-xs text-cyan-300 font-bold break-all flex items-center gap-1.5">
            <span>{session?.name || 'Mitarbeiter'}</span>
            {isOwner ? (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                Eigentümer
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-500/20 text-slate-300 border border-slate-500/40">
                Team-Profil
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {session?.email || `Lokale ID: ${session?.id || 'anonym'}`}
          </p>
        </div>

        <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
          <div className="flex items-center gap-2 text-slate-400 text-[11px] mb-1 font-semibold">
            <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
            <span>Persönlicher Profil-Schlüssel:</span>
          </div>
          <div className="flex items-center justify-between text-xs text-emerald-300 font-bold">
            <span>•••••••• (Aktiv)</span>
            <button
              type="button"
              onClick={() => setIsChangingPin(!isChangingPin)}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold underline"
            >
              {isChangingPin ? 'Abbrechen' : 'PIN ändern'}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Schützt Daten lokal & beim geräteübergreifenden Cloud-/Token-Sync
          </p>
        </div>
      </div>

      {/* PIN Ändern Formular */}
      {isChangingPin && (
        <form onSubmit={handleSavePin} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3 mb-4 animate-in fade-in duration-200">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
            <span>Neue PIN für {session?.name || 'Profil'} festlegen</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-300 mb-1">Neue PIN / Passwort:</label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="Mind. 4 Zeichen"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-300 mb-1">Bestätigen:</label>
              <input
                type={showPin ? 'text' : 'password'}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="PIN wiederholen"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95"
          >
            PIN jetzt speichern
          </button>
        </form>
      )}

      {/* Info-Kasten */}
      <div className="p-3.5 rounded-2xl bg-cyan-500/[0.04] border border-cyan-500/20 text-xs text-slate-300 leading-relaxed flex items-start gap-3">
        <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-white mb-0.5">Vollständige Multi-User Datentrennung aktiv</p>
          <p className="text-[11px] text-slate-400">
            Jeder Kollege arbeitet in einem eigenen, isolierten Tresor. Keine fremde Person hat Einblick in deine Schichten, Gehälter oder Nachforderungen.
          </p>
        </div>
      </div>
    </div>
  );
};
