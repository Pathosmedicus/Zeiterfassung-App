import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  Info,
  Sliders,
  Zap,
  HelpCircle,
  SunMedium,
  Moon,
  Coins
} from 'lucide-react';
import { ShiftEntry, SalaryConfig, UserProfile } from '../../types';
import { calculateMonthSalary, getTariffForMonth } from '../../services/salaryEngine';
import { getHistoricalRecords, formatMonthLabel } from '../../services/clinicPayrollEngine';

interface MinijobJahresradarProps {
  shifts: ShiftEntry[];
  salaryConfig: SalaryConfig;
  userProfile: UserProfile;
  currentYearMonth: string;
  onSaveSalaryConfig: (config: SalaryConfig) => void;
  onSelectMonth?: (yearMonth: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lastSyncTime?: Date | null;
  onManualSync?: () => void;
  isSyncing?: boolean;
}

const MONTH_NAMES_FULL = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

export const MinijobJahresradar: React.FC<MinijobJahresradarProps> = ({
  shifts,
  salaryConfig,
  currentYearMonth,
  onSaveSalaryConfig,
  onSelectMonth,
  onShowToast,
  lastSyncTime,
  onManualSync,
  isSyncing
}) => {
  // Ausgewähltes Jahr (Standard aus currentYearMonth, z.B. 2026)
  const initialYear = parseInt(currentYearMonth.split('-')[0], 10) || 2026;
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);

  // Konfigurierbare Jahresgrenze (Standard: 7.230,00 €)
  const effectiveAnnualLimit = salaryConfig.annualLimit || 7230;
  const [customLimitInput, setCustomLimitInput] = useState<string>(effectiveAnnualLimit.toString());
  const [isEditingLimit, setIsEditingLimit] = useState(false);

  // Interaktiver Stundensimulator
  const [simExtraHours, setSimExtraHours] = useState<number>(0);

  // Aktueller Monat im Kalender
  const now = new Date();
  const currentActualYear = now.getFullYear();
  const currentActualMonth = now.getMonth() + 1; // 1-12

  // 1. Berechnung für alle 12 Monate des ausgewählten Jahres
  const yearData = useMemo(() => {
    const months = [];
    let cumulativeGrundlohn = 0;
    let sumGrundlohn = 0;
    let sumSonntagLohn = 0;
    let sumNachtLohn = 0;
    let sumSamstagLohn = 0;
    let sumNetto = 0;
    let sumStunden = 0;

    for (let m = 1; m <= 12; m++) {
      const ym = `${selectedYear}-${String(m).padStart(2, '0')}`;
      const statsM = calculateMonthSalary(selectedYear, m, shifts, salaryConfig);
      const hist = getHistoricalRecords().find(h => h.yearMonth === ym);
      const tariff = getTariffForMonth(selectedYear, m, salaryConfig);

      let stunden = statsM.gesamtDezimal;
      let grundlohn = statsM.basisLohn;
      let sonntagLohn = statsM.sonntagLohn;
      let nachtLohn = statsM.nachtLohn;
      let samstagLohn = statsM.samstagLohn;
      let netto = statsM.erwartetesNetto;
      let isHistorical = false;

      // Falls keine manuellen Schichten eingetragen sind, aber historische Abrechnungsdaten existieren
      if (stunden === 0 && hist && hist.gesamtStunden > 0) {
        stunden = hist.gesamtStunden;
        grundlohn = Math.round(stunden * tariff.hourlyWage * 100) / 100;
        sonntagLohn = Math.round((hist.sonntagStunden || 0) * tariff.sundayBonus * 100) / 100;
        samstagLohn = Math.round((hist.samstagStunden || 0) * tariff.saturdayBonus * 100) / 100;
        nachtLohn = Math.round((hist.nachtStunden || 0) * tariff.nightBonus * 100) / 100;
        const vblBrutto = Math.round((grundlohn + samstagLohn) * 100) / 100;
        const vblAbzug = Math.round(vblBrutto * (tariff.vblPercent / 100) * 100) / 100;
        netto = Math.round((vblBrutto - vblAbzug + sonntagLohn + nachtLohn) * 100) / 100;
        isHistorical = true;
      }

      // SFN-Zuschläge (§ 3b EStG: steuer- und sozialversicherungsfrei)
      const sfnZuschlaege = Math.round((sonntagLohn + nachtLohn) * 100) / 100;

      cumulativeGrundlohn += grundlohn;
      sumGrundlohn += grundlohn;
      sumSonntagLohn += sonntagLohn;
      sumNachtLohn += nachtLohn;
      sumSamstagLohn += samstagLohn;
      sumNetto += netto;
      sumStunden += stunden;

      // Status für diesen Monat
      let status: 'done' | 'current' | 'future' = 'future';
      if (selectedYear < currentActualYear || (selectedYear === currentActualYear && m < currentActualMonth)) {
        status = 'done';
      } else if (selectedYear === currentActualYear && m === currentActualMonth) {
        status = 'current';
      }

      months.push({
        month: m,
        yearMonth: ym,
        monthName: MONTH_NAMES_FULL[m - 1],
        shortLabel: formatMonthLabel(selectedYear, m),
        stunden,
        grundlohn,
        sonntagLohn,
        samstagLohn,
        nachtLohn,
        sfnZuschlaege,
        netto,
        cumulativeGrundlohn: Math.round(cumulativeGrundlohn * 100) / 100,
        isHistorical,
        tariff,
        status
      });
    }

    const totalSfn = Math.round((sumSonntagLohn + sumNachtLohn) * 100) / 100;

    return {
      months,
      sumStunden: Math.round(sumStunden * 100) / 100,
      sumGrundlohn: Math.round(sumGrundlohn * 100) / 100,
      sumSonntagLohn: Math.round(sumSonntagLohn * 100) / 100,
      sumNachtLohn: Math.round(sumNachtLohn * 100) / 100,
      sumSamstagLohn: Math.round(sumSamstagLohn * 100) / 100,
      totalSfn,
      sumNetto: Math.round(sumNetto * 100) / 100
    };
  }, [selectedYear, shifts, salaryConfig, currentActualYear, currentActualMonth]);

