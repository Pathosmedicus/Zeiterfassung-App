import React from 'react';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { ShiftEntry } from '../../types';
import { getFeiertageFuerJahr } from '../../services/holidayEngine';

interface MiniCalendarProps {
  currentYearMonth: string; // YYYY-MM
  selectedDate: string;     // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  shifts: ShiftEntry[];
}

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export const MiniCalendar: React.FC<MiniCalendarProps> = ({
  currentYearMonth,
  selectedDate,
  onSelectDate,
  shifts
}) => {
  const [jahrStr, monatStr] = currentYearMonth.split('-');
  const jahr = parseInt(jahrStr, 10);
  const monat = parseInt(monatStr, 10);

  const tageImMonat = new Date(jahr, monat, 0).getDate();
  const feiertage = getFeiertageFuerJahr(jahr);
  const shiftMap = new Map(shifts.map(s => [s.datum, s]));

  // Erster Wochentag im Monat (0=So, 1=Mo... 6=Sa) -> umwandeln in Mo=0 .. So=6
  const firstDayRaw = new Date(jahr, monat - 1, 1).getDay();
  const firstDayIndex = firstDayRaw === 0 ? 6 : firstDayRaw - 1;

  const todayStr = new Date().toISOString().split('T')[0];

  // Leere Felder vor dem 1. Tag des Monats
  const leadingBlanks = Array.from({ length: firstDayIndex });
  // Tage des Monats
  const daysArray = Array.from({ length: tageImMonat }, (_, i) => i + 1);

  return (
    <div className="bg-white/[0.04] backdrop-blur-xl rounded-3xl p-5 border border-white/10 shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-cyan-400" />
          <h2 className="font-display text-sm font-bold text-white">
            Monatskalender
          </h2>
        </div>
        <span className="text-[11px] font-medium text-slate-400">
          Klicke auf einen Tag zur Schnellauswahl
        </span>
      </div>

      {/* Wochentagsleiste */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {WOCHENTAGE.map((tag, idx) => {
          const isWeekend = idx >= 5;
          return (
            <div
              key={tag}
              className={`text-[11px] font-bold py-1 ${
                isWeekend ? 'text-rose-400' : 'text-slate-400'
              }`}
            >
              {tag}
            </div>
          );
        })}
      </div>

      {/* Kalendertage Grid */}
      <div className="grid grid-cols-7 gap-1">
        {leadingBlanks.map((_, i) => (
          <div key={`blank-${i}`} className="h-14 rounded-2xl bg-transparent" />
        ))}

        {daysArray.map(tag => {
          const tagStr = String(tag).padStart(2, '0');
          const datumStr = `${jahrStr}-${monatStr}-${tagStr}`;
          const isSelected = datumStr === selectedDate;
          const isToday = datumStr === todayStr;

          const dateObj = new Date(jahr, monat - 1, tag);
          const dayOfWeek = dateObj.getDay(); // 0=So, 6=Sa
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const feiertagName = feiertage[datumStr];
          const isHoliday = Boolean(feiertagName);

          const shift = shiftMap.get(datumStr);
          const hasShift = shift && shift.nettoStunden > 0;

          return (
            <button
              key={tag}
              onClick={() => onSelectDate(datumStr)}
              className={`h-14 p-1 rounded-2xl border flex flex-col justify-between items-center transition-all duration-150 relative active:scale-90 ${
                isSelected
                  ? 'border-cyan-400 ring-2 ring-cyan-400/40 bg-gradient-to-tr from-violet-600/40 to-cyan-500/30 text-white font-bold shadow-lg shadow-cyan-500/20 scale-105 z-10'
                  : hasShift
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:border-emerald-400 shadow-sm'
                  : isHoliday
                  ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                  : isWeekend
                  ? 'border-white/5 bg-white/[0.02] text-slate-300'
                  : 'border-white/5 bg-transparent hover:bg-white/[0.06] hover:border-white/15 text-slate-200'
              }`}
              title={feiertagName ? `${feiertagName} (Feiertag)` : datumStr}
            >
              {/* Tag-Nummer & Today-Indikator */}
              <div className="flex items-center justify-between w-full px-1">
                <span
                  className={`text-xs font-bold ${
                    isSelected
                      ? 'text-white'
                      : isHoliday
                      ? 'text-cyan-300'
                      : isWeekend
                      ? 'text-rose-400'
                      : 'text-slate-200'
                  }`}
                >
                  {tag}
                </span>

                {isToday && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" title="Heute" />
                )}
              </div>

              {/* Schicht-Badge oder Feiertagskennzeichnung */}
              <div className="w-full flex justify-center pb-0.5">
                {hasShift ? (
                  <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 shadow-xs leading-tight">
                    {shift.nettoStunden.toFixed(1)}h
                  </span>
                ) : isHoliday ? (
                  <span className="text-[9px] font-bold text-cyan-300 truncate max-w-[42px] leading-tight">
                    Feiertag
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
