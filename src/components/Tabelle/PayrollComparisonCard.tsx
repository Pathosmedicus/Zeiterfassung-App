import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Copy,
  Mail,
  ChevronDown,
  ChevronUp,
  Coins,
  ArrowRight,
  Sparkles,
  Info,
  Calendar,
  ExternalLink,
  ShieldAlert,
  Edit2,
  Check,
  X,
  RotateCcw
} from 'lucide-react';
import { UserProfile, ShiftEntry, SalaryConfig, MonthPayoutOverride, ResolvedClaimStatus } from '../../types';
import {
  getClinicPayrollRecords,
  getDynamicOpenClaims,
  getTotalOpenClaimsNetto,
  generateHrClaimEmailText
} from '../../services/clinicPayrollEngine';
import { getTariffForMonth } from '../../services/salaryEngine';
import { storageService } from '../../services/storageService';

interface PayrollComparisonCardProps {
  userProfile: UserProfile;
  currentYearMonth: string;
  shifts: ShiftEntry[];
  salaryConfig: SalaryConfig;
  onSelectMonth?: (yearMonth: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  resolvedClaims?: Record<string, ResolvedClaimStatus>;
  onToggleClaim?: (claimId: string) => void;
  payoutOverrides?: Record<string, MonthPayoutOverride>;
  onSavePayoutOverride?: (override: MonthPayoutOverride) => void;
  onDeletePayoutOverride?: (yearMonth: string) => void;
  lastSyncTime?: Date | null;
  onManualSync?: () => void;
  isSyncing?: boolean;
}

export const PayrollComparisonCard: React.FC<PayrollComparisonCardProps> = ({
  userProfile,
  currentYearMonth,
  shifts,
  salaryConfig,
  onSelectMonth,
  onShowToast,
  resolvedClaims: propsResolvedClaims,
  onToggleClaim: propsOnToggleClaim,
  payoutOverrides: propsPayoutOverrides,
  onSavePayoutOverride: propsOnSavePayoutOverride,
  onDeletePayoutOverride: propsOnDeletePayoutOverride,
  lastSyncTime,
  onManualSync,
  isSyncing
}) => {
  const [selectedYearFilter, setSelectedYearFilter] = useState<'all' | '2026' | '2025'>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>('2026-09');
  const [showClaimLetterModal, setShowClaimLetterModal] = useState(false);
  const [showResolvedSection, setShowResolvedSection] = useState(false);

  // Fallback lokale Zustände für Overrides und erledigte Posten falls nicht von außen übergeben
  const [localPayoutOverrides, setLocalPayoutOverrides] = useState<Record<string, MonthPayoutOverride>>(() => storageService.getPayoutOverrides());
  const [localResolvedClaims, setLocalResolvedClaims] = useState<Record<string, ResolvedClaimStatus>>(() => storageService.getResolvedClaims());

  const payoutOverrides = propsPayoutOverrides ?? localPayoutOverrides;
  const resolvedClaims = propsResolvedClaims ?? localResolvedClaims;

  // Zustand für den "Bank-Ist" Betrags-Editor
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  // Dynamische Monatsaufstellung für jeden Mitarbeiter
  const allRecords = useMemo(() => {
    return getClinicPayrollRecords(shifts, salaryConfig, payoutOverrides, resolvedClaims);
  }, [shifts, salaryConfig, payoutOverrides, resolvedClaims]);

  // Dynamische Nachforderungen
  const allClaims = useMemo(() => {
    return getDynamicOpenClaims(allRecords, resolvedClaims);
  }, [allRecords, resolvedClaims]);

  const openClaims = allClaims.filter(c => !c.isResolved);
  const resolvedClaimsList = allClaims.filter(c => c.isResolved);
  const totalOpenClaimsNetto = getTotalOpenClaimsNetto(allClaims);

  const filteredRecords = allRecords.filter(r => {
    if (selectedYearFilter === '2026') return r.yearMonth.startsWith('2026');
    if (selectedYearFilter === '2025') return r.yearMonth.startsWith('2025');
    return true;
  });

  // Gesamtsummen berechnen
  const sumHours = filteredRecords.reduce((acc, r) => acc + r.gesamtStunden, 0);
  const sumBankIst = filteredRecords.reduce((acc, r) => acc + r.bankIst, 0);
  const sumBankSoll = filteredRecords.reduce((acc, r) => acc + r.bankSollRegulaer, 0);

  // Posten als beglichen markieren oder wieder öffnen (mit Sofort-Cloud-Sync)
  const handleToggleClaim = (claimId: string) => {
    if (propsOnToggleClaim) {
      propsOnToggleClaim(claimId);
      return;
    }
    const isCurrentlyResolved = Boolean(resolvedClaims[claimId]?.isResolved);
    const updated = storageService.setClaimResolved(claimId, !isCurrentlyResolved);
    setLocalResolvedClaims({ ...updated });
    if (!isCurrentlyResolved) {
      onShowToast('✅ Posten als beglichen / erledigt markiert!', 'success');
    } else {
      onShowToast('↩️ Posten wieder geöffnet!', 'info');
    }
  };

  // Editor für Bank-Ist
  const startEditing = (yearMonth: string, currentVal: number) => {
    setEditingMonth(yearMonth);
    setEditingValue(currentVal.toFixed(2));
  };

  const handleSaveBankIst = (yearMonth: string) => {
    const val = parseFloat(editingValue.replace(',', '.'));
    if (isNaN(val) || val < 0) {
      onShowToast('Bitte einen gültigen Betrag eingeben.', 'error');
      return;
    }
    if (propsOnSavePayoutOverride) {
      propsOnSavePayoutOverride({ yearMonth, bankIst: val });
    } else {
      const updated = storageService.savePayoutOverride({
        yearMonth,
        bankIst: val
      });
      setLocalPayoutOverrides({ ...updated });
    }
    setEditingMonth(null);
    onShowToast(`💰 Bank-Auszahlung für ${yearMonth} auf ${val.toFixed(2)} € aktualisiert!`, 'success');
  };

  const handleResetBankIst = (yearMonth: string) => {
    if (propsOnDeletePayoutOverride) {
      propsOnDeletePayoutOverride(yearMonth);
    } else {
      const updated = storageService.deletePayoutOverride(yearMonth);
      setLocalPayoutOverrides({ ...updated });
    }
    setEditingMonth(null);
    onShowToast(`Auszahlung für ${yearMonth} auf Standard zurückgesetzt.`, 'info');
  };

  const handleCopyClaimLetter = () => {
    const { body } = generateHrClaimEmailText(userProfile, allClaims);
    navigator.clipboard.writeText(body);
    onShowToast('📋 Klärungsschreiben für Personalabteilung in die Zwischenablage kopiert!', 'success');
  };

  const handleOpenClaimEmail = () => {
    const { subject, body } = generateHrClaimEmailText(userProfile, allClaims);
    const recipient = localStorage.getItem('email_recipient') || '';
    window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    onShowToast('✉️ E-Mail-Programm mit Klärungstext geöffnet!', 'info');
  };

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* 1. BOX: OFFENE NACHFORDEUNGEN AN DIE PERSONALABTEILUNG                   */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-br from-rose-500/10 via-amber-500/5 to-rose-500/10 dark:from-rose-950/40 dark:via-zinc-900 dark:to-rose-950/30 rounded-3xl p-5 border-2 border-rose-300 dark:border-rose-900/80 shadow-card space-y-4">
        {/* Cloud Sync Status & Sofort-Sync Button */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-white/60 dark:bg-black/50 border border-rose-200/60 dark:border-rose-900/40 text-xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isSyncing ? 'bg-amber-400' : 'bg-emerald-400'} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isSyncing ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            </span>
            <span className="text-[11px] font-medium">
              {lastSyncTime
                ? `Echtzeit-Cloud-Sync aktiv • Zuletzt synchronisiert: ${lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} Uhr`
                : 'Echtzeit-Cloud-Synchronisation aktiv'}
            </span>
          </div>

          {onManualSync && (
            <button
              onClick={onManualSync}
              disabled={isSyncing}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"
              title="Jetzt manuell mit Google Cloud abgleichen"
            >
              <span className={isSyncing ? 'animate-spin inline-block text-amber-500' : 'text-cyan-500'}>🔄</span>
              <span>Jetzt synchronisieren</span>
            </button>
          )}
        </div>

        {/* Header mit Gesamtbetrag */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-2xl text-white flex items-center justify-center shrink-0 shadow-md ${
              openClaims.length > 0 ? 'bg-rose-500 shadow-rose-500/30' : 'bg-emerald-500 shadow-emerald-500/30'
            }`}>
              {openClaims.length > 0 ? (
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Offene Nachforderungen an die Personalabteilung
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  openClaims.length > 0
                    ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                    : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                }`}>
                  {openClaims.length > 0 ? `${openClaims.length} Posten offen` : '🎉 Alle beglichen'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Klinikum Minden • TVöD-K EG 03 • Minijob (PGS 6500)
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right bg-white dark:bg-zinc-900 px-3.5 py-2 rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-sm w-full sm:w-auto">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block">
              Gesamter Nachforderungsanspruch:
            </span>
            <span className={`text-xl font-black ${
              totalOpenClaimsNetto > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {totalOpenClaimsNetto.toFixed(2)} €
              <span className="text-xs font-semibold text-rose-500/80 ml-1">Netto</span>
            </span>
          </div>
        </div>

        {/* Wenn alle Nachforderungen beglichen sind */}
        {openClaims.length === 0 && (
          <div className="bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 p-4 rounded-2xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">
                  🎉 Keine offenen Nachforderungen!
                </h4>
                <p className="text-slate-600 dark:text-zinc-300 mt-0.5 text-[11px]">
                  Alle Abrechnungsdifferenzen wurden erfolgreich von der Personalabteilung korrigiert oder von Ihnen als beglichen geschlossen.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Die offenen Detail-Forderungskarten */}
        {openClaims.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {openClaims.map(claim => (
              <div
                key={claim.id}
                className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-rose-200 dark:border-rose-900/60 shadow-soft space-y-2.5 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 mb-1">
                        🚨 {claim.zeitraum}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                        {claim.titel}
                      </h4>
                    </div>
                    <span className="text-base font-black text-rose-600 dark:text-rose-400 shrink-0">
                      {claim.betragNetto.toFixed(2)} €
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed">
                    {claim.kurzBeschreibung}
                  </p>

                  <div className="text-[10px] space-y-1 bg-slate-50 dark:bg-zinc-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 font-mono text-slate-700 dark:text-zinc-300">
                    {claim.details.map((d, i) => (
                      <div key={i} className="flex justify-between gap-2">
                        <span>{d}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-slate-200 dark:border-zinc-700 pt-1 text-rose-600 dark:text-rose-400 font-bold">
                      <span>Offene Nachforderung:</span>
                      <span>+ {claim.betragNetto.toFixed(2)} € Netto</span>
                    </div>
                  </div>
                </div>

                {/* Direkter Button zum Schließen des Postens */}
                <div className="pt-2">
                  <button
                    onClick={() => handleToggleClaim(claim.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-98"
                    title="Klicken, sobald die Personalabteilung diesen Fehler korrigiert oder ausgezahlt hat"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>✅ Als beglichen / erledigt schließen</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bereich für bereits erledigte Posten */}
        {resolvedClaimsList.length > 0 && (
          <div className="pt-1">
            <button
              onClick={() => setShowResolvedSection(!showResolvedSection)}
              className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {showResolvedSection ? 'Erledigte Posten ausblenden' : `Erledigte Posten (${resolvedClaimsList.length}) anzeigen`}
              </span>
              {showResolvedSection ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showResolvedSection && (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in duration-150">
                {resolvedClaimsList.map(rc => (
                  <div
                    key={rc.id}
                    className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-emerald-200 dark:border-emerald-900/40 shadow-xs flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                          ✅ Beglichen {rc.resolvedDate ? `am ${rc.resolvedDate}` : ''}
                        </span>
                      </div>
                      <h5 className="font-bold text-slate-800 dark:text-zinc-200 mt-1">
                        {rc.titel}
                      </h5>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {rc.betragNetto.toFixed(2)} € Netto
                      </span>
                    </div>

                    <button
                      onClick={() => handleToggleClaim(rc.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-medium text-[11px] flex items-center gap-1 shrink-0 transition-colors"
                      title="Posten wieder als offen markieren"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Wieder öffnen</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Prognose-Hinweis für Oktober 2026 */}
        <div className="bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-900/50 p-3 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-500 shrink-0" />
            <div className="text-slate-700 dark:text-zinc-300">
              <strong>Prognose Auszahlung Ende Oktober 2026:</strong> Regulär fällig:{' '}
              <span className="font-bold text-slate-900 dark:text-white">592,02 €</span> • Mit September-Korrektur fällig:{' '}
              <strong className="text-brand-600 dark:text-brand-400">910,00 €</strong> (zzgl. 181,14 € für 2025).
            </div>
          </div>
        </div>

        {/* Aktions-Leiste: Schreiben kopieren, E-Mail öffnen, Vorschau */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={handleCopyClaimLetter}
            className="flex-1 min-w-[200px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-900 dark:bg-zinc-800 hover:bg-slate-800 dark:hover:bg-zinc-700 text-white font-bold text-xs shadow-md transition-all active:scale-98"
          >
            <Copy className="w-3.5 h-3.5 text-brand-400" />
            <span>Klärungsschreiben für Personalabteilung kopieren</span>
          </button>

          <button
            onClick={handleOpenClaimEmail}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-600/20 transition-all active:scale-98"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Klärungs-E-Mail öffnen</span>
          </button>

          <button
            onClick={() => setShowClaimLetterModal(!showClaimLetterModal)}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold text-xs border border-slate-200 dark:border-zinc-700 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{showClaimLetterModal ? 'Schreiben verbergen' : 'Mustertext anzeigen'}</span>
          </button>
        </div>

        {/* Aufklappbarer Mustertext */}
        {showClaimLetterModal && (
          <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2 animate-in fade-in duration-200 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <span className="font-bold text-slate-900 dark:text-white">
                Vorgefertigtes Schreiben an Personalabteilung Klinikum Minden
              </span>
              <button
                onClick={handleCopyClaimLetter}
                className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                <span>Text kopieren</span>
              </button>
            </div>
            <pre className="font-mono text-[11px] leading-relaxed text-slate-700 dark:text-zinc-300 whitespace-pre-wrap bg-slate-50 dark:bg-zinc-950 p-3 rounded-xl border border-slate-200/60 dark:border-zinc-800 max-h-60 overflow-y-auto">
              {generateHrClaimEmailText(userProfile, allClaims).body}
            </pre>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. REALE VERGLEICHSTABELLE: LEISTUNGSMONAT VS. AUSZAHLUNGSMONAT           */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200/80 dark:border-zinc-800 shadow-card overflow-hidden">
        {/* Header & Filter */}
        <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Vergleich: Geleistete Stunden vs. Tatsächliche Bank-Auszahlung
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              3-Stufen-Versatz: Laufender Grundlohn (M) + Mehrstunden (M-1) + Zeitzuschläge (M-2)
            </p>
          </div>

          {/* Jahres-Filter */}
          <div className="flex p-0.5 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs">
            <button
              onClick={() => setSelectedYearFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                selectedYearFilter === 'all'
                  ? 'bg-white dark:bg-zinc-700 text-brand-600 dark:text-brand-300 shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              Alle ({allRecords.length} Mon.)
            </button>
            <button
              onClick={() => setSelectedYearFilter('2026')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                selectedYearFilter === '2026'
                  ? 'bg-white dark:bg-zinc-700 text-brand-600 dark:text-brand-300 shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              2026
            </button>
            <button
              onClick={() => setSelectedYearFilter('2025')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                selectedYearFilter === '2025'
                  ? 'bg-white dark:bg-zinc-700 text-brand-600 dark:text-brand-300 shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              2025
            </button>
          </div>
        </div>

        {/* KPI Mini-Balken */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50/70 dark:bg-zinc-800/40 border-b border-slate-100 dark:border-zinc-800 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 text-center">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Geleistete Std.</span>
            <span className="font-black text-slate-900 dark:text-white">{sumHours.toFixed(2)} h</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 text-center">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Bank-Überweisung Ist</span>
            <span className="font-black text-emerald-600 dark:text-emerald-400">{sumBankIst.toFixed(2)} €</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 text-center">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Regulär Soll</span>
            <span className="font-black text-slate-700 dark:text-zinc-300">{sumBankSoll.toFixed(2)} €</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 text-center">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Offene Ansprüche</span>
            <span className={`font-black ${totalOpenClaimsNetto > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {totalOpenClaimsNetto > 0 ? `+${totalOpenClaimsNetto.toFixed(2)} €` : '0,00 €'}
            </span>
          </div>
        </div>

        {/* Tabelle */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider border-b border-slate-200/80 dark:border-zinc-800 text-[10px]">
                <th className="py-2.5 px-3">Monat M</th>
                <th className="py-2.5 px-3">Geleistete Std. (M)</th>
                <th className="py-2.5 px-3">Tarifstufe</th>
                <th className="py-2.5 px-3 text-right">Bank Soll</th>
                <th className="py-2.5 px-3 text-right">Bank Ist (Gutschrift)</th>
                <th className="py-2.5 px-3 text-center">Status / Differenz</th>
                <th className="py-2.5 px-2 text-center w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filteredRecords.map(record => {
                const isSelected = record.yearMonth === currentYearMonth;
                const isExpanded = expandedRow === record.yearMonth;
                const [rY, rM] = record.yearMonth.split('-').map(Number);
                const tariff = getTariffForMonth(rY, rM, salaryConfig);

                return (
                  <React.Fragment key={record.yearMonth}>
                    <tr
                      onClick={() => setExpandedRow(isExpanded ? null : record.yearMonth)}
                      className={`cursor-pointer transition-colors duration-150 ${
                        isSelected
                          ? 'bg-brand-50/70 dark:bg-brand-950/40'
                          : record.status === 'claim'
                          ? 'bg-rose-50/40 dark:bg-rose-950/30 hover:bg-rose-50/70'
                          : record.status === 'anomaly'
                          ? 'bg-amber-50/30 dark:bg-amber-950/20 hover:bg-amber-50/50'
                          : 'hover:bg-slate-50 dark:hover:bg-zinc-800/40'
                      }`}
                    >
                      {/* Monat */}
                      <td className="py-3 px-3">
                        <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{record.label}</span>
                          {isSelected && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-brand-500 text-white">
                              Aktiv
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                          {record.yearMonth}
                        </span>
                      </td>

                      {/* Geleistete Stunden */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 dark:text-zinc-100">
                          {record.gesamtStunden.toFixed(2)} h
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                          {record.sonntagStunden > 0 && <span>{record.sonntagStunden.toFixed(2)}h So </span>}
                          {record.samstagStunden > 0 && <span>{record.samstagStunden.toFixed(2)}h Sa </span>}
                          {record.nachtStunden && record.nachtStunden > 0 && <span>{record.nachtStunden.toFixed(2)}h Nacht</span>}
                        </div>
                      </td>

                      {/* Tarifstufe */}
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-700 dark:text-zinc-300">
                          {tariff.hourlyWage.toFixed(2)} €/h
                        </span>
                        <span className="block text-[10px] text-slate-400 truncate max-w-[120px]">
                          {tariff.name}
                        </span>
                      </td>

                      {/* Bank Soll */}
                      <td className="py-3 px-3 text-right font-mono font-medium text-slate-600 dark:text-zinc-400">
                        {record.bankSollRegulaer.toFixed(2)} €
                      </td>

                      {/* Bank Ist */}
                      <td className="py-3 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                        <div className="flex items-center justify-end gap-1.5">
                          <span
                            className={
                              record.status === 'claim'
                                ? 'text-rose-600 dark:text-rose-400'
                                : record.differenz > 100
                                ? 'text-purple-600 dark:text-purple-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }
                          >
                            {record.bankIst.toFixed(2)} €
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(record.yearMonth, record.bankIst);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                            title="Tatsächliche Überweisung für diesen Monat anpassen"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Status / Differenz */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            record.isResolved
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                              : record.status === 'claim'
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
                              : record.status === 'anomaly'
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
                              : record.status === 'forecast'
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-800'
                              : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {record.statusBadge}
                        </span>
                      </td>

                      {/* Aufklapp-Icon */}
                      <td className="py-3 px-2 text-center text-slate-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </td>
                    </tr>

                    {/* Aufgeklappte Abrechnungs-Details */}
                    {isExpanded && (
                      <tr className="bg-slate-50/90 dark:bg-zinc-950/70 border-b-2 border-slate-200 dark:border-zinc-700">
                        <td colSpan={7} className="p-4 space-y-3">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80 dark:border-zinc-800 text-xs">
                            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <Info className="w-3.5 h-3.5 text-brand-500" />
                              <span>Abrechnungs-Aufschlüsselung & HR-Notiz ({record.label})</span>
                            </span>
                            {onSelectMonth && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  onSelectMonth(record.yearMonth);
                                }}
                                className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                              >
                                <span>Diesen Monat im Stundenzettel öffnen</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            {/* HR-Notiz */}
                            <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200/70 dark:border-zinc-800 space-y-2">
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                  Klinik-Abrechnungsnotiz:
                                </span>
                                <p className="text-slate-700 dark:text-zinc-200 text-xs leading-relaxed mt-0.5">
                                  {record.hrNotiz}
                                </p>
                              </div>
                              {record.sonderzahlungText && (
                                <div className="pt-1 text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                                  🎁 Sonderzahlung: {record.sonderzahlungText} (+{record.sonderzahlungBetrag?.toFixed(2)} €)
                                </div>
                              )}

                              {/* Schnellaktionen für diesen Monat */}
                              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleClaim(record.yearMonth === '2026-09' ? 'claim_2026_09_abrechnungsfehler' : `claim_${record.yearMonth}`);
                                  }}
                                  className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl font-bold text-xs transition-all ${
                                    record.isResolved
                                      ? 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-300'
                                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/30'
                                  }`}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{record.isResolved ? '↩️ Als unbeglichen / offen markieren' : '✅ Diesen Posten als beglichen schließen'}</span>
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(record.yearMonth, record.bankIst);
                                  }}
                                  className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 text-xs font-semibold"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-brand-500" />
                                  <span>Tatsächliche Überweisung anpassen</span>
                                </button>
                              </div>
                            </div>

                            {/* Versatz-Formel Aufschlüsselung */}
                            <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200/70 dark:border-zinc-800 space-y-1 text-[11px] font-mono">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-sans">
                                3-Stufen-Versatz Bestandteile:
                              </span>
                              <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-zinc-800 text-slate-600 dark:text-zinc-400">
                                <span>1. LA 200 Grundvergütung ({record.label}):</span>
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {tariff.basePay5h.toFixed(2)} €
                                </span>
                              </div>
                              <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-zinc-800 text-slate-600 dark:text-zinc-400">
                                <span>2. LA 208 Mehrstunden (aus Vormonat):</span>
                                <span className="font-bold text-slate-900 dark:text-white">
                                  nach Stundenlohn (M-1)
                                </span>
                              </div>
                              <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-zinc-800 text-slate-600 dark:text-zinc-400">
                                <span>3. Zeitzuschläge (aus Vor-Vormonat):</span>
                                <span className="font-bold text-slate-900 dark:text-white">
                                  LA 362 / 332 / 360 (M-2)
                                </span>
                              </div>
                              <div className="flex justify-between py-0.5 text-rose-600 dark:text-rose-400">
                                <span>4. VBL-Arbeitnehmerabzug:</span>
                                <span>exakt 1,81 % auf VBL-Brutto</span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MODAL: TATSÄCHLICHE AUSZAHLUNG ANPASSEN                                */}
      {/* ========================================================================= */}
      {editingMonth && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-slate-200 dark:border-zinc-800 shadow-2xl max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-brand-500" />
                <span>Bank-Auszahlung für {editingMonth}</span>
              </h4>
              <button
                onClick={() => setEditingMonth(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
              Tragen Sie den tatsächlich auf Ihrem Bankkonto eingegangenen Betrag ein. Die App gleicht diesen automatisch mit dem 3-Stufen-Versatz-Soll ab und erkennt etwaige Nachforderungen.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Tatsächlich erhalten (€):
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={editingValue}
                  onChange={e => setEditingValue(e.target.value)}
                  className="w-full px-3 py-2 pr-8 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  autoFocus
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">€</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => handleSaveBankIst(editingMonth)}
                className="flex-1 py-2 px-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Speichern</span>
              </button>
              {payoutOverrides[editingMonth]?.bankIst !== undefined && (
                <button
                  onClick={() => handleResetBankIst(editingMonth)}
                  className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-bold text-xs transition-colors"
                >
                  Zurücksetzen
                </button>
              )}
              <button
                onClick={() => setEditingMonth(null)}
                className="py-2 px-3 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300 text-xs font-semibold"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollComparisonCard;
