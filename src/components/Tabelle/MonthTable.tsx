import React, { useEffect, useState } from 'react';
import { ShiftEntry } from '../../types';
import { berechneNetto } from '../../services/salaryEngine';
import { getFeiertageFuerJahr } from '../../services/holidayEngine';

interface MonthTableProps {
  currentYearMonth: string; // YYYY-MM
  shifts: ShiftEntry[];
  onSaveShift: (shift: ShiftEntry) => void;
  onDeleteShift: (datum: string) => void;
  onSelectDateForQuickEntry?: (datum: string) => void;
  onCleanDuplicates?: () => void;
}

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/**
 * Normalisiert freie Zeiteingaben zu "HH:MM".
 * "1830" -> "18:30", "730" -> "07:30", "8" -> "08:00", "18:30" -> "18:30".
 * Gibt '' zurück, wenn die Eingabe leer oder ungültig ist.
 */
const normalizeTime = (raw: string): string => {
  const v = raw.trim();
  if (!v) return '';
  let h: number;
  let m: number;
  if (v.includes(':')) {
    const [hs, ms] = v.split(':');
    h = parseInt(hs, 10);
    m = parseInt(ms || '0', 10);
  } else {
    const d = v.replace(/\D/g, '');
    if (!d) return '';
    if (d.length <= 2) {
      h = parseInt(d, 10);
      m = 0;
    } else if (d.length === 3) {
      h = parseInt(d.slice(0, 1), 10);
      m = parseInt(d.slice(1), 10);
    } else {
      h = parseInt(d.slice(0, 2), 10);
      m = parseInt(d.slice(2, 4), 10);
    }
  }
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return '';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

interface ShiftRowProps {
  tag: number;
  datumStr: string;
  dayOfWeekShort: string;
  isWeekend: boolean;
  isHoliday: boolean;
  feiertagName?: string;
  shift?: ShiftEntry;
  onSaveShift: (shift: ShiftEntry) => void;
  onDeleteShift: (datum: string) => void;
}

const ShiftRow: React.FC<ShiftRowProps> = ({
  tag,
  datumStr,
  dayOfWeekShort,
  isWeekend,
  isHoliday,
  feiertagName,
  shift,
  onSaveShift,
  onDeleteShift
}) => {
  const [kommen, setKommen] = useState(shift?.kommen ?? '');
  const [gehen, setGehen] = useState(shift?.gehen ?? '');
  const [pause, setPause] = useState(shift ? String(shift.pauseMinuten ?? 0) : '');

  // Lokale Eingaben mit dem gespeicherten Stand synchron halten (z.B. nach Cloud-Sync)
  useEffect(() => {
    setKommen(shift?.kommen ?? '');
    setGehen(shift?.gehen ?? '');
    setPause(shift ? String(shift.pauseMinuten ?? 0) : '');
  }, [shift?.kommen, shift?.gehen, shift?.pauseMinuten, shift?.nettoStunden]);

  const pauseNum = parseInt(pause.replace(/\D/g, ''), 10) || 0;
  const kNorm = normalizeTime(kommen);
  const gNorm = normalizeTime(gehen);
  const liveNetto = kNorm && gNorm ? berechneNetto(kNorm, gNorm, pauseNum) : 0;

  const isDirty = shift
    ? kNorm !== shift.kommen || gNorm !== shift.gehen || pauseNum !== (shift.pauseMinuten ?? 0)
    : Boolean(kNorm || gNorm);
  const canSave = Boolean(kNorm && gNorm && liveNetto > 0 && isDirty);

  const handleSave = () => {
    if (!canSave) return;
    onSaveShift({
      datum: datumStr,
      kommen: kNorm,
      gehen: gNorm,
      pauseMinuten: pauseNum,
      nettoStunden: liveNetto,
      schichtTyp: shift?.schichtTyp || 'Individuell'
    });
  };

  const handleDelete = () => {
    if (shift) {
      onDeleteShift(datumStr);
    } else {
      setKommen('');
      setGehen('');
      setPause('');
    }
  };

  const inputBase =
    'w-full min-w-0 px-1 py-2 rounded-lg bg-black/40 border text-xs sm:text-sm font-bold font-mono text-center text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/40 transition-colors';
  const inputBorder = isDirty ? 'border-amber-400/60' : 'border-white/10';

  return (
    <tr
      className={`${
        isHoliday
          ? 'bg-cyan-500/[0.06]'
          : isWeekend
          ? 'bg-violet-500/[0.04]'
          : ''
      }`}
    >
      <td className="py-1.5 pl-2 pr-1 text-center align-middle">
        <span className="block font-bold text-white text-xs sm:text-sm leading-tight">{tag}.</span>
        <span
          className={`block text-[10px] font-semibold leading-tight ${
            isHoliday ? 'text-cyan-300' : isWeekend ? 'text-rose-400' : 'text-slate-400'
          }`}
          title={feiertagName}
        >
          {dayOfWeekShort}
        </span>
      </td>
      <td className="py-1.5 px-0.5">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9:]*"
          placeholder="--:--"
          maxLength={5}
          value={kommen}
          onFocus={e => e.target.select()}
          onChange={e => setKommen(e.target.value)}
          onBlur={() => kNorm && setKommen(kNorm)}
          aria-label={`Kommen am ${tag}.`}
          className={`${inputBase} ${inputBorder}`}
        />
      </td>
      <td className="py-1.5 px-0.5">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9:]*"
          placeholder="--:--"
          maxLength={5}
          value={gehen}
          onFocus={e => e.target.select()}
          onChange={e => setGehen(e.target.value)}
          onBlur={() => gNorm && setGehen(gNorm)}
          aria-label={`Gehen am ${tag}.`}
          className={`${inputBase} ${inputBorder}`}
        />
      </td>
      <td className="py-1.5 px-0.5 w-11 sm:w-16">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="0"
          maxLength={3}
          value={pause}
          onFocus={e => e.target.select()}
          onChange={e => setPause(e.target.value.replace(/\D/g, ''))}
          aria-label={`Pause in Minuten am ${tag}.`}
          className={`${inputBase} ${inputBorder}`}
        />
      </td>
      <td className="py-1.5 px-0.5 text-center w-11 sm:w-16">
        <span
          className={`text-[11px] sm:text-xs font-black font-display ${
            liveNetto > 0 ? 'text-emerald-300' : 'text-slate-600'
          }`}
        >
          {liveNetto > 0 ? liveNetto.toFixed(2) : '0,00'}
        </span>
      </td>
      <td className="py-1.5 pl-0.5 pr-2 text-center">
        <div className="flex items-center justify-center gap-0.5">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            title="Speichern"
            aria-label={`Schicht am ${tag}. speichern`}
            className={`p-1 text-base leading-none rounded-md transition-all active:scale-90 ${
              canSave ? 'opacity-100 bg-emerald-500/20' : 'opacity-30'
            }`}
          >
            💾
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!shift && !kommen && !gehen && !pause}
            title="Löschen"
            aria-label={`Schicht am ${tag}. löschen`}
            className={`p-1 text-base leading-none rounded-md transition-all active:scale-90 ${
              shift || kommen || gehen || pause ? 'opacity-100 hover:bg-rose-500/20' : 'opacity-30'
            }`}
          >
            🗑️
          </button>
        </div>
      </td>
    </tr>
  );
};

