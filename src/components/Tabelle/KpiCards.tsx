import React from 'react';
import { Clock, CalendarCheck, Coins, TrendingUp, ShieldCheck } from 'lucide-react';
import { MonthSalaryStats, SalaryConfig } from '../../types';

interface KpiCardsProps {
  stats: MonthSalaryStats;
  salaryConfig: SalaryConfig;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ stats, salaryConfig }) => {
  const limit = salaryConfig.minijobLimit || 603;
  const progressPercent = Math.min(100, Math.round((stats.erwartetesNetto / limit) * 100));
  const remainingEur = Math.max(0, limit - stats.erwartetesNetto);
  const remainingHours = stats.activeBaseWage > 0 ? (remainingEur / stats.activeBaseWage).toFixed(1) : '0';

  const isExceeded = stats.erwartetesNetto > limit;
  const isClose = progressPercent >= 90 && !isExceeded;

  return (
    <div className="space-y-3.5">
      {/* 3 Primäre Quick KPI Kacheln - Modern Glassmorphism */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <div className="bg-white/[0.04] backdrop-blur-xl rounded-3xl p-3.5 sm:p-4 border border-white/10 shadow-xl text-center relative overflow-hidden group">
          <div className="w-8 h-8 mx-auto rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-2 shadow-md">
            <Clock className="w-4 h-4" />
          </div>
          <div className="font-display text-xl md:text-2xl font-black text-white">
            {stats.gesamtDezimal.toFixed(2)}
            <span className="text-xs font-semibold text-slate-400 ml-0.5">h</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1 block">
            Gesamtstunden
          </span>
        </div>

        <div className="bg-white/[0.04] backdrop-blur-xl rounded-3xl p-3.5 sm:p-4 border border-white/10 shadow-xl text-center relative overflow-hidden group">
          <div className="w-8 h-8 mx-auto rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 mb-2 shadow-md">
            <CalendarCheck className="w-4 h-4" />
          </div>
          <div className="font-display text-xl md:text-2xl font-black text-white">
            {stats.anzahlDienste}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1 block">
            Dienste
          </span>
        </div>

        <div className="bg-white/[0.04] backdrop-blur-xl rounded-3xl p-3.5 sm:p-4 border border-white/10 shadow-xl text-center relative overflow-hidden group">
          <div className="w-8 h-8 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2 shadow-md">
            <Coins className="w-4 h-4" />
          </div>
          <div className="font-display text-xl md:text-2xl font-black text-emerald-300">
            {stats.erwartetesNetto.toFixed(2)}
            <span className="text-xs font-semibold text-emerald-400/80 ml-0.5">€</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1 block">
            Leistungswert
          </span>
        </div>
      </div>

      {/* Detaillierte Lohn- & Zuschlagsaufschlüsselung */}
      <div className="bg-white/[0.04] backdrop-blur-xl rounded-3xl p-5 border border-white/10 shadow-2xl space-y-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-200">
              Leistungswert des Monats (Erarbeitetes Netto)
            </h3>
          </div>
          <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
            {stats.tariffName} ({stats.activeBaseWage.toFixed(2)} €/h)
          </span>
        </div>

        <div className="space-y-2 text-xs">
          {/* LA 200: 5.00h Grundvergütung */}
          <div className="flex items-center justify-between py-1.5 border-b border-white/5 text-slate-300">
            <span>Feste Grundvergütung (LA 200, 5,00 Std.):</span>
            <span className="font-semibold text-white font-mono">
              {stats.grundLohnLA200.toFixed(2)} €
            </span>
          </div>

          {/* LA 208: Mehrstunden */}
          {stats.mehrStunden > 0 && (
            <div className="flex items-center justify-between py-1.5 border-b border-white/5 text-slate-300">
              <span>Aushilfsstunden / Mehrstunden (LA 208, {stats.mehrStunden.toFixed(2)} h):</span>
              <span className="font-semibold text-white font-mono">
                + {stats.mehrLohnLA208.toFixed(2)} €
              </span>
            </div>
          )}

          {/* LA 362: Sonntagszuschlag */}
          <div className="flex items-center justify-between py-1.5 border-b border-white/5 text-slate-300">
            <span>
              Sonn- / Feiertagszuschlag (LA 362, {stats.sonntagStunden.toFixed(2)} h):
              <span className="text-[10px] text-emerald-400 font-semibold ml-1">
                (steuer- & VBL-frei)
              </span>
            </span>
            <span className="font-semibold text-cyan-300 font-mono">
              + {stats.sonntagLohn.toFixed(2)} €
            </span>
          </div>

          {/* LA 332: Samstagszuschlag 13-21h */}
          <div className="flex items-center justify-between py-1.5 border-b border-white/5 text-slate-300">
            <span>
              Samstagszuschlag 13–21 Uhr (LA 332, {stats.samstagBonusStunden.toFixed(2)} h):
              <span className="text-[10px] text-slate-400 font-semibold ml-1">
                (VBL-pflichtig)
              </span>
            </span>
            <span className="font-semibold text-cyan-300 font-mono">
              + {stats.samstagLohn.toFixed(2)} €
            </span>
          </div>

          {/* LA 360: Nachtzuschlag */}
          {stats.nachtStunden > 0 && (
            <div className="flex items-center justify-between py-1.5 border-b border-white/5 text-slate-300">
              <span>
                Nachtzuschlag (LA 360, {stats.nachtStunden.toFixed(2)} h):
                <span className="text-[10px] text-emerald-400 font-semibold ml-1">
                  (steuer- & VBL-frei)
                </span>
              </span>
              <span className="font-semibold text-cyan-300 font-mono">
                + {stats.nachtLohn.toFixed(2)} €
              </span>
            </div>
          )}

          {/* VBL-Brutto & Abzug */}
          <div className="flex items-center justify-between py-1.5 border-b border-white/5 text-rose-300">
            <span>
              VBL-Arbeitnehmeranteil ZVA (1,81 % auf VBL-Brutto {stats.vblBrutto.toFixed(2)} €):
            </span>
            <span className="font-semibold font-mono">
              - {stats.vblAbzug.toFixed(2)} €
            </span>
          </div>

          {/* Leistungswert Netto */}
          <div className="flex items-center justify-between pt-2 text-sm font-bold">
            <div>
              <span className="text-white block">Erarbeiteter Leistungswert:</span>
              <span className="text-[10px] text-slate-400 font-normal">
                (Wird per 3-Stufen-Versatz in Folgemonaten auf Ihr Bankkonto ausgezahlt)
              </span>
            </div>
            <span className="font-display text-emerald-300 text-lg">
              {stats.erwartetesNetto.toFixed(2)} €
            </span>
          </div>
        </div>

        {/* Minijob-Grenze Fortschrittsbalken */}
        <div className="mt-4 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-2">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              Minijob-Limit ({limit} € Netto)
            </span>
            <span className={isExceeded ? 'text-rose-400 font-bold' : isClose ? 'text-amber-400 font-bold' : 'text-slate-300'}>
              {progressPercent}%
            </span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isExceeded
                  ? 'bg-rose-500'
                  : isClose
                  ? 'bg-amber-400'
                  : 'bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 font-medium">
            <span>Verdient: {stats.erwartetesNetto.toFixed(2)} €</span>
            <span>
              {isExceeded ? (
                <span className="text-rose-400 font-semibold">Limit überschritten</span>
              ) : (
                <span>Übrig: {remainingEur.toFixed(2)} € (ca. {remainingHours}h)</span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KpiCards;
