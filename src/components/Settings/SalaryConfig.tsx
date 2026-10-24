import React, { useState } from 'react';
import { Coins, Check, Clock, Percent } from 'lucide-react';
import { SalaryConfig as SalaryConfigType } from '../../types';

interface SalaryConfigProps {
  salaryConfig: SalaryConfigType;
  onSaveSalaryConfig: (config: SalaryConfigType) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const SalaryConfig: React.FC<SalaryConfigProps> = ({
  salaryConfig,
  onSaveSalaryConfig,
  onShowToast
}) => {
  const [baseOld, setBaseOld] = useState<number>(salaryConfig.baseOld || 17.16);
  const [baseMid, setBaseMid] = useState<number>(salaryConfig.baseMid || 17.64);
  const [baseNew, setBaseNew] = useState<number>(salaryConfig.baseNew || 18.90);
  const [baseHours, setBaseHours] = useState<number>(salaryConfig.baseHours || 5.00);
  const [vblPercent, setVblPercent] = useState<number>(salaryConfig.vblPercent || 1.81);
  const [sunRateOld, setSunRateOld] = useState<number>(salaryConfig.sunRateOld || 4.67);
  const [sunRateNew, setSunRateNew] = useState<number>(salaryConfig.sunRateNew || 4.80);
  const [satRate, setSatRate] = useState<number>(salaryConfig.satRate || 0.64);
  const [nightRate, setNightRate] = useState<number>(salaryConfig.nightRate || 3.74);
  const [minijobLimit, setMinijobLimit] = useState<number>(salaryConfig.minijobLimit || 603);
  const [annualLimit, setAnnualLimit] = useState<number>(salaryConfig.annualLimit || 7230);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: SalaryConfigType = {
      ...salaryConfig,
      baseOld: Number(baseOld) || 17.16,
      baseMid: Number(baseMid) || 17.64,
      baseNew: Number(baseNew) || 18.90,
      baseHours: Number(baseHours) || 5.00,
      vblPercent: Number(vblPercent) || 1.81,
      sunRateOld: Number(sunRateOld) || 4.67,
      sunRateNew: Number(sunRateNew) || 4.80,
      satRate: Number(satRate) || 0.64,
      nightRate: Number(nightRate) || 3.74,
      minijobLimit: Number(minijobLimit) || 603,
      annualLimit: Number(annualLimit) || 7230
    };
    onSaveSalaryConfig(updated);
    onShowToast('✅ TVöD-K EG 03 Lohn- und Tarifeinstellungen gespeichert!', 'success');
  };

  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden group space-y-4">
      {/* Ambient glow */}
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/15 transition-all duration-700" />