export const MonthTable: React.FC<MonthTableProps> = ({
  currentYearMonth,
  shifts,
  onSaveShift,
  onDeleteShift,
  onCleanDuplicates
}) => {
  const [jahrStr, monatStr] = currentYearMonth.split('-');
  const jahr = parseInt(jahrStr, 10);
  const monat = parseInt(monatStr, 10);

  const tageImMonat = new Date(jahr, monat, 0).getDate();
  const feiertage = getFeiertageFuerJahr(jahr);
  const shiftMap = new Map(shifts.map(s => [s.datum, s]));

  let summeStunden = 0;
  for (let tag = 1; tag <= tageImMonat; tag++) {
    const datumStr = `${jahrStr}-${monatStr}-${String(tag).padStart(2, '0')}`;
    const s = shiftMap.get(datumStr);
    if (s) summeStunden += s.nettoStunden;
  }

  const rows = [];
  for (let tag = 1; tag <= tageImMonat; tag++) {
    const datumStr = `${jahrStr}-${monatStr}-${String(tag).padStart(2, '0')}`;
    const dayOfWeek = new Date(jahr, monat - 1, tag).getDay();
    rows.push(
      <ShiftRow
        key={datumStr}
        tag={tag}
        datumStr={datumStr}
        dayOfWeekShort={WOCHENTAGE[dayOfWeek]}
        isWeekend={dayOfWeek === 0 || dayOfWeek === 6}
        isHoliday={Boolean(feiertage[datumStr])}
        feiertagName={feiertage[datumStr]}
        shift={shiftMap.get(datumStr)}
        onSaveShift={onSaveShift}
        onDeleteShift={onDeleteShift}
      />
    );
  }

  return (
    <div className="bg-white/[0.04] backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
      <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-bold text-white">Monats-Stundenzettel</h3>
          <p className="text-[11px] text-slate-400">
            Felder antippen, ändern und mit 💾 speichern – 🗑️ löscht die Schicht
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {onCleanDuplicates && (
            <button
              type="button"
              onClick={onCleanDuplicates}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm"
              title="Entfernt doppelte Schichten am selben Tag"
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

      <table className="w-full text-left border-collapse table-fixed">
        <thead>
          <tr className="bg-white/[0.03] text-slate-400 font-bold uppercase tracking-wider border-b border-white/10 text-[9px] sm:text-[10px]">
            <th className="py-2 pl-2 pr-1 text-center w-10 sm:w-14">Tag</th>
            <th className="py-2 px-0.5 text-center">Kommen</th>
            <th className="py-2 px-0.5 text-center">Gehen</th>
            <th className="py-2 px-0.5 text-center w-11 sm:w-16">Pause</th>
            <th className="py-2 px-0.5 text-center w-11 sm:w-16">Std.</th>
            <th className="py-2 pl-0.5 pr-2 text-center w-[68px] sm:w-20">Aktion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">{rows}</tbody>
        <tfoot>
          <tr className="bg-white/[0.03] font-black border-t border-white/10 text-white">
            <td
              colSpan={4}
              className="py-3 px-3 text-right uppercase tracking-wider text-[11px] text-slate-400"
            >
              Gesamtstunden Monat:
            </td>
            <td colSpan={2} className="py-3 px-1 text-center text-sm font-black text-cyan-300 font-display">
              {summeStunden.toFixed(2)} h
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
