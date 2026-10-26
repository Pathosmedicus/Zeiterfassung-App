import React, { useRef, useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export interface TimeInputFieldProps {
  label: string;
  value: string; // "HH:MM" z.B. "07:30"
  onChange: (val: string) => void;
  quickChips?: string[];
  autoFocus?: boolean;
  className?: string;
}

export const TimeInputField: React.FC<TimeInputFieldProps> = ({
  label,
  value,
  onChange,
  quickChips,
  autoFocus,
  className = ''
}) => {
  const [valH, valM] = (value || '07:30').split(':');
  const [rawHours, setRawHours] = useState<string>(valH || '07');
  const [rawMinutes, setRawMinutes] = useState<string>(valM || '30');

  const hoursRef = useRef<HTMLInputElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);
  const nativePickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value && value.includes(':')) {
      const [h, m] = value.split(':');
      setRawHours(h || '00');
      setRawMinutes(m || '00');
    }
  }, [value]);

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, '');

    // Schnelleingabe von 3 oder 4 Ziffern am Stück (z.B. "1830" oder "730")
    if (clean.length >= 4) {
      const h = Math.min(23, parseInt(clean.slice(0, 2), 10) || 0).toString().padStart(2, '0');
      const m = Math.min(59, parseInt(clean.slice(2, 4), 10) || 0).toString().padStart(2, '0');
      setRawHours(h);
      setRawMinutes(m);
      onChange(`${h}:${m}`);
      minutesRef.current?.blur();
      return;
    }
    if (clean.length === 3) {
      const h = Math.min(23, parseInt(clean.slice(0, 1), 10) || 0).toString().padStart(2, '0');
      const m = Math.min(59, parseInt(clean.slice(1, 3), 10) || 0).toString().padStart(2, '0');
      setRawHours(h);
      setRawMinutes(m);
      onChange(`${h}:${m}`);
      minutesRef.current?.blur();
      return;
    }

    if (clean.length === 0) {
      setRawHours('');
      onChange(`00:${rawMinutes.padStart(2, '0')}`);
      return;
    }

    let num = parseInt(clean, 10);
    if (!isNaN(num) && num > 23) num = 23;
    const formatted = isNaN(num) ? '' : num.toString();
    setRawHours(formatted);
    const validH = isNaN(num) ? '00' : num.toString().padStart(2, '0');
    onChange(`${validH}:${rawMinutes.padStart(2, '0')}`);

    // Automatisch ins Minutenfeld springen, wenn 2 Ziffern eingegeben wurden
    // oder die erste Ziffer > 2 ist (z.B. 3-9 kann nur einstellig sein)
    if (clean.length === 2 || (clean.length === 1 && num > 2)) {
      minutesRef.current?.focus();
      minutesRef.current?.select();
    }
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, '');

    if (clean.length === 0) {
      setRawMinutes('');
      onChange(`${rawHours.padStart(2, '0')}:00`);
      return;
    }

    let num = parseInt(clean, 10);
    if (!isNaN(num) && num > 59) num = 59;
    const formatted = isNaN(num) ? '' : num.toString();
    setRawMinutes(formatted);
    const validM = isNaN(num) ? '00' : num.toString().padStart(2, '0');
    onChange(`${rawHours.padStart(2, '0')}:${validM}`);
  };

  const handleHoursBlur = () => {
    const h = (parseInt(rawHours, 10) || 0).toString().padStart(2, '0');
    setRawHours(h);
    onChange(`${h}:${rawMinutes.padStart(2, '0')}`);
  };

  const handleMinutesBlur = () => {
    const m = (parseInt(rawMinutes, 10) || 0).toString().padStart(2, '0');
    setRawMinutes(m);
    onChange(`${rawHours.padStart(2, '0')}:${m}`);
  };

  const handleHoursKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      minutesRef.current?.focus();
      minutesRef.current?.select();
    }
  };

  const handleMinutesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && rawMinutes === '') {
      hoursRef.current?.focus();
      hoursRef.current?.select();
    } else if (e.key === 'ArrowLeft') {
      hoursRef.current?.focus();
      hoursRef.current?.select();
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
        {label}
      </label>

      <div className="flex items-center gap-2">
        {/* Großer berührungsfreundlicher Zeiteingabe-Block */}
        <div className="flex-1 flex items-center justify-center bg-black/60 border border-white/20 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-500/25 rounded-2xl px-3 py-2 transition-all">
          <input
            ref={hoursRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2}
            value={rawHours}
            placeholder="00"
            autoFocus={autoFocus}
            onFocus={e => e.target.select()}
            onChange={handleHoursChange}
            onBlur={handleHoursBlur}
            onKeyDown={handleHoursKeyDown}
            className="w-12 text-center text-xl font-bold font-mono text-white bg-transparent outline-none cursor-text select-all"
            aria-label={`${label} Stunden`}
          />
          <span className="text-xl font-black text-cyan-400 px-1 select-none animate-pulse">:</span>
          <input
            ref={minutesRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2}
            value={rawMinutes}
            placeholder="00"
            onFocus={e => e.target.select()}
            onChange={handleMinutesChange}
            onBlur={handleMinutesBlur}
            onKeyDown={handleMinutesKeyDown}
            className="w-12 text-center text-xl font-bold font-mono text-white bg-transparent outline-none cursor-text select-all"
            aria-label={`${label} Minuten`}
          />
          <span className="text-xs font-bold text-slate-400 ml-auto pr-1 select-none">Uhr</span>
        </div>

        {/* Optionaler Nativer Picker Button für Nutzer, die den Systemdialog bevorzugen */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              try {
                if (nativePickerRef.current && 'showPicker' in HTMLInputElement.prototype) {
                  (nativePickerRef.current as any).showPicker();
                } else {
                  nativePickerRef.current?.focus();
                }
              } catch {
                nativePickerRef.current?.focus();
              }
            }}
            className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-slate-300 hover:text-cyan-300 transition-all cursor-pointer shadow-sm"
            title="System-Uhrzeitdialog öffnen"
          >
            <Clock className="w-5 h-5" />
          </button>
          <input
            ref={nativePickerRef}
            type="time"
            value={value}
            onChange={e => e.target.value && onChange(e.target.value)}
            className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
            tabIndex={-1}
          />
        </div>
      </div>

      {/* Schnellauswahl-Chips */}
      {quickChips && quickChips.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 scrollbar-none no-scrollbar">
          {quickChips.map(chip => {
            const isChipSelected = value === chip;
            return (
              <button
                key={chip}
                type="button"
                onClick={() => onChange(chip)}
                className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold transition-all active:scale-95 shrink-0 cursor-pointer ${
                  isChipSelected
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20 ring-1 ring-cyan-400/50'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5'
                }`}
              >
                {chip}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
