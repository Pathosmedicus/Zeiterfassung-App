import React, { useRef, useState } from 'react';
import {
  X,
  Cloud,
  RefreshCw,
  Download,
  Upload,
  FileDown,
  History,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Database,
  Smartphone,
  Laptop,
  ArrowDownToLine,
  ArrowUpFromLine
} from 'lucide-react';
import { User } from 'firebase/auth';
import { AppUserSession, CloudBackupItem } from '../../types';

interface CloudStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  firebaseUser: User | null;
  activeSession: AppUserSession | null;
  localShiftCount: number;
  cloudShiftCount: number | null;
  lastSyncTime: Date | null;
  backupHistory: CloudBackupItem[];
  isSyncing: boolean;
  onSmartMergeSync: () => Promise<void>;
  onPullFromCloud: () => Promise<void>;
  onPushToCloud: () => Promise<void>;
  onDownloadJsonBackup: () => void;
  onRestoreJsonBackup: (file: File) => Promise<void>;
  onRestoreBackupVersion: (backup: CloudBackupItem) => Promise<void>;
  onRestoreOriginalData?: () => Promise<void>;
  onOpenOfflineSyncModal?: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const CloudStatusModal: React.FC<CloudStatusModalProps> = ({
  isOpen,
  onClose,
  firebaseUser,
  activeSession,
  localShiftCount,
  cloudShiftCount,
  lastSyncTime,
  backupHistory,
  isSyncing,
  onSmartMergeSync,
  onPullFromCloud,
  onPushToCloud,
  onDownloadJsonBackup,
  onRestoreJsonBackup,
  onRestoreBackupVersion,
  onRestoreOriginalData,
  onOpenOfflineSyncModal,
  showToast
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (!isOpen) return null;

  const userEmail = activeSession?.email || firebaseUser?.email || 'Nicht angemeldet';
  const userName = activeSession?.name || firebaseUser?.displayName || 'Mitarbeiter';

  const formatSyncTime = (date: Date | null) => {
    if (!date) return 'Noch nicht synchronisiert';
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + ' Uhr (' + date.toLocaleDateString('de-DE') + ')';
  };

  const handleAction = async (name: string, fn: () => Promise<void>) => {
    setActionLoading(name);
    try {
      await fn();
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Aktion fehlgeschlagen', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleAction('restoreJson', () => onRestoreJsonBackup(file));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#0a0f1d] border border-cyan-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl relative text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Schließen Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
          title="Schließen"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 shadow-lg shadow-cyan-500/10">
            <Cloud className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white font-display">Gmail-Cloud Status</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Aktiv
              </span>
            </div>
            <p className="text-xs text-slate-400">Zero Data Loss • Strikte Multi-User Isolation</p>
          </div>
        </div>

        {/* Account Info Karte */}
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 mb-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Eingeloggt als:</span>
            <span className="text-white font-semibold font-mono truncate max-w-[240px] text-right" title={userEmail}>
              {userEmail}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Nutzer-Profil:</span>
            <span className="text-cyan-300 font-medium">{userName}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
            <div className="bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Auf diesem Gerät</span>
              <span className="text-base font-bold text-white font-mono">{localShiftCount}</span>
              <span className="text-[11px] text-slate-400 ml-1">Dienste</span>
            </div>
            <div className="bg-cyan-500/[0.05] p-2.5 rounded-xl border border-cyan-500/20">
              <span className="text-[10px] text-cyan-400 uppercase tracking-wider block">In Gmail-Cloud</span>
              <span className="text-base font-bold text-cyan-300 font-mono">
                {cloudShiftCount !== null ? cloudShiftCount : 'Synchronisiert'}
              </span>
              <span className="text-[11px] text-cyan-400/80 ml-1">Dienste</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <span>Letzte Synchronisation:</span>
            <span className="text-slate-300 font-mono">{formatSyncTime(lastSyncTime)}</span>
          </div>
        </div>

        {/* 4 Pflicht-Aktions-Buttons */}
        <div className="space-y-2.5 mb-5">
          {/* Button 1: Smart-Merge */}
          <button
            type="button"
            onClick={() => handleAction('smartMerge', onSmartMergeSync)}
            disabled={isSyncing || actionLoading !== null}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-cyan-600/30 to-blue-600/30 hover:from-cyan-600/40 hover:to-blue-600/40 border border-cyan-500/40 text-white font-medium text-xs shadow-md shadow-cyan-500/10 transition-all active:scale-[0.98] cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 group-hover:rotate-180 transition-transform duration-500">
                <RefreshCw className={`w-4 h-4 ${actionLoading === 'smartMerge' || isSyncing ? 'animate-spin' : ''}`} />
              </div>
              <div className="text-left">
                <div className="font-bold text-white text-xs sm:text-sm">
                  🔄 Jetzt mit Gmail-Cloud synchronisieren
                </div>
                <div className="text-[10px] text-slate-300">
                  Gleicht deine Schichten sauber mit der Cloud ab – ohne Duplikate oder Geisterdienste
                </div>
              </div>
            </div>
          </button>

          {/* Button 2: Neu laden aus Cloud */}
          <button
            type="button"
            onClick={() => handleAction('pullCloud', onPullFromCloud)}
            disabled={isSyncing || actionLoading !== null}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-cyan-500/30 text-white text-xs transition-all active:scale-[0.98] cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-300">
                <ArrowDownToLine className={`w-4 h-4 ${actionLoading === 'pullCloud' ? 'animate-bounce' : ''}`} />
              </div>
              <div className="text-left">
                <div className="font-semibold text-slate-200">
                  ⬇️ Daten aus Gmail-Cloud neu laden
                </div>
                <div className="text-[10px] text-slate-400">
                  Lädt den aktuellen Cloud-Stand auf dieses Gerät herunter
                </div>
              </div>
            </div>
          </button>

          {/* Button 3: Lokalen Gerätestand sichern */}
          <button
            type="button"
            onClick={() => handleAction('pushCloud', onPushToCloud)}
            disabled={isSyncing || actionLoading !== null}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-emerald-500/30 text-white text-xs transition-all active:scale-[0.98] cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                <ArrowUpFromLine className={`w-4 h-4 ${actionLoading === 'pushCloud' ? 'animate-bounce' : ''}`} />
              </div>
              <div className="text-left">
                <div className="font-semibold text-slate-200">
                  ⬆️ Lokalen Gerätestand in Gmail-Cloud sichern
                </div>
                <div className="text-[10px] text-slate-400">
                  Sichert alle lokalen Änderungen mit automatischer Backup-Historie
                </div>
              </div>
            </div>
          </button>

          {/* Button 4: JSON Backup / Restore */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={onDownloadJsonBackup}
              className="flex items-center justify-center gap-2 p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 text-slate-200 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-amber-400" />
              <span>📥 JSON-Backup exportieren</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={actionLoading !== null}
              className="flex items-center justify-center gap-2 p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 text-slate-200 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-cyan-400" />
              <span>📂 Backup einspielen</span>
            </button>

            {onRestoreOriginalData && (
              <button
                type="button"
                onClick={() => handleAction('restoreOriginal', onRestoreOriginalData)}
                disabled={actionLoading !== null}
                className="col-span-1 sm:col-span-2 flex items-center justify-center gap-2 p-3 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-md"
              >
                <RefreshCw className="w-4 h-4 text-emerald-400" />
                <span>🔄 Originale Bestandsdaten wiederherstellen (30,42 h im Okt 2026)</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Automatische Rollback-Backups (letzte 3 Stände) */}
        {backupHistory && backupHistory.length > 0 && (
          <div className="pt-4 border-t border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white font-display">Automatische Rollback-Backups</h3>
              </div>
              <span className="text-[10px] text-slate-400">Letzte 3 Cloud-Stände</span>
            </div>

            <div className="space-y-1.5">
              {backupHistory.slice(0, 3).map((backup, idx) => {
                const bDate = new Date(backup.timestamp);
                const timeStr = bDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                const dateStr = bDate.toLocaleDateString('de-DE');
                return (
                  <div
                    key={backup.timestamp + idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                        <span className="text-cyan-400">Version #{idx + 1}</span>
                        <span>•</span>
                        <span>{backup.shiftCount} Dienste</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {dateStr} um {timeStr} Uhr
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleAction('rollback', () => onRestoreBackupVersion(backup))
                      }
                      disabled={actionLoading !== null}
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold transition-all active:scale-95 cursor-pointer"
                    >
                      Wiederherstellen
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Optional: Offline Sync Code Trigger */}
        {onOpenOfflineSyncModal && (
          <div className="mt-4 pt-3 border-t border-white/5 text-center">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenOfflineSyncModal();
              }}
              className="text-[11px] text-slate-400 hover:text-cyan-300 transition-colors inline-flex items-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Alternativ: Manueller Sync-Code (PC ↔ Handy ohne Cloud)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