      <div className="flex items-center gap-3 relative z-10">
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
          <Coins className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide font-display">
            Tarif- & Stundensätze (TVöD-K EG 03 Klinikum Minden)
          </h3>
          <p className="text-[11px] text-slate-400">
            Zeitabhängige Stundensätze, Grundvertrag & 3-Stufen-Versatz
          </p>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed bg-white/[0.02] p-3 rounded-2xl border border-white/5 relative z-10">
        💡 Die Abrechnung erfolgt nach den realen Mühlenkreiskliniken-Regeln: 5,00 Std. Grundvertrag (LA 200), Aushilfsstunden aus Vormonat (LA 208) und Zeitzuschläge aus Vor-Vormonat (M-2) mit exakt 1,81 % VBL-Arbeitnehmerabzug.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
        {/* 1. Stufen-Stundenlöhne */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span>Zeitabhängige Basis-Stundenlöhne (€/h)</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <span className="text-[9px] text-slate-400 block">Bis 30.04.2026 (Stufe 1):</span>
              <input
                type="number"
                step="0.01"
                value={baseOld}
                onChange={e => setBaseOld(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2.5 rounded-2xl bg-black/40 border border-white/10 text-white text-xs font-bold text-center focus:outline-none focus:border-cyan-400/60 transition-all"
                required
              />
              <span className="text-[9px] text-slate-400 block text-center mt-0.5">5h Grund: 85,80 €</span>
            </div>

            <div>
              <span className="text-[9px] text-slate-400 block">01.05. – 31.07.2026 (Erhöhung):</span>
              <input
                type="number"
                step="0.01"
                value={baseMid}
                onChange={e => setBaseMid(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2.5 rounded-2xl bg-black/40 border border-white/10 text-white text-xs font-bold text-center focus:outline-none focus:border-cyan-400/60 transition-all"
                required
              />
              <span className="text-[9px] text-slate-400 block text-center mt-0.5">5h Grund: 88,21 €</span>
            </div>

            <div>
              <span className="text-[9px] text-slate-400 block">Ab 01.08.2026 (Stufe 2):</span>
              <input
                type="number"
                step="0.01"
                value={baseNew}
                onChange={e => setBaseNew(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2.5 rounded-2xl bg-black/40 border border-white/10 text-emerald-400 text-xs font-bold text-center focus:outline-none focus:border-emerald-400/60 transition-all"
                required
              />
              <span className="text-[9px] text-slate-400 block text-center mt-0.5">5h Grund: 94,51 €</span>
            </div>
          </div>
        </div>

        {/* 2. Zeitzuschläge & VBL */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1">
            <Percent className="w-3 h-3 text-purple-400" />
            <span>Zeitzuschläge (€/h) & VBL-Abzug</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <span className="text-[9px] text-slate-400 block">So-Zuschlag alt:</span>
              <input
                type="number"
                step="0.01"
                value={sunRateOld}
                onChange={e => setSunRateOld(parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold text-center"
                required
              />
              <span className="text-[8px] text-emerald-400 block text-center mt-0.5">0% Steuer/VBL</span>
            </div>

            <div>
              <span className="text-[9px] text-slate-400 block">So-Zuschlag neu:</span>
              <input
                type="number"
                step="0.01"
                value={sunRateNew}
                onChange={e => setSunRateNew(parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold text-center"
                required
              />
              <span className="text-[8px] text-emerald-400 block text-center mt-0.5">0% Steuer/VBL</span>
            </div>

            <div>
              <span className="text-[9px] text-slate-400 block">Sa (13–21h):</span>
              <input
                type="number"
                step="0.01"
                value={satRate}
                onChange={e => setSatRate(parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold text-center"
                required
              />
              <span className="text-[8px] text-rose-400 block text-center mt-0.5">VBL-pflichtig</span>
            </div>

            <div>
              <span className="text-[9px] text-slate-400 block">Nacht (LA 360):</span>
              <input
                type="number"
                step="0.01"
                value={nightRate}
                onChange={e => setNightRate(parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold text-center"
                required
              />
              <span className="text-[8px] text-emerald-400 block text-center mt-0.5">0% Steuer/VBL</span>
            </div>
          </div>
        </div>

        {/* 3. Grundvertrag & VBL-Prozentsatz */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Grundvertrag Std./Monat (LA 200)
            </label>
            <input
              type="number"
              step="0.1"
              value={baseHours}
              onChange={e => setBaseHours(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold text-center"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              VBL ZVA Arbeitnehmeranteil (%)
            </label>
            <input
              type="number"
              step="0.01"
              value={vblPercent}
              onChange={e => setVblPercent(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold text-center"
              required
            />
          </div>
        </div>

        {/* 4. Minijob-Grenzen */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Monats-Limit Netto (€)
            </label>
            <input
              type="number"
              step="1"
              value={minijobLimit}
              onChange={e => setMinijobLimit(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-2.5 rounded-2xl bg-black/40 border border-white/10 text-white text-xs font-bold text-center"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Jahres-Limit Netto (€)
            </label>
            <input
              type="number"
              step="1"
              value={annualLimit}
              onChange={e => setAnnualLimit(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-2.5 rounded-2xl bg-black/40 border border-white/10 text-white text-xs font-bold text-center"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-display font-bold text-xs shadow-xl shadow-emerald-500/20 active:scale-98 transition-all"
        >
          <Check className="w-4 h-4" />
          <span>Tarif-Einstellungen speichern</span>
        </button>
      </form>
    </div>
  );
};

export default SalaryConfig;
