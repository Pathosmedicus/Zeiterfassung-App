import React, { useState } from 'react';
import { Layers, Plus, Trash2, Check } from 'lucide-react';
import { PresetShift } from '../../types';

interface PresetsConfigProps {
  presets: PresetShift[];
  onSavePresets: (presets: PresetShift[]) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const PresetsConfig: React.FC<PresetsConfigProps> = ({
  presets,
  onSavePresets,
  onShowToast
}) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('⏰');
  const [kommen, setKommen] = useState('08:00');
  const [gehen, setGehen] = useState('16:30');
  const [pauseMinuten, setPauseMinuten] = useState(30);

  const handleAddPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newPreset: PresetShift = {
      id: `custom_${Date.now()}`,
      name: name.trim(),
      icon: icon || '⏰',
      kommen,
      gehen,
      pauseMinuten: Number(pauseMinuten) || 0,
      description: `${kommen} – ${gehen}`
    };

    const updated = [...presets, newPreset];
    onSavePresets(updated);
    setName('');
    onShowToast(`Vorlage "${newPreset.name}" hinzugefügt!`, 'success');
  };

  const handleDeletePreset = (id: string) => {
    const updated = presets.filter(p => p.id !== id);
    onSavePresets(updated);
    onShowToast('Vorlage gelöscht.', 'info');
  };

  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden group space-y-4">
      {/* Ambient glow */}
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/15 transition-all duration-700" />

      <div className="flex items-center gap-3 relative z-10">
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
          <Layers className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide font-display">
            Schicht-Vorlagen (Presets)
          </h3>
          <p className="text-[11px] text-slate-400">
            Schnellwahl-Buttons für deine Standardarbeitszeiten
          </p>
        </div>
      </div>

      {/* Vorhandene Vorlagen */}
      <div className="space-y-2 relative z-10">
        {presets.map(p => (
          <div
            key={p.id}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl p-2 rounded-xl bg-white/5 border border-white/10">{p.icon}</span>
              <div>
                <span className="text-xs font-bold text-white block">
                  {p.name}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {p.kommen} – {p.gehen} <span className="text-cyan-400">({p.pauseMinuten} min Pause)</span>
                </span>
              </div>
            </div>

            {presets.length > 2 && (
              <button
                type="button"
                onClick={() => handleDeletePreset(p.id)}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Vorlage entfernen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Neue Vorlage hinzufügen */}
      <form onSubmit={handleAddPreset} className="pt-4 border-t border-white/10 space-y-3 relative z-10">
        <span className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
          Neue Vorlage erstellen
        </span>

        <div className="grid grid-cols-4 gap-2">
          <div className="col-span-1">
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
              Icon
            </label>
            <input
              type="text"
              value={icon}
              onChange={e => setIcon(e.target.value)}
              className="w-full text-center px-2 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/60"
              placeholder="Icon"
            />
          </div>

          <div className="col-span-3">
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
              Bezeichnung
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="z.B. Bereitschaftsdienst"
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:border-cyan-400/60"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
              Kommen
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9:]*"
              placeholder="08:00"
              value={kommen}
              onChange={e => setKommen(e.target.value)}
              className="w-full px-2 py-1.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold text-center focus:outline-none focus:border-cyan-400/60"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
              Gehen
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9:]*"
              placeholder="16:30"
              value={gehen}
              onChange={e => setGehen(e.target.value)}
              className="w-full px-2 py-1.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold text-center focus:outline-none focus:border-cyan-400/60"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
              Pause (m)
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="30"
              value={pauseMinuten}
              onChange={e => setPauseMinuten(parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)}
              className="w-full px-2 py-1.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold text-center focus:outline-none focus:border-cyan-400/60"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 active:scale-98 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Vorlage hinzufügen</span>
        </button>
      </form>
    </div>
  );
};