  // 2. Aktiver Stundenlohn für die Reststunden-Berechnung
  const activeTariff = getTariffForMonth(
    selectedYear,
    selectedYear === currentActualYear ? currentActualMonth : 12,
    salaryConfig
  );
  const activeWage = activeTariff.hourlyWage;

  // 3. Restbudget & Stunden-Berechnung
  const limit = effectiveAnnualLimit;
  const anrechenbarBisher = yearData.sumGrundlohn;
  const restBudget = Math.max(0, Math.round((limit - anrechenbarBisher) * 100) / 100);
  const auslastungProzent = Math.min(100, Math.round((anrechenbarBisher / limit) * 1000) / 10);

  // Verbleibende Reststunden im Jahr
  const gesamtReststunden = activeWage > 0
    ? Math.max(0, Math.round((restBudget / activeWage) * 100) / 100)
    : 0;

  // Verbleibende Monate für dieses Jahr (inkl. laufender Monat)
  const remainingMonthsCount = selectedYear > currentActualYear
    ? 12
    : selectedYear < currentActualYear
      ? 0
      : Math.max(1, 12 - currentActualMonth + 1);

  const restStundenProMonat = remainingMonthsCount > 0
    ? Math.round((gesamtReststunden / remainingMonthsCount) * 100) / 100
    : 0;

  // 4. SFN-Booster Mehrwert-Berechnung
  const boosterSundayBonus = Math.round(gesamtReststunden * activeTariff.sundayBonus * 100) / 100;
  const boosterNightBonus = Math.round(gesamtReststunden * activeTariff.nightBonus * 100) / 100;
  const boosterComboBonus = Math.round(gesamtReststunden * (activeTariff.sundayBonus + activeTariff.nightBonus) * 100) / 100;

  // Farbschema für Auslastung
  const getProgressColor = (pct: number) => {
    if (pct < 75) return 'from-emerald-500 to-teal-400';
    if (pct < 90) return 'from-amber-500 to-yellow-400';
    return 'from-rose-500 to-red-600';
  };

  const getStatusBadge = (pct: number) => {
    if (pct < 75) {
      return {
        text: 'Grüner Bereich (Viel Puffer)',
        bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      };
    }
    if (pct < 92) {
      return {
        text: 'Optimale Auslastung',
        bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
      };
    }
    return {
      text: 'Achtung: Nahe der Grenze!',
      bg: 'bg-rose-500/15 text-rose-300 border-rose-500/30'
    };
  };

  const statusBadge = getStatusBadge(auslastungProzent);

