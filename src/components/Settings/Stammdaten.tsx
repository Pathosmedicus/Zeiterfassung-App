import React, { useState } from 'react';
import { User, Building2, Hash, Check } from 'lucide-react';
import { UserProfile } from '../../types';

interface StammdatenProps {
  userProfile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const Stammdaten: React.FC<StammdatenProps> = ({
  userProfile,
  onSaveProfile,
  onShowToast
}) => {
  const [vorname, setVorname] = useState(userProfile.vorname);
  const [name, setName] = useState(userProfile.name);
  const [personalnummer, setPersonalnummer] = useState(userProfile.personalnummer);
  const [abteilung, setAbteilung] = useState(userProfile.abteilung);
  const [klinik, setKlinik] = useState(userProfile.klinik);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      vorname: vorname.trim(),
      name: name.trim(),
      personalnummer: personalnummer.trim(),
      abteilung: abteilung.trim(),
      klinik: klinik.trim()
    };
    onSaveProfile(updated);
    onShowToast('✅ Stammdaten erfolgreich gespeichert!', 'success');
  };

  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden group space-y-4">
      {/* Ambient glow */}
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/15 transition-all duration-700" />

      <div className="flex items-center gap-3 relative z-10">
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
          <User className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide font-display">
            Persönliche Stammdaten (Stundenzettel-Kopf)
          </h3>
          <p className="text-[11px] text-slate-400">
            Wird im Kopfbereich des offiziellen Stundenzettels gedruckt
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5 relative z-10">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Vorname
            </label>
            <input
              type="text"
              value={vorname}
              onChange={e => setVorname(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/50 transition-all"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Nachname
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/50 transition-all"
              required
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
            Personalnummer
          </label>
          <div className="relative">
            <input
              type="text"
              value={personalnummer}
              onChange={e => setPersonalnummer(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/50 transition-all font-mono"
              required
            />
            <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
            Abteilung / Institut
          </label>
          <div className="relative">
            <input
              type="text"
              value={abteilung}
              onChange={e => setAbteilung(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/50 transition-all"
            />
            <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
            Krankenhaus / Träger
          </label>
          <input
            type="text"
            value={klinik}
            onChange={e => setKlinik(e.target.value)}
            className="w-full px-4 py-2.5 rounded-2xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/50 transition-all"
          />
        </div>

        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 active:scale-98 transition-all pt-3"
        >
          <Check className="w-4 h-4" />
          <span>Stammdaten speichern</span>
        </button>
      </form>
    </div>
  );
};
