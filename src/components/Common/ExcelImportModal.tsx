import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  ClipboardPaste,
  Trash2,
  Plus,
  RefreshCw,
  AlertCircle,
  Layers,
  CheckSquare,
  Square
} from 'lucide-react';
import { ShiftEntry } from '../../types';
import { berechneNetto } from '../../services/salaryEngine';
import {
  ImportedShiftRow,
  SheetImportSummary,
  parseTimesheetFiles,
  parsePastedTimesheetText,
  buildMonthsSummary
} from '../../services/timesheetImporter';

export type ImportMergeMode = 'merge_update' | 'merge_skip' | 'replace_all';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentYearMonth: string;
  existingShifts: ShiftEntry[];
  initialFiles?: File[] | null;
  onClearInitialFiles?: () => void;
  onConfirmImport: (
    shiftsToImport: ShiftEntry[],
    mode: ImportMergeMode
  ) => Promise<void>;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  currentYearMonth,
  existingShifts,
  initialFiles,
  onClearInitialFiles,
  onConfirmImport,
  onShowToast
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [inputTab, setInputTab] = useState<'file' | 'paste'>('file');
  const [pasteText, setPasteText] = useState('');
  const [fallbackMonth, setFallbackMonth] = useState(currentYearMonth);

  const [rows, setRows] = useState<ImportedShiftRow[]>([]);
  const [sheets, setSheets] = useState<SheetImportSummary[]>([]);
  const [activeSheetIds, setActiveSheetIds] = useState<Set<string>>(new Set());

  // Auswahl-Option beim Bestätigen: 'add' (Standard) vs. 'replace'
  const [importOption, setImportOption] = useState<'add' | 'replace'>('add');
  const [duplicateStrategy, setDuplicateStrategy] = useState<'update' | 'skip'>('update');

  useEffect(() => {
    setFallbackMonth(currentYearMonth);
  }, [currentYearMonth]);

  // Wenn das Modal mit bereits ausgewählten Dateien (z.B. aus den Optionen per Drag & Drop) geöffnet wird
  useEffect(() => {
    if (isOpen && initialFiles && initialFiles.length > 0) {
      void handleFilesSelected(initialFiles);
      if (onClearInitialFiles) onClearInitialFiles();
    }
  }, [isOpen, initialFiles]);

  const existingDateMap = useMemo(() => {
    return new Map(existingShifts.map(s => [s.datum, s]));
  }, [existingShifts]);

  const handleFilesSelected = async (fileList: File[] | FileList) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsParsing(true);
    try {
      const result = await parseTimesheetFiles(files, fallbackMonth);
      setRows(result.shifts);
      setSheets(result.sheets);
      setActiveSheetIds(new Set(result.sheets.map(s => s.sheetId)));

      if (result.shifts.length === 0) {
        onShowToast(
          'Keine gültigen Schichten in der Datei erkannt. Prüfe bitte das Tabellenformat oder nutze Copy & Paste.',
          'info'
        );
      } else {
        onShowToast(
          `✅ ${result.shifts.length} Schichten aus ${result.monthsList.length || 1} Monat(en) erkannt!`,
          'success'
        );
      }
    } catch (err: any) {
      console.error('Fehler beim Datei-Import:', err);
      onShowToast(err?.message || 'Fehler beim Lesen der Datei.', 'error');
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleParsePaste = () => {
    if (!pasteText.trim()) {
      onShowToast('Bitte kopiere zuerst Zeilen aus deiner Excel-Tabelle in das Textfeld.', 'info');
      return;
    }
    const result = parsePastedTimesheetText(pasteText, fallbackMonth);
    setRows(result.shifts);
    setSheets(result.sheets);
    setActiveSheetIds(new Set(result.sheets.map(s => s.sheetId)));

    if (result.shifts.length === 0) {
      onShowToast('Keine gültigen Schichten im eingefügten Text erkannt.', 'error');
    } else {
      onShowToast(`✅ ${result.shifts.length} Schichten aus Zwischenablage erkannt!`, 'success');
    }
  };

  // Sichtbare Zeilen nach Tabellenblatt-Filter
  const visibleRows = useMemo(() => {
    if (sheets.length <= 1) return rows;
    return rows.filter(r => activeSheetIds.has(`${r.sourceFile}::${r.sourceSheet}`));
  }, [rows, sheets, activeSheetIds]);

  const selectedRows = useMemo(() => {
    return visibleRows.filter(r => r.selected && r.nettoStunden > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.datum));
  }, [visibleRows]);

  const { monthsList, monthsRangeLabel } = useMemo(() => {
    return buildMonthsSummary(selectedRows);
  }, [selectedRows]);

  const totalPreviewHours = useMemo(() => {
    return selectedRows.reduce((sum, r) => sum + (r.nettoStunden || 0), 0);
  }, [selectedRows]);

  const toggleSheetFilter = (sheetId: string) => {
    setActiveSheetIds(prev => {
      const next = new Set(prev);
      if (next.has(sheetId)) {
        next.delete(sheetId);
      } else {
        next.add(sheetId);
      }
      return next;
    });
  };

  const toggleRowSelection = (rowId: string) => {
    setRows(prev =>
      prev.map(r => (r.rowId === rowId ? { ...r, selected: !r.selected } : r))
    );
  };

  const toggleSelectAll = () => {
    const allSelected = visibleRows.every(r => r.selected);
    const visibleIds = new Set(visibleRows.map(r => r.rowId));
    setRows(prev =>
      prev.map(r => (visibleIds.has(r.rowId) ? { ...r, selected: !allSelected } : r))
    );
  };

  const handleUpdateRowField = (
    rowId: string,
    field: 'datum' | 'kommen' | 'gehen' | 'pauseMinuten',
    value: string
  ) => {
    setRows(prev =>
      prev.map(r => {
        if (r.rowId !== rowId) return r;
        const updated = { ...r };
        if (field === 'datum') {
          updated.datum = value;
        } else if (field === 'kommen') {
          updated.kommen = value;
        } else if (field === 'gehen') {
          updated.gehen = value;
        } else if (field === 'pauseMinuten') {
          updated.pauseMinuten = Math.max(0, parseInt(value.replace(/\D/g, ''), 10) || 0);
        }

        const netto = berechneNetto(updated.kommen, updated.gehen, updated.pauseMinuten);
        if (netto > 0) {
          updated.nettoStunden = netto;
        }
        return updated;
      })
    );
  };

  const handleDeletePreviewRow = (rowId: string) => {
    setRows(prev => prev.filter(r => r.rowId !== rowId));
  };

  const handleResetPreview = () => {
    setRows([]);
    setSheets([]);
    setPasteText('');
  };

  const handleExecuteImport = async () => {
    if (selectedRows.length === 0) {
      onShowToast('Bitte wähle mindestens eine Schicht für den Import aus.', 'info');
      return;
    }

    const mode: ImportMergeMode =
      importOption === 'replace'
        ? 'replace_all'
        : duplicateStrategy === 'skip'
        ? 'merge_skip'
        : 'merge_update';

    const cleanShifts: ShiftEntry[] = selectedRows.map(r => ({
      datum: r.datum,
      kommen: r.kommen,
      gehen: r.gehen,
      pauseMinuten: r.pauseMinuten,
      nettoStunden: r.nettoStunden,
      schichtTyp: r.schichtTyp || 'Importiert',
      notiz: r.notiz,
      updatedAt: new Date().toISOString()
    }));

    setIsImporting(true);
    try {
      await onConfirmImport(cleanShifts, mode);
      handleResetPreview();
      onClose();
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#0c1222] border border-cyan-500/30 rounded-3xl shadow-2xl shadow-cyan-950/50 overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-blue-500/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-cyan-500/25 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0 shadow-lg shadow-emerald-500/10">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white font-display truncate">
                📊 Alte Stundenzettel & Excel-Tabellen importieren (2025–2026)
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                Erkennt automatisch Schichten aus .xlsx, .xls, .csv, .pdf & Copy-Paste (inkl. Multi-Sheet)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Upload / Copy-Paste Auswahl-Bereich */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 p-1 bg-white/[0.04] rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setInputTab('file')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    inputTab === 'file'
                      ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Datei hochladen (.xlsx, .xls, .csv, .pdf)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputTab('paste')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    inputTab === 'paste'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>Copy & Paste aus Excel</span>
                </button>
              </div>

              {/* Fallback-Monat für Tabellen ohne explizites Jahr/Monat */}
              <div className="flex items-center gap-2 text-xs bg-white/[0.03] px-3 py-1.5 rounded-xl border border-white/10">
                <span className="text-slate-400 text-[11px]">Standard-Monat (falls nur Tag 1–31):</span>
                <input
                  type="month"
                  value={fallbackMonth}
                  onChange={e => e.target.value && setFallbackMonth(e.target.value)}
                  className="bg-black/40 border border-white/15 rounded-lg px-2 py-0.5 text-xs font-bold text-cyan-300 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {inputTab === 'file' ? (
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    void handleFilesSelected(e.dataTransfer.files);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 sm:p-6 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-emerald-400 bg-emerald-500/15 scale-[0.99]'
                    : 'border-cyan-500/30 hover:border-cyan-400/60 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".xlsx,.xls,.csv,.tsv,.pdf,.txt,.json"
                  onChange={e => e.target.files && void handleFilesSelected(e.target.files)}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                    <Upload className={`w-5 h-5 ${isParsing ? 'animate-bounce' : ''}`} />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-white">
                      {isParsing
                        ? 'Tabellenblätter werden analysiert...'
                        : 'Excel-Tabellen (.xlsx, .xls), .csv oder .pdf hierher ziehen oder antippen'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Unterstützt Einzel- und Sammel-Tabellen mit mehreren Monatsblättern (z.B. „Aug 25“ bis „Okt 26“)
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 bg-white/[0.02] p-3.5 rounded-2xl border border-white/10">
                <textarea
                  rows={4}
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder={
                    'Markiere deine Zeilen in Excel (Strg+C) und füge sie hier ein (Strg+V):\n26.10.2025\t07:30\t16:00\t30\n27.10.2025\t13:30\t22:00\t0:30'
                  }
                  className="w-full rounded-xl bg-black/50 border border-white/15 p-3 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleParsePaste}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 cursor-pointer"
                  >
                    🔍 Eingefügte Zeilen erkennen
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* VORSCHAU-BEREICH (sobald Zeilen erkannt wurden) */}
          {rows.length > 0 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Grünes Erkennungs-Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-emerald-200">
                      ✅ {selectedRows.length} Schichten aus {monthsList.length || 1}{' '}
                      {monthsList.length === 1 ? 'Monat' : 'Monaten'}{' '}
                      {monthsRangeLabel ? `(${monthsRangeLabel})` : ''} erkannt!
                    </p>
                    <p className="text-[11px] text-emerald-300/80">
                      Gesamtumfang der Auswahl: <strong>{totalPreviewHours.toFixed(2)} Netto-Stunden</strong> • Du kannst Haken abwählen oder Zeiten direkt korrigieren.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetPreview}
                  className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Auswahl leeren</span>
                </button>
              </div>

              {/* Multi-Sheet Auswahl-Filter (wenn mehrere Tabellenblätter erkannt wurden) */}
              {sheets.length > 1 && (
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Erkannte Tabellenblätter ({sheets.length}) – antippen zum Filtern:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {sheets.map(sh => {
                      const active = activeSheetIds.has(sh.sheetId);
                      return (
                        <button
                          key={sh.sheetId}
                          type="button"
                          onClick={() => toggleSheetFilter(sh.sheetId)}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                            active
                              ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                              : 'bg-white/5 border-white/10 text-slate-500 line-through'
                          }`}
                        >
                          <span>{sh.sheetName}</span>
                          <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px]">
                            {sh.shiftCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Scrollbare Vorschau-Tabelle der erkannten Schichten */}
              <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/30">
                <div className="max-h-64 sm:max-h-72 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-[#111827] text-slate-300 border-b border-white/10 text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 pl-3 pr-1 w-9 text-center">
                          <button
                            type="button"
                            onClick={toggleSelectAll}
                            className="text-cyan-400 hover:text-cyan-300 cursor-pointer"
                            title="Alle auswählen / abwählen"
                          >
                            {visibleRows.length > 0 && visibleRows.every(r => r.selected) ? (
                              <CheckSquare className="w-4 h-4 inline" />
                            ) : (
                              <Square className="w-4 h-4 inline" />
                            )}
                          </button>
                        </th>
                        <th className="py-2.5 px-2">Datum</th>
                        <th className="py-2.5 px-1.5 text-center">Kommen</th>
                        <th className="py-2.5 px-1.5 text-center">Gehen</th>
                        <th className="py-2.5 px-1.5 text-center">Pause (Min)</th>
                        <th className="py-2.5 px-2 text-center">Netto (h)</th>
                        <th className="py-2.5 px-2 hidden sm:table-cell">Blatt / Status</th>
                        <th className="py-2.5 pr-3 pl-1 text-center w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {visibleRows.map(row => {
                        const existing = existingDateMap.get(row.datum);
                        return (
                          <tr
                            key={row.rowId}
                            className={`transition-colors ${
                              row.selected ? 'hover:bg-white/[0.03]' : 'opacity-40 bg-black/20'
                            }`}
                          >
                            <td className="py-1.5 pl-3 pr-1 text-center">
                              <input
                                type="checkbox"
                                checked={row.selected}
                                onChange={() => toggleRowSelection(row.rowId)}
                                className="w-4 h-4 rounded accent-cyan-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="date"
                                value={row.datum}
                                onChange={e => handleUpdateRowField(row.rowId, 'datum', e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono font-bold text-white focus:border-cyan-400 focus:outline-none"
                              />
                            </td>
                            <td className="py-1.5 px-1.5 text-center">
                              <input
                                type="text"
                                value={row.kommen}
                                maxLength={5}
                                onChange={e => handleUpdateRowField(row.rowId, 'kommen', e.target.value)}
                                className="w-16 bg-black/40 border border-white/10 rounded-lg px-1.5 py-1 text-xs font-mono font-bold text-center text-white focus:border-cyan-400 focus:outline-none"
                              />
                            </td>
                            <td className="py-1.5 px-1.5 text-center">
                              <input
                                type="text"
                                value={row.gehen}
                                maxLength={5}
                                onChange={e => handleUpdateRowField(row.rowId, 'gehen', e.target.value)}
                                className="w-16 bg-black/40 border border-white/10 rounded-lg px-1.5 py-1 text-xs font-mono font-bold text-center text-white focus:border-cyan-400 focus:outline-none"
                              />
                            </td>
                            <td className="py-1.5 px-1.5 text-center">
                              <input
                                type="number"
                                min={0}
                                max={240}
                                step={5}
                                value={row.pauseMinuten}
                                onChange={e => handleUpdateRowField(row.rowId, 'pauseMinuten', e.target.value)}
                                className="w-14 bg-black/40 border border-white/10 rounded-lg px-1.5 py-1 text-xs font-mono font-bold text-center text-white focus:border-cyan-400 focus:outline-none"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <span className="font-mono font-black text-emerald-300 text-xs">
                                {row.nettoStunden.toFixed(2)} h
                              </span>
                            </td>
                            <td className="py-1.5 px-2 hidden sm:table-cell">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-slate-300 truncate max-w-[110px]">
                                  {row.sourceSheet}
                                </span>
                                {existing ? (
                                  <span
                                    className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                    title={`Vorhanden: ${existing.kommen}–${existing.gehen} (${existing.nettoStunden.toFixed(2)}h)`}
                                  >
                                    Vorhanden ({existing.nettoStunden.toFixed(2)}h)
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                    Neu
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-1.5 pr-3 pl-1 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeletePreviewRow(row.rowId)}
                                className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Zeile aus Vorschau entfernen"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ZWEI AUSWAHL-OPTIONEN BEIM BESTÄTIGEN */}
              <div className="space-y-2.5 bg-white/[0.03] p-4 rounded-2xl border border-white/10">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Wie sollen die erkannten Schichten eingefügt werden?
                </p>

                <div className="grid grid-cols-1 gap-2.5">
                  {/* Option 1: Zu bestehenden Schichten hinzufügen (Standard) */}
                  <label
                    onClick={() => setImportOption('add')}
                    className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                      importOption === 'add'
                        ? 'bg-emerald-500/15 border-emerald-400/60 text-white shadow-md shadow-emerald-950/30'
                        : 'bg-white/[0.02] border-white/10 text-slate-300 hover:bg-white/[0.04]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importOption === 'add'}
                      onChange={() => setImportOption('add')}
                      className="mt-1 accent-emerald-500"
                    />
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-white">
                          ➕ Zu bestehenden Schichten hinzufügen (Duplikate am selben Tag überspringen/aktualisieren)
                        </span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-400/30">
                          Empfohlen
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Ideal, um alte Monate aus 2025/2026 nachzutragen, ohne deine übrigen Monate zu verlieren.
                      </p>

                      {importOption === 'add' && (
                        <div
                          className="flex flex-wrap items-center gap-2 pt-1"
                          onClick={e => e.stopPropagation()}
                        >
                          <span className="text-[11px] text-slate-400">Falls ein Tag schon belegt ist:</span>
                          <button
                            type="button"
                            onClick={() => setDuplicateStrategy('update')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                              duplicateStrategy === 'update'
                                ? 'bg-cyan-500/25 border-cyan-400/60 text-cyan-200'
                                : 'bg-black/30 border-white/10 text-slate-400'
                            }`}
                          >
                            Tag mit Import aktualisieren
                          </button>
                          <button
                            type="button"
                            onClick={() => setDuplicateStrategy('skip')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                              duplicateStrategy === 'skip'
                                ? 'bg-cyan-500/25 border-cyan-400/60 text-cyan-200'
                                : 'bg-black/30 border-white/10 text-slate-400'
                            }`}
                          >
                            Bestehenden Tag behalten (überspringen)
                          </button>
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Option 2: Alle vorhandenen Schichten durch diese Datei ersetzen */}
                  <label
                    onClick={() => setImportOption('replace')}
                    className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                      importOption === 'replace'
                        ? 'bg-amber-500/15 border-amber-400/60 text-white shadow-md shadow-amber-950/30'
                        : 'bg-white/[0.02] border-white/10 text-slate-300 hover:bg-white/[0.04]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importOption === 'replace'}
                      onChange={() => setImportOption('replace')}
                      className="mt-1 accent-amber-500"
                    />
                    <div className="flex-1">
                      <span className="text-xs sm:text-sm font-bold text-white block">
                        🔄 Alle vorhandenen Schichten durch diese Datei ersetzen
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Ersetzt deinen gesamten Schichtbestand komplett durch die oben ausgewählten {selectedRows.length} Schichten.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Kurzer Format-Hilfehinweis wenn noch keine Datei geladen */}
          {rows.length === 0 && (
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5 text-[11px] text-slate-400">
              <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-slate-300 font-semibold">
                  Automatische Spalten- & Format-Erkennung (Smart Column Mapping):
                </p>
                <p>
                  Erkennt offizielle Klinik-Stundenzettel sowie eigene Excel-Tabellen mit Spalten wie{' '}
                  <code className="text-cyan-300">Datum / Tag / Date</code>,{' '}
                  <code className="text-cyan-300">Kommen / Beginn / Start / Von</code>,{' '}
                  <code className="text-cyan-300">Gehen / Ende / Bis</code> und{' '}
                  <code className="text-cyan-300">Pause (15, 30, 0:30, 0,5 Std)</code>. Leere Tage und Summenzeilen werden automatisch ausgefiltert.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-t border-white/10 bg-[#080d19]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold border border-white/10 transition-all cursor-pointer"
          >
            Abbrechen
          </button>

          <button
            type="button"
            disabled={selectedRows.length === 0 || isImporting}
            onClick={handleExecuteImport}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-lg ${
              selectedRows.length > 0 && !isImporting
                ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white shadow-emerald-500/25 active:scale-95 cursor-pointer'
                : 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed'
            }`}
          >
            {importOption === 'replace' ? (
              <RefreshCw className={`w-4 h-4 ${isImporting ? 'animate-spin' : ''}`} />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>
              {isImporting
                ? 'Wird gespeichert & synchronisiert...'
                : `Jetzt ${selectedRows.length} Schichten importieren`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
