import React, { useState } from 'react';
import { Edit2, Trash2, Check, X, Plus } from 'lucide-react';
import { ShiftEntry } from '../../types';
import { berechneNetto } from '../../services/salaryEngine';
import { getFeiertageFuerJahr } from '../../services/holidayEngine';

interface MonthTableProps {
  currentYearMonth: string; // YYYY-MM
  shifts: ShiftEntry[];
  onSaveShift: (shift: ShiftEntry) => void;
  onDeleteShift: (datum: string) => void;
  onSelectDateForQuickEntry: (datum: string) => void;
  onCleanDuplicates?: () => void;
}

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export const MonthTable: React.FC<MonthTableProps> = ({
  currentYearMonth,
  shifts,
  onSaveShift,
  onDeleteShift,
  onSelectDateForQuickEntry,
  onCleanDuplicates
}) => {
  const [jahrStr, monatStr] = currentYearMonth.split('-');
  const jahr = parseInt(jahrStr, 10);
  const monat = parseInt(monatStr, 10);

  const tageImMonat = new Date(jahr, monat, 0).getDate();
  const feiertage = getFeiertageFuerJahr(jahr);
  const shiftMap = new Map(shifts.map(s => [s.datum, s]));

  // Inline Editing State (Desktop)
  const [editingDatum, setEditingDatum] = useState<string | null>(null);
  const [editKommen, setEditKommen] = useState<string>('');
  const [editGehen, setEditGehen] = useState<string>('');
  const [editPause, setEditPause] = useState<number>(30);

  // Mobiles Bearbeitungs-Modal (Bottom-Sheet / Pop-up)
  const [mobileModalDatum, setMobileModalDatum] = useState<string | null>(null);
  const [modalKommen, setModalKommen] = useState<string>('07:30');
  const [modalGehen, setModalGehen] = useState<string>('16:00');
  const [modalPause, setModalPause] = useState<number>(30);
  const [modalSchichtTyp, setModalSchichtTyp] = useState<string>('Individuell');

  const openEditModal = (datum: string, shift?: ShiftEntry) => {
    setMobileModalDatum(datum);
    if (shift) {
      setModalKommen(shift.kommen || '');
      setModalGehen(shift.gehen || '');
      setModalPause(shift.pauseMinuten ?? 0);
      setModalSchichtTyp(shift.schichtTyp || 'Individuell');
    } else {
      setModalKommen('07:30');
      setModalGehen('16:00');
      setModalPause(30);
      setModalSchichtTyp('Regeldienst');
    }
  };

  const handleSaveModal = () => {
    if (!mobileModalDatum || !modalKommen || !modalGehen) return;
    const netto = berechneNetto(modalKommen, modalGehen, modalPause);
    const existing = shiftMap.get(mobileModalDatum);
    onSaveShift({
      datum: mobileModalDatum,
      kommen: modalKommen,
      gehen: modalGehen,
      pauseMinuten: modalPause,
      nettoStunden: netto,
      schichtTyp: modalSchichtTyp || existing?.schichtTyp || 'Individuell'
    });
    setMobileModalDatum(null);
  };

  const handleDeleteModal = () => {
    if (!mobileModalDatum) return;
    onDeleteShift(mobileModalDatum);
    setMobileModalDatum(null);
  };

  const startInlineEdit = (datum: string, shift?: ShiftEntry) => {
    // Auf Mobilgeräten (Touch / kleine Bildschirme) sofort das komfortable Modal öffnen
    if (window.innerWidth < 768) {
      openEditModal(datum, shift);
      return;
    }
    setEditingDatum(datum);
    if (shift) {
      setEditKommen(shift.kommen || '');
      setEditGehen(shift.gehen || '');
      setEditPause(shift.pauseMinuten ?? 0);
    } else {
      setEditKommen('07:30');
      setEditGehen('16:00');
      setEditPause(30);
    }
  };

  const saveInlineEdit = (datum: string) => {
    if (!editKommen || !editGehen) {
      setEditingDatum(null);
      return;
    }

    const netto = berechneNetto(editKommen, editGehen, editPause);
    if (netto <= 0) {
      setEditingDatum(null);
      return;
    }

    const existing = shiftMap.get(datum);
    onSaveShift({
      datum,
      kommen: editKommen,
      gehen: editGehen,
      pauseMinuten: editPause,
      nettoStunden: netto,
      schichtTyp: existing?.schichtTyp || 'Individuell'
    });

    setEditingDatum(null);
  };

  const cancelInlineEdit = () => {
    setEditingDatum(null);
  };

  // Gesamtsumme berechnen
  let summeStunden = 0;
  for (let tag = 1; tag <= tageImMonat; tag++) {
    const datumStr = `${jahrStr}-${monatStr}-${String(tag).padStart(2, '0')}`;
    const s = shiftMap.get(datumStr);
    if (s) summeStunden += s.nettoStunden;
  }

  const rows = [];
  for (let tag = 1; tag <= tageImMonat; tag++) {
    const tagStr = String(tag).padStart(2, '0');
    const datumStr = `${jahrStr}-${monatStr}-${tagStr}`;
    const dateObj = new Date(jahr, monat - 1, tag);
    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const feiertagName = feiertage[datumStr];
    const isHoliday = Boolean(feiertagName);

    const shift = shiftMap.get(datumStr);
    const isEditing = editingDatum === datumStr;

    rows.push({
      tag,
      tagStr,
      datumStr,
      dayOfWeekShort: WOCHENTAGE[dayOfWeek],
      isWeekend,
      isHoliday,
      feiertagName,
      shift,
      isEditing
    });
  }

  return (
    <div className="bg-white/[0.04] backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
      <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-bold text-white">
            Monats-Stundenzettel
          </h3>
          <p className="text-[11px] text-slate-400">
            Klicke auf eine Zeile zum Bearbeiten
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {onCleanDuplicates && (
            <button
              type="button"
              onClick={onCleanDuplicates}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm"
              title="Entfernt doppelte Schichten am selben Tag und stellt exakte Monatsstunden sicher"
            >
              <span>🧹 Doppelte Einträge bereinigen</span>
            </button>
          )}

          <div className="text-right">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Gesamt
            </span>
            <span className="font-display text-sm font-black text-cyan-300">
              {summeStunden.toFixed(2)} h
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-white/[0.03] text-slate-400 font-bold uppercase tracking-wider border-b border-white/10 text-[10px]">
              <th className="py-2.5 px-3 text-center w-12">Tag</th>
              <th className="py-2.5 px-2 text-center w-14">Wochentag</th>
              <th className="py-2.5 px-3 text-center">Kommen</th>
              <th className="py-2.5 px-3 text-center">Gehen</th>
              <th className="py-2.5 px-2 text-center w-16">Pause</th>
              <th className="py-2.5 px-3 text-center w-20">Stunden</th>
              <th className="py-2.5 px-2 text-center w-16">Aktion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map(row => {
              const { tag, datumStr, dayOfWeekShort, isWeekend, isHoliday, feiertagName, shift, isEditing } = row;

              if (isEditing) {
                const liveNetto = berechneNetto(editKommen, editGehen, editPause);
                return (
                  <tr key={datumStr} className="bg-violet-950/40 border-b border-cyan-500/30">
                    <td className="py-2 px-3 text-center font-bold text-white">
                      {tag}.
                    </td>
                    <td className="py-2 px-2 text-center text-slate-300 font-semibold">
                      {dayOfWeekShort}
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="time"
                        inputMode="numeric"
                        autoFocus
                        value={editKommen}
                        onChange={e => setEditKommen(e.target.value)}
                        className="w-full px-2 py-1 rounded-lg bg-black/60 border border-cyan-400 text-xs font-bold text-center text-white focus:outline-none"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="time"
                        inputMode="numeric"
                        value={editGehen}
                        onChange={e => setEditGehen(e.target.value)}
                        className="w-full px-2 py-1 rounded-lg bg-black/60 border border-cyan-400 text-xs font-bold text-center text-white focus:outline-none"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min="0"
                        step="5"
                        value={editPause}
                        onChange={e => setEditPause(parseInt(e.target.value, 10) || 0)}
                        className="w-full px-1.5 py-1 rounded-lg bg-black/60 border border-cyan-400 text-xs font-bold text-center text-white focus:outline-none"
                      />
                    </td>
                    <td className="py-2 px-2 text-center font-black text-cyan-300 font-display">
                      {liveNetto.toFixed(2)}h
                    </td>
                    <td className="py-2 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => saveInlineEdit(datumStr)}
                          className="p-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                          title="Speichern"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelInlineEdit}
                          className="p-1 rounded-md bg-white/10 text-slate-300 hover:text-white transition-colors"
                          title="Abbrechen"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={datumStr}
                  onClick={() => startInlineEdit(datumStr, shift)}
                  className={`transition-colors duration-150 group cursor-pointer ${
                    isHoliday
                      ? 'bg-cyan-500/[0.06] hover:bg-cyan-500/10'
                      : isWeekend
                      ? 'bg-violet-500/[0.04] hover:bg-violet-500/[0.08]'
                      : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <td className="py-2.5 px-3 text-center font-bold text-white">
                    {tag}.
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    <span
                      className={`font-semibold ${
                        isHoliday
                          ? 'text-cyan-300'
                          : isWeekend
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {dayOfWeekShort}
                    </span>
                    {isHoliday && (
                      <span className="block text-[8px] font-bold text-cyan-400 truncate max-w-[60px] mx-auto" title={feiertagName}>
                        {feiertagName}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center font-medium text-slate-200 hover:text-cyan-300 transition-colors font-mono">
                    {shift ? shift.kommen : <span className="text-slate-600">-</span>}
                  </td>
                  <td className="py-2.5 px-3 text-center font-medium text-slate-200 hover:text-cyan-300 transition-colors font-mono">
                    {shift ? shift.gehen : <span className="text-slate-600">-</span>}
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    {shift && shift.pauseMinuten > 0 ? (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-300">
                        {shift.pauseMinuten}m
                      </span>
                    ) : (
                      <span className="text-slate-600">0</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {shift && shift.nettoStunden > 0 ? (
                      <span className="inline-block px-2 py-0.5 rounded-lg text-xs font-black bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-display">
                        {shift.nettoStunden.toFixed(2)} h
                      </span>
                    ) : (
                      <span className="text-slate-600">0,00</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    <div className="flex items-center justify-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      {shift ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(datumStr, shift);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-cyan-300 transition-colors"
                            title="Bearbeiten"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteShift(datumStr);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-400 transition-colors"
                            title="Löschen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(datumStr);
                          }}
                          className="p-1 rounded-md text-slate-600 hover:text-cyan-300 transition-colors"
                          title="Schicht hinzufügen"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-white/[0.03] font-black border-t border-white/10 text-white">
              <td colSpan={5} className="py-3 px-4 text-right uppercase tracking-wider text-xs text-slate-400">
                Gesamtstunden Monat:
              </td>
              <td className="py-3 px-3 text-center text-sm font-black text-cyan-300 font-display">
                {summeStunden.toFixed(2)} h
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobiles Bearbeitungs-Modal / Bottom-Sheet */}
      {mobileModalDatum && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setMobileModalDatum(null)}
        >
          <div 
            className="w-full max-w-lg bg-zinc-900 border border-white/15 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-250 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Zieh-Indikator für Mobilgeräte */}
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto sm:hidden mb-2" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">
                  {new Date(mobileModalDatum).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
                <h3 className="text-base font-bold text-white font-display">
                  {shiftMap.get(mobileModalDatum) ? 'Dienst bearbeiten' : 'Neuen Dienst eintragen'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMobileModalDatum(null)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Eingabefelder mit nativer Smartphone-Tastatur & inputMode */}
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Kommen (Uhrzeit)
                  </label>
                  <input
                    type="time"
                    inputMode="numeric"
                    value={modalKommen}
                    onChange={e => setModalKommen(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-xl bg-black/60 border border-white/20 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 text-white font-mono text-base font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Gehen (Uhrzeit)
                  </label>
                  <input
                    type="time"
                    inputMode="numeric"
                    value={modalGehen}
                    onChange={e => setModalGehen(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-xl bg-black/60 border border-white/20 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 text-white font-mono text-base font-bold outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Pause (Minuten)
                  </label>
                  <div className="flex gap-1.5">
                    {[0, 15, 30, 45, 60].map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setModalPause(p)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                          modalPause === p
                            ? 'bg-cyan-500 text-black'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {p}m
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  step="5"
                  value={modalPause}
                  onChange={e => setModalPause(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3.5 py-3 rounded-xl bg-black/60 border border-white/20 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 text-white font-mono text-base font-bold outline-none"
                />
              </div>

              {/* Live-Berechnung der Netto-Arbeitszeit */}
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  Berechnete Arbeitszeit:
                </span>
                <span className="text-base font-black text-cyan-300 font-display">
                  {berechneNetto(modalKommen, modalGehen, modalPause).toFixed(2)} h
                </span>
              </div>
            </div>

            {/* Aktions-Buttons: Speichern & Löschen */}
            <div className="flex items-center gap-2 pt-2">
              {shiftMap.get(mobileModalDatum) && (
                <button
                  type="button"
                  onClick={handleDeleteModal}
                  className="flex-1 py-3 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>🗑️ Dienst löschen</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveModal}
                className="flex-[2] py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>💾 Speichern</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
