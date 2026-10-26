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

  // Inline Editing State
  const [editingDatum, setEditingDatum] = useState<string | null>(null);
  const [editKommen, setEditKommen] = useState<string>('');
  const [editGehen, setEditGehen] = useState<string>('');
  const [editPause, setEditPause] = useState<number>(30);

  const startInlineEdit = (datum: string, shift?: ShiftEntry) => {
    setEditingDatum(datum);
    if (shift) {
      setEditKommen(shift.kommen);
      setEditGehen(shift.gehen);
      setEditPause(shift.pauseMinuten);
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

    onSaveShift({
      datum,
      kommen: editKommen,
      gehen: editGehen,
      pauseMinuten: editPause,
      nettoStunden: netto,
      schichtTyp: 'Individuell'
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
                        value={editKommen}
                        onChange={e => setEditKommen(e.target.value)}
                        className="w-full px-2 py-1 rounded-lg bg-black/60 border border-cyan-400 text-xs font-bold text-center text-white focus:outline-none"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="time"
                        value={editGehen}
                        onChange={e => setEditGehen(e.target.value)}
                        className="w-full px-2 py-1 rounded-lg bg-black/60 border border-cyan-400 text-xs font-bold text-center text-white focus:outline-none"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
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
                          onClick={() => saveInlineEdit(datumStr)}
                          className="p-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                          title="Speichern"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
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
                  className={`transition-colors duration-150 group ${
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
                  <td
                    onClick={() => startInlineEdit(datumStr, shift)}
                    className="py-2.5 px-3 text-center font-medium cursor-pointer text-slate-200 hover:text-cyan-300 transition-colors font-mono"
                  >
                    {shift ? shift.kommen : <span className="text-slate-600">-</span>}
                  </td>
                  <td
                    onClick={() => startInlineEdit(datumStr, shift)}
                    className="py-2.5 px-3 text-center font-medium cursor-pointer text-slate-200 hover:text-cyan-300 transition-colors font-mono"
                  >
                    {shift ? shift.gehen : <span className="text-slate-600">-</span>}
                  </td>
                  <td
                    onClick={() => startInlineEdit(datumStr, shift)}
                    className="py-2.5 px-2 text-center cursor-pointer"
                  >
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
                            onClick={() => startInlineEdit(datumStr, shift)}
                            className="p-1 rounded-md text-slate-400 hover:text-cyan-300 transition-colors"
                            title="Bearbeiten"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteShift(datumStr)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-400 transition-colors"
                            title="Löschen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startInlineEdit(datumStr)}
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
    </div>
  );
};
