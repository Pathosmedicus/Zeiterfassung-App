import React, { useState, useEffect } from 'react';

export interface PauseInputFieldProps {
  label?: string;
  value: number; // Minuten z.B. 0, 15, 30, 45
  onChange: (minutes: number) => void;
  className?: string;
}

const DEFAULT_PAUSE_CHIPS = [0, 15, 30, 45, 60];

export const PauseInputField: React.FC<PauseInputFieldProps> = ({
  label = 'Pause (Minuten)',
  value,
  onChange,
  className = ''
}) => {
  const [rawText, setRawText] = useState<string>((value ?? 0).toString());

  useEffect(() => {
    setRawText((value ?? 0).toString());
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, '');
    setRawText(clean);
    const parsed = parseInt(clean, 10);
    onChange(isNaN(parsed) ? 0 : Math.min(240, parsed));
  };

  const handleBlur = () => {
    const parsed = parseInt(rawText, 10);
    const valid = isNaN(parsed) ? 0 : Math.min(240, parsed);
    setRawText(valid.toString());
    onChange(valid);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
          {label}
        </label>
        <div className="flex items-center gap-1">
          {DEFAULT_PAUSE_CHIPS.map(p => {
            const isSelected = value === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setRawText(p.toString());
                  onChange(p);
                }}
                className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm ring-1 ring-cyan-400/50'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                }`}
              >
                {p}m
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center bg-black/60 border border-white/20 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-500/25 rounded-2xl px-4 py-2.5 transition-all">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={rawText}
          placeholder="0"
          onFocus={e => e.target.select()}
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full text-center text-xl font-bold font-mono text-white bg-transparent outline-none cursor-text select-all"
          aria-label={label}
        />
        <span className="text-xs font-bold text-slate-400 ml-2 select-none shrink-0">Minuten</span>
      </div>
    </div>
  );
};
