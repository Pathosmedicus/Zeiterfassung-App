import React, { useState } from 'react';
import { Sparkles, RefreshCw, CheckCircle2, History, Info } from 'lucide-react';
import { APP_VERSION, APP_BUILD_DATE, APP_CHANGELOG } from '../../version';

interface AppVersionCardProps {
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AppVersionCard: React.FC<AppVersionCardProps> = ({ onShowToast }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const handleForceUpdate = async () => {
    setIsUpdating(true);
    onShowToast?.('Cache wird geleert und neueste Version geladen...', 'info');
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.update();
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch {
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  };

  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shadow-md shadow-cyan-500/10">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white font-display">App-Version & Updates</h3>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                {APP_VERSION}
              </span>
            </div>
            <p className="text-xs text-slate-400">Stand: {APP_BUILD_DATE} • Zeiterfassung Radiologie</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleForceUpdate}
          disabled={isUpdating}
          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-500/20 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
          title="Leert den PWA-/Browser-Cache und erzwingt das Neuladen der neuesten App-Version"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
          <span>{isUpdating ? 'Lädt...' : 'Auf Update prüfen'}</span>
        </button>
      </div>

      <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2.5 mb-4">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <div className="flex-1">
          <span className="font-bold">Aktuelle Version installiert: {APP_VERSION}</span>
          <p className="text-[11px] text-emerald-300/80">
            Zentrierter A4-PDF-Export, direkter Stundenzettel-Tab, Multi-User Cloud Isolation.
          </p>
        </div>
      </div>

      {/* Button zum Einblenden der Update-Historie */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="text-xs text-cyan-300 hover:text-cyan-200 font-semibold flex items-center gap-1.5 transition-colors"
        >
          <History className="w-3.5 h-3.5" />
          <span>{showHistory ? 'Update-Verlauf ausblenden' : 'Update-Verlauf & Neuerungen anzeigen'}</span>
        </button>

        {showHistory && (
          <div className="space-y-3 pt-2 animate-in fade-in duration-200">
            {APP_CHANGELOG.map(rel => (
              <div
                key={rel.version}
                className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-cyan-300 font-mono">{rel.version}</span>
                  <span className="text-[11px] text-slate-400">{rel.date}</span>
                </div>
                <h4 className="text-xs font-semibold text-white">{rel.title}</h4>
                <ul className="space-y-1 text-slate-300 text-[11px]">
                  {rel.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
