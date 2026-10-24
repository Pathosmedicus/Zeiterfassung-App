import React, { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, Sparkles, Moon, Sun, AlertTriangle } from 'lucide-react';
import { ShiftEntry, PresetShift } from '../../types';
import { berechneNetto, berechneMinuten } from '../../services/salaryEngine';
import { getDayInfo } from '../../services/holidayEngine';

interface QuickEntryProps {
  selectedDate: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
  shifts: ShiftEntry[];
  presets: PresetShift[];
  onSaveShift: (shift: ShiftEntry) => void;
  onDeleteShift: (datum: string) => void;
}

export const QuickEntry: React.FC<QuickEntryProps> = ({
  selectedDate,
  onDateChange,
  shifts,
  presets,
  onSaveShift,
  onDeleteShift
}) => {
  const [kommen, setKommen] = useState<string>('07:30');
  const [gehen, setGehen] = useState<string>('16:00');
  const [pauseMinuten, setPauseMinuten] = useState<number>(30);
  const [schichtTyp, setSchichtTyp] = useState<string>('Frühdienst');

  // Existierenden Eintrag für das Datum laden
  const existingShift = shifts.find(s => s.datum === selectedDate);

  useEffect(() => {
    if (existingShift) {
      setKommen(existingShift.kommen || '07:30');
      setGehen(existingShift.gehen || '16:00');
      setPauseMinuten(existingShift.pauseMinuten ?? 30);
      setSchichtTyp(existingShift.schichtTyp || 'Individuell');
    }
  }, [selectedDate, existingShift]);

  const nettoStunden = berechneNetto(kommen, gehen, pauseMinuten);
  const dayInfo = getDayInfo(selectedDate);

  // Erkennt Über-Nacht-Schichten
  const isOvernight = (() => {
    if (!kommen || !gehen) return false;
    const [sH, sM] = kommen.split(':').map(Number);
    const [eH, eM] = gehen.split(':').map(Number);
    return (eH * 60 + eM) < (sH * 60 + sM);
  })();

  const applyPreset = (preset: PresetShift) => {
    setKommen(preset.kommen);
    setGehen(preset.gehen);
    setPauseMinuten(preset.pauseMinuten);
    setSchichtTyp(preset.name);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kommen || !gehen) return;

    const entry: ShiftEntry = {
      datum: selectedDate,
      kommen,
      gehen,
      pauseMinuten: Number(pauseMinuten) || 0,
      nettoStunden,
      schichtTyp
    };

    onSaveShift(entry);
  };

  return (
    <div className="bg-white/[0.04] backdrop-blur-xl rounded-3xl p-5 border border-white/10 shadow-2xl transition-all">
      <form onSubmit={handleSave} className="space-y-4">
        {/* Datumswahl & Feiertags-Badge */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Datum der Schicht
            </label>
            {dayInfo.isHoliday && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                🎉 {dayInfo.holidayName}
              </span>
            )}
            {!dayInfo.isHoliday && dayInfo.isSunday && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                ☀️ Sonntag
              </span>
            )}
            {!dayInfo.isHoliday && dayInfo.isSaturday && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                📅 Samstag (13–21h Bonus)
              </span>
            )}
          </div>

          <input
            type="date"
            value={selectedDate}
            onChange={e => e.target.value && onDateChange(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl bg-black/40 border border-white/10 text-white font-semibold text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all"
          />

          {dayInfo.bonusHint && (
            <p className="text-[11px] font-semibold text-cyan-300 mt-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              {dayInfo.bonusHint}
            </p>
          )}
        </div>

        {/* Schnell-Vorlagen (Presets) */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Schnell-Vorlagen (Presets)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {presets.map(p => {
              const isSelected = schichtTyp === p.name && kommen === p.kommen && gehen === p.gehen;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`flex flex-col items-start p-2.5 rounded-2xl border text-left transition-all duration-200 active:scale-95 ${
                    isSelected
                      ? 'bg-gradient-to-tr from-violet-600/30 to-cyan-500/30 border-cyan-500/50 text-cyan-200 shadow-md ring-1 ring-cyan-500/40'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <span className="text-base">{p.icon}</span>
                    <span className="text-xs font-bold truncate">{p.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 font-medium">
                    {p.kommen}–{p.gehen} ({p.pauseMinuten}m)
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Zeiteingabe Kommen & Gehen */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Kommen
            </label>
            <input
              type="time"
              value={kommen}
              onChange={e => setKommen(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-black/40 border border-white/10 text-white font-bold text-base focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Gehen
            </label>
            <input
              type="time"
              value={gehen}
              onChange={e => setGehen(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-black/40 border border-white/10 text-white font-bold text-base focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all"
              required
            />
          </div>
        </div>

        {/* Pause & Live-Netto Vorschau */}
        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Pause (Minuten)
            </label>
            <input
              type="number"
              min="0"
              step="5"
              value={pauseMinuten}
              onChange={e => setPauseMinuten(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-black/40 border border-white/10 text-white font-bold text-base focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all"
            />
          </div>

          <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Netto-Arbeitszeit
            </span>
            <span className="font-display text-base font-black text-cyan-300">
              {nettoStunden.toFixed(2)} h
            </span>
          </div>
        </div>

        {/* Nachtdienst-Hinweis */}
        {isOvernight && (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
            <Moon className="w-4 h-4 shrink-0 text-indigo-400" />
            <span>Nachtdienst über Mitternacht erkannt ({kommen} bis {gehen} Uhr).</span>
          </div>
        )}

        {/* Aktions-Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 active:scale-98 text-white font-bold text-sm shadow-lg shadow-violet-500/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            {existingShift ? 'Schicht aktualisieren' : 'Schicht speichern'}
          </button>

          {existingShift && (
            <button
              type="button"
              onClick={() => onDeleteShift(selectedDate)}
              className="p-3.5 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all active:scale-90"
              title="Schicht für diesen Tag löschen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
