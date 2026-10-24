import React, { useRef } from 'react';
import { Save, Upload, AlertTriangle, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { storageService } from '../../services/storageService';

interface BackupManagerProps {
  currentYearMonth: string;
  onDataReload: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const BackupManager: React.FC<BackupManagerProps> = ({
  currentYearMonth,
  onDataReload,
  onShowToast
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = () => {
    try {
      const backup = storageService.createBackup();
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `Zeiterfassung_Radiologie_Backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onShowToast('💾 Backup-Datei erfolgreich gespeichert!', 'success');
    } catch (err: any) {
      onShowToast(`Fehler beim Backup-Export: ${err?.message}`, 'error');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const result = storageService.restoreBackup(parsed);

        if (result.success) {
          onShowToast(result.message, 'success');
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.8 }
          });
          onDataReload();
        } else {
          onShowToast(`Fehler: ${result.message}`, 'error');
        }
      } catch (err: any) {
        onShowToast('Ungültige JSON-Datei.', 'error');
      }

      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  const handleDeleteMonth = () => {
    if (window.confirm(`Möchtest du wirklich alle eingetragenen Schichten für ${currentYearMonth} löschen?`)) {
      storageService.deleteMonth(currentYearMonth);
      onDataReload();
      onShowToast(`Schichten für ${currentYearMonth} gelöscht.`, 'info');
    }
  };

  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden group space-y-4">
      {/* Ambient glow */}
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/15 transition-all duration-700" />

      <div className="flex items-center gap-3 relative z-10">
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide font-display">
            Datensicherung & Wiederherstellung
          </h3>
          <p className="text-[11px] text-slate-400">
            Lokale Backups herunterladen oder einspielen
          </p>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed bg-white/[0.02] p-3 rounded-2xl border border-white/5 relative z-10">
        Alle Daten verbleiben 100 % sicher und privat in deinem Browser. Du kannst jederzeit ein vollständiges JSON-Backup erstellen oder importieren.
      </p>

      <div className="grid grid-cols-2 gap-3 relative z-10">
        <button
          onClick={handleExportBackup}
          className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 active:scale-98 transition-all"
        >
          <Save className="w-4 h-4" />
          <span>Backup sichern</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white font-bold text-xs border border-white/10 active:scale-98 transition-all"
        >
          <Upload className="w-4 h-4" />
          <span>Backup laden</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          className="hidden"
        />
      </div>

      {/* Gefahrzone */}
      <div className="pt-3 border-t border-white/10 relative z-10">
        <button
          type="button"
          onClick={handleDeleteMonth}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 font-bold text-xs border border-rose-500/30 transition-all active:scale-98"
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Alle Schichten für {currentYearMonth} löschen</span>
        </button>
      </div>
    </div>
  );
};
