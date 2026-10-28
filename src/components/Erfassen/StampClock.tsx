import React, { useEffect, useState } from 'react';
import { Play, Square, X, Timer } from 'lucide-react';
import { ShiftEntry } from '../../types';
import { berechneNetto } from '../../services/salaryEngine';
import { storageService } from '../../services/storageService';
import { PauseInputField } from '../Common/PauseInputField';

interface StampClockProps {
  shifts: ShiftEntry[];
  onSaveShift: (shift: ShiftEntry) => void | Promise<void>;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const toDatum = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const toHHMM = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

/**
 * Stempeluhr: Start/Stop-Erfassung in Echtzeit. Der laufende Dienst wird im Benutzer-Speicher
 * abgelegt und läuft daher auch nach Neuladen oder Schließen der App weiter.
 */
export const StampClock: React.FC<StampClockProps> = ({ shifts, onSaveShift, onShowToast }) => {
  const [stamp, setStamp] = useState(() => storageService.getStamp());
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!stamp) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [stamp?.startIso]);

  const handleStart = () => {
    const next = { startIso: new Date().toISOString(), pauseMinuten: 30 };
    storageService.saveStamp(next);
    setStamp(next);
  };

  const handlePauseChange = (minutes: number) => {
    if (!stamp) return;
    const next = { ...stamp, pauseMinuten: minutes };
    storageService.saveStamp(next);
    setStamp(next);
  };

  const handleDiscard = () => {
    if (!window.confirm('Laufende Zeiterfassung verwerfen? Es wird nichts gespeichert.')) return;
    storageService.clearStamp();
    setStamp(null);
  };

  const handleStop = async () => {
    if (!stamp) return;
    const start = new Date(stamp.startIso);
    const end = new Date();
    const elapsedMin = (end.getTime() - start.getTime()) / 60000;

    if (elapsedMin >= 24 * 60 - 1) {
      onShowToast('Die Erfassung läuft seit über 24 Stunden – bitte verwerfen und den Dienst manuell eintragen.', 'error');
      return;
    }

    const kommen = toHHMM(start);
    const gehen = toHHMM(end);
    const nettoStunden = berechneNetto(kommen, gehen, stamp.pauseMinuten);
    if (nettoStunden <= 0) {
      onShowToast('Keine Arbeitszeit erfasst (zu kurz oder Pause länger als der Dienst). Der Dienst läuft weiter.', 'info');
      return;
    }

    const datum = toDatum(start);
    if (shifts.some(s => s.datum === datum && s.nettoStunden > 0)) {
      const [y, m, d] = datum.split('-');
      const ok = window.confirm(`Für den ${d}.${m}.${y} existiert bereits ein Dienst. Überschreiben?`);
      if (!ok) return;
    }

    await onSaveShift({
      datum,
      kommen,
      gehen,
      pauseMinuten: stamp.pauseMinuten,
      nettoStunden,
      schichtTyp: 'Stempeluhr'
    });

    storageService.clearStamp();
    setStamp(null);
  };

  return (
    <div className="bg-white/[0.04] backdrop-blur-xl rounded-3xl p-4 border border-white/10 shadow-2xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shrink-0">
            <Timer className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white tracking-wide font-display">Stempeluhr</h3>
            <p className="text-[11px] text-slate-400 truncate">
              {stamp ? `Läuft seit ${toHHMM(new Date(stamp.startIso))} Uhr` : 'Dienst live starten & beenden'}
            </p>
          </div>
        </div>

        {stamp ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-lg font-black text-cyan-300 tabular-nums" aria-live="off">
              {formatElapsed(now - new Date(stamp.startIso).getTime())}
            </span>
            <button
              type="button"
              onClick={handleStop}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-xs font-bold transition-all active:scale-95"
            >
              <Square className="w-3.5 h-3.5" /> Stopp
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleStart}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 shrink-0"
          >
            <Play className="w-3.5 h-3.5" /> Start
          </button>
        )}
      </div>

      {stamp && (
        <div className="mt-3 flex items-end gap-3">
          <PauseInputField label="Pause" value={stamp.pauseMinuten} onChange={handlePauseChange} className="flex-1" />
          <button
            type="button"
            onClick={handleDiscard}
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all active:scale-90"
            title="Erfassung verwerfen"
            aria-label="Erfassung verwerfen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