  // Handler für Änderung der Jahresgrenze
  const handleSaveLimit = () => {
    const parsed = parseFloat(customLimitInput.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) {
      onShowToast('Bitte einen gültigen Betrag für die Jahresgrenze eingeben.', 'error');
      return;
    }
    const updated = {
      ...salaryConfig,
      annualLimit: parsed
    };
    onSaveSalaryConfig(updated);
    setIsEditingLimit(false);
    onShowToast(`🎯 Minijob-Jahresgrenze auf ${parsed.toFixed(2)} € aktualisiert!`, 'success');
  };

  const handleResetLimit = (standardValue: number = 7230) => {
    setCustomLimitInput(standardValue.toString());
    const updated = {
      ...salaryConfig,
      annualLimit: standardValue
    };
    onSaveSalaryConfig(updated);
    setIsEditingLimit(false);
    onShowToast(`Grenze auf Standard ${standardValue.toFixed(2)} € zurückgesetzt!`, 'info');
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. HERO COCKPIT CARD */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden group">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/15 transition-all duration-700" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-violet-500/15 transition-all duration-700" />

        <div className="relative z-10 space-y-4">
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-violet-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-wide font-display">
                    Minijob-Jahresradar ({limit.toLocaleString('de-DE', { minimumFractionDigits: 0 })} €)
                  </h2>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge.bg}`}>
                    {statusBadge.text}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Gesetzeskonforme Überwachung (§ 3b EStG & SvEV) • Kalenderjahr {selectedYear}
                </p>
              </div>
            </div>

            {/* Jahr-Auswahl & Sync-Button */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="flex p-0.5 rounded-xl bg-black/40 border border-white/10 text-xs font-bold">
                {[2025, 2026, 2027].map(yr => (
                  <button
                    key={yr}
                    onClick={() => setSelectedYear(yr)}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      selectedYear === yr
                        ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>

              {onManualSync && (
                <button
                  onClick={onManualSync}
                  disabled={isSyncing}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all active:scale-95 text-xs flex items-center gap-1.5"
                  title="Jetzt mit Cloud synchronisieren"
                >
                  <span className={isSyncing ? 'animate-spin inline-block' : ''}>🔄</span>
                  <span className="hidden sm:inline">Sync</span>
                </button>
              )}
            </div>
          </div>

          {/* Konfigurierbares Jahreslimit Panel */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-black/30 border border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300 font-semibold">Jahresfreibetrag:</span>
              {!isEditingLimit ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-cyan-300 font-mono">
                    {limit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                  </span>
                  <button
                    onClick={() => {
                      setCustomLimitInput(limit.toString());
                      setIsEditingLimit(true);
                    }}
                    className="text-[11px] text-cyan-400 hover:underline font-medium ml-1"
                  >
                    Anpassen
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="1"
                    value={customLimitInput}
                    onChange={e => setCustomLimitInput(e.target.value)}
                    className="w-28 px-2.5 py-1 rounded-xl bg-black/60 border border-cyan-500/50 text-white text-xs font-mono font-bold focus:outline-none"
                    placeholder="7230"
                    autoFocus
                  />
                  <span className="text-xs text-slate-300 font-bold">€</span>
                  <button
                    onClick={handleSaveLimit}
                    className="px-2.5 py-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-all"
                  >
                    OK
                  </button>
                  <button
                    onClick={() => setIsEditingLimit(false)}
                    className="px-2 py-1 rounded-xl bg-white/10 text-slate-300 text-xs font-bold"
                  >
                    ✕
                  </button>
                  <button
                    onClick={() => handleResetLimit(7230)}
                    className="text-[10px] text-slate-400 hover:text-cyan-300 underline ml-1"
                  >
                    Standard (7.230 €)
                  </button>
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-400">
              {lastSyncTime
                ? `☁️ Stand: ${lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Uhr`
                : '☁️ Cloud-Sync aktiv'}
            </div>
          </div>

          {/* Großer Fortschrittsbalken mit Auslastung */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                Auslastung Minijob-Budget:
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-black text-white font-mono">
                  {anrechenbarBisher.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  / {limit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                </span>
                <span className="text-xs font-bold text-cyan-300 font-mono ml-1">
                  ({auslastungProzent.toFixed(1)} %)
                </span>
              </div>
            </div>

            <div className="h-4 w-full bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${getProgressColor(
                  auslastungProzent
                )} transition-all duration-700 shadow-md`}
                style={{ width: `${Math.min(100, Math.max(2, auslastungProzent))}%` }}
              />
            </div>

            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span>0 €</span>
              <span>Halbzeit (3.615 €)</span>
              <span>Grenze ({limit.toLocaleString('de-DE', { minimumFractionDigits: 0 })} €)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. DIE 3 KERN-KENNZAHLEN NEBENEINANDER (GLASKLARE GESETZLICHE TRENNUNG) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* KARTE 1: Anrechenbarer Grundlohn */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                1. Anrechenbar (Grenze)
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                {auslastungProzent.toFixed(1)} %
              </span>
            </div>
            <div className="text-xl font-black text-white font-mono tracking-tight">
              {anrechenbarBisher.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              von {limit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} € regulärem Grundlohn (LA 200 + LA 208).
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/5 text-[10px] text-slate-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>Nur dieser Betrag zählt zur Grenze!</span>
          </div>
        </div>

        {/* KARTE 2: Steuerfreie SFN-Zuschläge (§ 3b EStG) */}
        <div className="bg-gradient-to-br from-emerald-950/20 via-white/[0.03] to-teal-950/20 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-4 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                2. Steuerfreie SFN-Zuschläge
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                § 3b EStG
              </span>
            </div>
            <div className="text-xl font-black text-emerald-300 font-mono tracking-tight">
              + {yearData.totalSfn.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
            <p className="text-[11px] text-emerald-200/80 leading-snug font-medium">
              Zählt <strong className="text-emerald-300 underline">NICHT</strong> zur 7.230-€-Grenze! (Sonn-, Feiertags- & Nachtzuschläge).
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-emerald-500/10 text-[10px] text-emerald-300/80 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>100 % steuer- und beitragsfreier Bonus</span>
          </div>
        </div>

        {/* KARTE 3: Gesamtes echtes Netto-Einkommen */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                3. Reales Jahres-Netto
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                Auszahlung
              </span>
            </div>
            <div className="text-xl font-black text-white font-mono tracking-tight">
              {yearData.sumNetto.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Tatsächlicher Verdienst (Grundlohn abzgl. 1,81 % VBL + alle steuerfreien Zuschläge).
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/5 text-[10px] text-slate-400 flex items-center gap-1">
            <Coins className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>Echtes Geld auf deinem Bankkonto</span>
          </div>
        </div>
      </div>

      {/* 3. INTELLIGENTER RESTBUDGET- & STUNDEN-RECHNER */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white tracking-wide font-display">
              Intelligenter Restbudget- & Stunden-Planer
            </h3>
            <p className="text-[11px] text-slate-400">
              Wie viele Stunden darfst du noch exakt arbeiten, ohne die {limit.toLocaleString('de-DE', { minimumFractionDigits: 0 })} € zu überschreiten?
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Restbudget */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Verbleibendes Freibetrags-Budget
            </span>
            <div className="text-xl font-black text-amber-300 font-mono">
              {restBudget.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
            </div>
            <p className="text-[10px] text-slate-400">
              Puffer bis zur {limit.toLocaleString('de-DE', { minimumFractionDigits: 0 })}-€-Grenze
            </p>
          </div>

          {/* Gesamt-Reststunden */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Gesamt-Reststunden im Jahr
            </span>
            <div className="text-xl font-black text-cyan-300 font-mono">
              {gesamtReststunden.toFixed(2)} Std.
            </div>
            <p className="text-[10px] text-slate-400">
              bei aktuellem Stundenlohn ({activeWage.toFixed(2)} €/h)
            </p>
          </div>

          {/* Schnitt pro verbleibendem Monat */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Erlaubt pro verbleibendem Monat
            </span>
            <div className="text-xl font-black text-emerald-300 font-mono">
              ~ {restStundenProMonat.toFixed(2)} Std. / Mo.
            </div>
            <p className="text-[10px] text-slate-400">
              aufgeteilt auf {remainingMonthsCount} verbleibende Monate
            </p>
          </div>
        </div>

        {/* Interaktiver Stunden-Simulator Slider */}
        <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              Schicht-Simulator: Geplante Zusatzstunden im Monat
            </span>
            <span className="font-mono font-bold text-cyan-300">
              + {simExtraHours} Std. ({((simExtraHours * activeWage)).toFixed(2)} €)
            </span>
          </div>
          <input
            type="range"
            min="0"
            max={Math.min(60, Math.ceil(gesamtReststunden) + 10)}
            step="1"
            value={simExtraHours}
            onChange={e => setSimExtraHours(parseInt(e.target.value, 10))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
          <div className="flex justify-between items-center text-[11px] text-slate-400">
            <span>
              Neuer Jahresgrundlohn:{' '}
              <strong className="text-white">
                {(anrechenbarBisher + simExtraHours * activeWage).toFixed(2)} €
              </strong>
            </span>
            <span className={anrechenbarBisher + simExtraHours * activeWage > limit ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
              {anrechenbarBisher + simExtraHours * activeWage > limit
                ? `⚠️ Überschreitung um ${(anrechenbarBisher + simExtraHours * activeWage - limit).toFixed(2)} €!`
                : `Verbleibender Puffer: ${(limit - (anrechenbarBisher + simExtraHours * activeWage)).toFixed(2)} €`}
            </span>
          </div>
        </div>
      </div>

      {/* 4. CLEVERE SCHICHT-EMPFEHLUNG (SFN-BOOSTER) */}
      <div className="bg-gradient-to-br from-violet-950/20 via-white/[0.03] to-cyan-950/20 backdrop-blur-xl border border-violet-500/20 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center text-cyan-300 shadow-lg shadow-violet-500/10">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide font-display">
                Clevere Schicht-Empfehlung (SFN-Booster)
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                Steuer-Tipp
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Maximiere dein echtes Netto-Einkommen, ohne dein 7.230-€-Budget zu belasten!
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed bg-black/30 p-3.5 rounded-2xl border border-white/5">
          💡 <strong>Der legale Minijob-Hebel (§ 3b EStG):</strong> Wenn du deine restlichen{' '}
          <strong className="text-cyan-300 font-mono">{gesamtReststunden.toFixed(2)} Stunden</strong> an Werktagen tagsüber arbeitest, erhältst du exakt{' '}
          <strong>{restBudget.toFixed(2)} €</strong>. Legst du diese Stunden jedoch auf{' '}
          <strong>Sonntage, Feiertage oder Nachtdienste</strong>, kommt der Zuschlag als{' '}
          <span className="text-emerald-400 font-bold">100 % steuer- und VBL-freier Bonus</span> oben drauf – ohne dass die 7.230-€-Grenze auch nur um 1 Cent belastet wird!
        </p>

        {/* 4 Szenarien Vergleichskarten */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Szenario 1: Sonntagsdienst */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-amber-500/20 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <SunMedium className="w-3.5 h-3.5 text-amber-400" />
                Sonntags-Booster
              </span>
              <span className="text-[10px] font-mono text-amber-400 font-bold">
                +4,80 € / h
              </span>
            </div>
            <div className="text-lg font-black text-amber-200 font-mono">
              + {boosterSundayBonus.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
            </div>
            <p className="text-[10px] text-slate-400">
              Steuerfreier Sonntagszuschlag bei voller Reststundennutzung.
            </p>
            <div className="pt-2 border-t border-white/5 text-[11px] font-semibold text-slate-200">
              Gesamtauszahlung:{' '}
              <span className="text-emerald-400 font-bold">
                {(restBudget + boosterSundayBonus).toFixed(2)} €
              </span>
            </div>
          </div>

          {/* Szenario 2: Nachtdienst */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-indigo-500/20 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                Nachtdienst-Booster
              </span>
              <span className="text-[10px] font-mono text-indigo-400 font-bold">
                +3,74 € / h
              </span>
            </div>
            <div className="text-lg font-black text-indigo-200 font-mono">
              + {boosterNightBonus.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
            </div>
            <p className="text-[10px] text-slate-400">
              Steuerfreier Nachtzuschlag (21:00 – 06:00 Uhr).
            </p>
            <div className="pt-2 border-t border-white/5 text-[11px] font-semibold text-slate-200">
              Gesamtauszahlung:{' '}
              <span className="text-emerald-400 font-bold">
                {(restBudget + boosterNightBonus).toFixed(2)} €
              </span>
            </div>
          </div>

          {/* Szenario 3: Sonntag-Nacht-Kombi */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-emerald-500/30 space-y-2 relative overflow-hidden shadow-lg shadow-emerald-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Sonntag + Nacht Kombi
              </span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                +8,54 € / h
              </span>
            </div>
            <div className="text-lg font-black text-emerald-300 font-mono">
              + {boosterComboBonus.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
            </div>
            <p className="text-[10px] text-slate-400">
              Beide Zuschläge kombiniert für maximale Netto-Rendite.
            </p>
            <div className="pt-2 border-t border-white/5 text-[11px] font-semibold text-slate-200">
              Gesamtauszahlung:{' '}
              <span className="text-emerald-300 font-black">
                {(restBudget + boosterComboBonus).toFixed(2)} €
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. MONATLICHE JAHRES-AUFSTELLUNG (JANUAR BIS DEZEMBER) */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm sm:text-base font-bold text-white tracking-wide font-display">
              Monatliche Jahresaufstellung {selectedYear}
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Klick auf einen Monat lädt den Stundenzettel
          </span>
        </div>

        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Monat</th>
                <th className="py-2.5 px-3 text-right">Stunden</th>
                <th className="py-2.5 px-3 text-right">Grundlohn (anrechenbar)</th>
                <th className="py-2.5 px-3 text-right text-emerald-400">SFN-Zuschläge</th>
                <th className="py-2.5 px-3 text-right text-white">Netto gesamt</th>
                <th className="py-2.5 px-3 text-right">Kumuliert</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {yearData.months.map(m => {
                const isOverLimit = m.cumulativeGrundlohn > limit;
                const isSelectedCurrent = m.yearMonth === currentYearMonth;

                return (
                  <tr
                    key={m.month}
                    onClick={() => onSelectMonth && onSelectMonth(m.yearMonth)}
                    className={`hover:bg-white/[0.04] transition-colors cursor-pointer ${
                      isSelectedCurrent ? 'bg-cyan-500/10' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-semibold text-white flex items-center gap-1.5">
                      <span>{m.monthName}</span>
                      {isSelectedCurrent && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300">
                          Aktiv
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                      {m.stunden > 0 ? `${m.stunden.toFixed(2)} h` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-200 font-bold">
                      {m.grundlohn > 0 ? `${m.grundlohn.toFixed(2)} €` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-semibold">
                      {m.sfnZuschlaege > 0 ? `+${m.sfnZuschlaege.toFixed(2)} €` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-white font-bold">
                      {m.netto > 0 ? `${m.netto.toFixed(2)} €` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      <span className={isOverLimit ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                        {m.cumulativeGrundlohn > 0 ? `${m.cumulativeGrundlohn.toFixed(2)} €` : '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {m.status === 'done' ? (
                        <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          Abgeschlossen
                        </span>
                      ) : m.status === 'current' ? (
                        <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                          Laufend
                        </span>
                      ) : (
                        <span className="inline-block text-[9px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-slate-400">
                          Geplant
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-white/10 font-bold text-white bg-white/[0.02]">
                <td className="py-3 px-3">Summe {selectedYear}</td>
                <td className="py-3 px-3 text-right font-mono text-cyan-300">
                  {yearData.sumStunden.toFixed(2)} h
                </td>
                <td className="py-3 px-3 text-right font-mono text-white font-black">
                  {yearData.sumGrundlohn.toFixed(2)} €
                </td>
                <td className="py-3 px-3 text-right font-mono text-emerald-400 font-black">
                  +{yearData.totalSfn.toFixed(2)} €
                </td>
                <td className="py-3 px-3 text-right font-mono text-white font-black">
                  {yearData.sumNetto.toFixed(2)} €
                </td>
                <td className="py-3 px-3 text-right font-mono text-cyan-300">
                  {yearData.sumGrundlohn.toFixed(2)} €
                </td>
                <td className="py-3 px-3 text-center text-[10px] text-slate-400 font-normal">
                  {auslastungProzent.toFixed(1)} % Budget
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 6. RECHTLICHER EXKURS (§ 3b EStG & SvEV) */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-[11px] text-slate-400 leading-relaxed space-y-1.5">
        <div className="flex items-center gap-1.5 font-bold text-slate-300">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>Rechtsgrundlage zur Minijob-Grenze (§ 3b EStG / § 1 Abs. 1 Nr. 1 SvEV):</span>
        </div>
        <p>
          Nach ständiger Rechtsprechung des Bundessozialgerichts und den Richtlinien der Minijob-Zentrale gehören steuerfreie Zuschläge für Sonntags-, Feiertags- und Nachtarbeit (SFN-Zuschläge gem. § 3b EStG) <strong>nicht</strong> zum sozialversicherungspflichtigen Arbeitsentgelt (§ 14 SGB IV i.V.m. § 1 Abs. 1 SvEV).
        </p>
        <p>
          Für die Jahresgrenze von <strong>{limit.toLocaleString('de-DE', { minimumFractionDigits: 0 })} €</strong> zählt ausschließlich das reguläre Grundgehalt (Grundlohn für geleistete Stunden, Lohnfortzahlung im Krankheitsfall, bezahlter Urlaub). Sämtliche SFN-Zuschläge fließen zu 100 % netto auf dein Konto, ohne den Minijob-Status zu gefährden.
        </p>
      </div>
    </div>
  );
};
