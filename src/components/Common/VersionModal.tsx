import React, { useState } from 'react';
import { Sparkles, RefreshCw, CheckCircle2, History, X, ExternalLink } from 'lucide-react';
import { APP_VERSION, APP_BUILD_DATE, APP_CHANGELOG } from '../../version';

interface VersionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VersionModal: React.FC<VersionModalProps> = ({ isOpen, onClose }) => {
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleForceUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateMsg('Cache wird geleert und neueste Version geladen...');
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.update();
        }
      }
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(k => caches.delete(k)));
      }
      setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (e: any) {
      setUpdateMsg('Neuladen wird ausgeführt...');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b0f19] border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden text-slate-100 max-h-[90vh] flex flex-col">
        {/* Dekorativer Glanzstreifen */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shadow-md shadow-cyan-500/10">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">App-Version & Updates</h3>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  {APP_VERSION}
                </span>
              </div>
              <p className="text-xs text-slate-400">Stand: {APP_BUILD_DATE}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            aria-label="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status-Banner */}
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2.5 mb-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold">Installierte Version: {APP_VERSION}</span>
            <p className="text-[11px] text-emerald-300/80">Alle Module und PWA-Dateien sind auf diesem Gerät aktiv.</p>
          </div>
        </div>

        {/* Update erzwingen Button */}
        <div className="mb-4">
          <button
            type="button"
            onClick={handleForceUpdate}
            disabled={isCheckingUpdate}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
            <span>{isCheckingUpdate ? 'Aktualisiere...' : 'Auf Updates prüfen & Cache neu laden'}</span>
          </button>
          {updateMsg && (
            <p className="text-[11px] text-cyan-300 text-center mt-1.5 font-medium animate-pulse">{updateMsg}</p>
          )}
        </div>

        {/* Changelog-Liste */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold uppercase tracking-wider text-[10px] pb-1">
            <History className="w-3 h-3" />
            <span>Änderungsverlauf & Neuerungen</span>
          </div>

          {APP_CHANGELOG.map((rel) => (
            <div
              key={rel.version}
              className={`p-3.5 rounded-2xl border ${
                rel.version === APP_VERSION
                  ? 'bg-white/[0.04] border-cyan-500/30'
                  : 'bg-white/[0.02] border-white/5 opacity-75'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-cyan-300 font-mono">{rel.version}</span>
                <span className="text-[10px] text-slate-400">{rel.date}</span>
              </div>
              <h4 className="font-semibold text-white mb-2">{rel.title}</h4>
              <ul className="space-y-1 text-slate-300 text-[11px]">
                {rel.highlights.map((h, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-white/10 text-center">
          <p className="text-[11px] text-slate-400">
            Automatisches PWA-Update bei bestehender Internetverbindung aktiv.
          </p>
        </div>
      </div>
    </div>
  );
};
