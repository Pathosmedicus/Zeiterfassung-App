import React, { useState } from 'react';
import { Smartphone, Laptop, RefreshCw, Copy, Check, ShieldCheck, KeyRound, AlertCircle, X } from 'lucide-react';
import { syncService } from '../../services/syncService';
import { storageService } from '../../services/storageService';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
  showToast
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [exportPin, setExportPin] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [importToken, setImportToken] = useState('');
  const [importPin, setImportPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const session = storageService.getActiveSession();

  const handleGenerateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exportPin || exportPin.trim().length < 4) {
      showToast('Bitte gib deine PIN (mind. 4 Zeichen) ein, um das Sync-Paket zu verschlüsseln.', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      const token = await syncService.createSyncToken(exportPin.trim());
      setGeneratedToken(token);
      showToast('✅ Verschlüsseltes Sync-Paket generiert!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Fehler beim Erzeugen des Sync-Codes.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    if (!generatedToken) return;
    navigator.clipboard.writeText(generatedToken);
    setCopied(true);
    showToast('📋 Sync-Code in die Zwischenablage kopiert!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importToken.trim()) {
      showToast('Bitte füge den Sync-Code ein.', 'error');
      return;
    }
    if (!importPin.trim()) {
      showToast('Bitte gib die PIN des Sync-Pakets ein.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await syncService.applySyncToken(importToken.trim(), importPin.trim());
      if (result.success) {
        showToast(result.message, 'success');
        onSyncComplete();
        onClose();
      } else {
        showToast(result.message, 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Fehler beim Einspielen des Sync-Pakets.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#0d121f] border border-cyan-500/30 rounded-3xl p-6 shadow-2xl relative text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-white/10 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white font-display">Geräte synchronisieren</h2>
            <p className="text-xs text-cyan-300">
              PC ↔ Smartphone • Verschlüsselt mit AES-256-GCM
            </p>
          </div>
        </div>

        {/* Tab-Auswahl */}
        <div className="grid grid-cols-2 gap-2 mb-4 bg-white/5 p-1 rounded-2xl border border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'export'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>Code erzeugen (Senden)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'import'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Code einfügen (Empfangen)</span>
          </button>
        </div>

        {activeTab === 'export' ? (
          <div className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Erzeuge einen sicheren, verschlüsselten Sync-Code auf diesem Gerät, um deine Schichten, Nachforderungen und den 7.230€ Radar auf dein Smartphone oder einen anderen PC zu übertragen:
            </p>

            {!generatedToken ? (
              <form onSubmit={handleGenerateToken} className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Deine PIN / Passwort zur Verschlüsselung
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={exportPin}
                      onChange={e => setExportPin(e.target.value)}
                      placeholder="PIN eingeben..."
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-cyan-400"
                    />
                    <KeyRound className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold text-xs shadow-md transition-all active:scale-[0.98]"
                >
                  {isProcessing ? 'Verschlüssele...' : '🔒 Sync-Code generieren'}
                </button>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-black/60 border border-cyan-500/30 rounded-xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                      Verschlüsselter Sync-Code
                    </span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-[11px] font-bold text-cyan-300 hover:text-white"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Kopiert!' : 'Kopieren'}</span>
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={generatedToken}
                    rows={4}
                    className="w-full bg-transparent text-[11px] font-mono text-slate-300 border-none focus:outline-none resize-none break-all"
                  />
                </div>

                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-400 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    Sende diesen Code z. B. per Messenger oder Mail an dein anderes Gerät und wähle dort "Code einfügen".
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setGeneratedToken(null)}
                  className="w-full py-2 text-xs text-slate-400 hover:text-slate-200"
                >
                  Neuen Code erstellen
                </button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleImport} className="space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              Füge den auf deinem PC erzeugten Sync-Code hier ein und gib deine PIN ein, um die Daten auf dieses Gerät zu übertragen:
            </p>

            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Sync-Code einfügen
              </label>
              <textarea
                value={importToken}
                onChange={e => setImportToken(e.target.value)}
                placeholder="ZEIT_SYNC_V1:..."
                rows={4}
                required
                className="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                PIN zur Entschlüsselung
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={importPin}
                  onChange={e => setImportPin(e.target.value)}
                  placeholder="PIN eingeben..."
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-cyan-400"
                />
                <KeyRound className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-md transition-all active:scale-[0.98]"
            >
              {isProcessing ? 'Entschlüssele & Synchronisiere...' : '📥 Jetzt synchronisieren'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
