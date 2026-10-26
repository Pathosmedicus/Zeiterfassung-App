import React, { useState } from 'react';
import { Sparkles, User, Briefcase, Coins, ShieldCheck, ArrowRight } from 'lucide-react';
import { UserProfile, SalaryConfig } from '../../types';
import { DEFAULT_SALARY_CONFIG } from '../../services/storageService';

interface OnboardingModalProps {
  initialName?: string;
  onComplete: (profile: UserProfile, salaryConfig: SalaryConfig) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  initialName = '',
  onComplete
}) => {
  const parts = initialName.trim().split(' ');
  const defaultVorname = parts.length > 1 ? parts[0] : '';
  const defaultNachname = parts.length > 1 ? parts.slice(1).join(' ') : initialName;

  const [vorname, setVorname] = useState(defaultVorname);
  const [nachname, setNachname] = useState(defaultNachname);
  const [personalnummer, setPersonalnummer] = useState('');
  const [abteilung, setAbteilung] = useState('Radiologie');
  const [klinik, setKlinik] = useState('Klinikum Minden');

  // Vergütungsmodell
  const [wageModel, setWageModel] = useState<'tvoed' | 'custom'>('tvoed');
  const [customWage, setCustomWage] = useState<number>(18.90);
  const [annualLimit, setAnnualLimit] = useState<number>(7230);
  const [baseHours, setBaseHours] = useState<number>(5.00);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const profile: UserProfile = {
      vorname: vorname.trim(),
      name: nachname.trim(),
      personalnummer: personalnummer.trim(),
      abteilung: abteilung.trim() || 'Radiologie',
      klinik: klinik.trim() || 'Klinikum Minden'
    };

    let salaryConfig: SalaryConfig = { ...DEFAULT_SALARY_CONFIG };

    if (wageModel === 'custom') {
      const wage = Number(customWage) || 18.90;
      salaryConfig = {
        ...DEFAULT_SALARY_CONFIG,
        baseOld: wage,
        baseMid: wage,
        baseNew: wage,
        baseHours: Number(baseHours) || 5.00,
        annualLimit: Number(annualLimit) || 7230
      };
    } else {
      salaryConfig = {
        ...DEFAULT_SALARY_CONFIG,
        baseHours: Number(baseHours) || 5.00,
        annualLimit: Number(annualLimit) || 7230
      };
    }

    onComplete(profile, salaryConfig);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-[#0c101d] border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-slate-100">
        {/* Glow-Hintergrund */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-500/20 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white font-display tracking-tight flex items-center gap-2">
                <span>Willkommen im Team!</span>
              </h2>
              <p className="text-xs text-cyan-300 font-medium">
                Dein persönlicher Arbeitsbereich startet mit 0 Stunden
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Stammdaten */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span>1. Persönliche Angaben (Stundenzettel-Kopf)</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Vorname</label>
                  <input
                    type="text"
                    value={vorname}
                    onChange={e => setVorname(e.target.value)}
                    placeholder="z. B. Anna"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Nachname</label>
                  <input
                    type="text"
                    value={nachname}
                    onChange={e => setNachname(e.target.value)}
                    placeholder="z. B. Müller"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Abteilung</label>
                  <input
                    type="text"
                    value={abteilung}
                    onChange={e => setAbteilung(e.target.value)}
                    placeholder="Radiologie"
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Personalnr. (optional)</label>
                  <input
                    type="text"
                    value={personalnummer}
                    onChange={e => setPersonalnummer(e.target.value)}
                    placeholder="z. B. 123456"
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 2. Tarif & Stundensatz */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                <span>2. Vergütung & Stundensatz</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setWageModel('tvoed')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    wageModel === 'tvoed'
                      ? 'bg-cyan-500/15 border-cyan-400 text-white font-bold'
                      : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-cyan-300">TVöD-K EG 03</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">17,16 € / 17,64 € / 18,90 €</div>
                </button>

                <button
                  type="button"
                  onClick={() => setWageModel('custom')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    wageModel === 'custom'
                      ? 'bg-cyan-500/15 border-cyan-400 text-white font-bold'
                      : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-cyan-300">Freier Stundensatz</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Eigener Basislohn</div>
                </button>
              </div>

              {wageModel === 'custom' && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Individueller Stundenlohn (€/h)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={customWage}
                    onChange={e => setCustomWage(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-cyan-400"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Vertragl. Grundstunden/Monat</label>
                  <input
                    type="number"
                    step="0.5"
                    value={baseHours}
                    onChange={e => setBaseHours(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Jahresgrenze (€/Jahr)</label>
                  <input
                    type="number"
                    step="10"
                    value={annualLimit}
                    onChange={e => setAnnualLimit(parseFloat(e.target.value) || 7230)}
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            </div>

            {/* Datenschutz-Hinweis */}
            <div className="flex items-center gap-2 px-1 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Strikte Datentrennung: Dein Arbeitsbereich ist vollkommen isoliert und privat.</span>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>🚀 Arbeitsbereich starten (0 Stunden)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
