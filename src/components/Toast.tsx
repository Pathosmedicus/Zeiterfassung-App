import React from 'react';
import { CheckCircle2, AlertCircle, Info, Undo2, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'success' | 'error' | 'info';
  actionText?: string;
  onAction?: () => void;
  duration?: number;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-11/12 max-w-sm pointer-events-none">
      {toasts.map(t => {
        const isSuccess = t.type === 'success';
        const isError = t.type === 'error';

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 bg-[#0b0f1a]/90 ${
              isSuccess
                ? 'border-emerald-500/30 text-emerald-100 shadow-emerald-500/10'
                : isError
                ? 'border-rose-500/30 text-rose-100 shadow-rose-500/10'
                : 'border-cyan-500/30 text-slate-100 shadow-cyan-500/10'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
              {isError && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
              {!isSuccess && !isError && <Info className="w-5 h-5 text-cyan-400 shrink-0" />}
              <span className="text-xs font-semibold text-white break-words">{t.text}</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {t.actionText && t.onAction && (
                <button
                  onClick={() => {
                    t.onAction?.();
                    onDismiss(t.id);
                  }}
                  className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white border border-white/10"
                >
                  <Undo2 className="w-3 h-3" />
                  {t.actionText}
                </button>
              )}
              <button
                onClick={() => onDismiss(t.id)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                title="Schließen"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
