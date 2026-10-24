import React, { useState, useEffect } from 'react';
import { Mail, Save, Clock, Trash2, Send, RotateCcw, Eye, Sparkles } from 'lucide-react';
import { UserProfile, ShiftEntry, EmailTemplate, EmailHistoryItem } from '../../types';
import { storageService } from '../../services/storageService';
import { downloadTimesheetPDF } from '../../services/pdfService';

interface EmailTemplateCardProps {
  currentYearMonth: string;
  shifts: ShiftEntry[];
  userProfile: UserProfile;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const MONATSNAMEN = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

const DEFAULT_TEMPLATE: EmailTemplate = {
  recipient: '',
  subject: 'Stundenübersicht {MONAT} {JAHR}',
  body: 'Sehr geehrte Damen und Herren,\n\nanbei sende ich Ihnen meine Stundenübersicht für den Monat {MONAT} {JAHR}.\n\nMit freundlichen Grüßen,\n{VORNAME} {NAME}'
};

export const EmailTemplateCard: React.FC<EmailTemplateCardProps> = ({
  currentYearMonth,
  shifts,
  userProfile,
  onShowToast
}) => {
  const [jStr, mStr] = currentYearMonth.split('-');
  const jahr = parseInt(jStr, 10);
  const monat = parseInt(mStr, 10);
  const monatName = MONATSNAMEN[monat - 1] || 'Monat';

  const [template, setTemplate] = useState<EmailTemplate>(() => storageService.getEmailTemplate());
  const [history, setHistory] = useState<EmailHistoryItem[]>(() => storageService.getEmailHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setTemplate(storageService.getEmailTemplate());
    setHistory(storageService.getEmailHistory());
  }, []);

  const handleSaveTemplate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    storageService.saveEmailTemplate(template);
    onShowToast('✅ E-Mail-Vorlage gespeichert.', 'success');
  };

  const handleResetDefault = () => {
    setTemplate(DEFAULT_TEMPLATE);
    storageService.saveEmailTemplate(DEFAULT_TEMPLATE);
    onShowToast('Voreingestellte Standard-Vorlage wiederhergestellt.', 'info');
  };

  // Ersetze Platzhalter für die Live-Vorschau und den Versand
  const resolvePlaceholders = (text: string) => {
    const pVorname = userProfile.vorname || '';
    const pName = userProfile.name || '';
    return text
      .replace(/{MONAT}/g, monatName)
      .replace(/{JAHR}/g, String(jahr))
      .replace(/{NAME}/g, pName)
      .replace(/{VORNAME}/g, pVorname);
  };

  const handleSendEmail = () => {
    try {
      // 1. Vektor-PDF herunterladen
      downloadTimesheetPDF(jahr, monat, shifts, userProfile);

      // 2. Betreff & Nachrichtentext auflösen
      const resolvedSubject = resolvePlaceholders(template.subject);
      const resolvedBody = resolvePlaceholders(template.body);

      // 3. Im Verlauf protokollieren
      const updatedHistory = storageService.addEmailHistory(`${monatName} ${jahr}`);
      setHistory(updatedHistory);

      onShowToast(`✅ PDF heruntergeladen! E-Mail-Programm öffnet sich...`, 'success');

      // 4. Mailto öffnen
      setTimeout(() => {
        window.location.href = `mailto:${encodeURIComponent(template.recipient)}?subject=${encodeURIComponent(resolvedSubject)}&body=${encodeURIComponent(resolvedBody)}`;
      }, 700);
    } catch (err: any) {
      onShowToast(`Fehler beim Senden: ${err?.message}`, 'error');
    }
  };

  const handleClearHistory = () => {
    if (window.confirm("Möchtest du den gesamten E-Mail-Verlauf leeren?")) {
      storageService.clearEmailHistory();
      setHistory([]);
      onShowToast("E-Mail-Verlauf geleert.", 'info');
    }
  };

  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 relative overflow-hidden group">
      {/* Ambient background glow */}
      <div className="absolute -top-16 -right-16 w-44 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/15 transition-all duration-700" />

      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide font-display">
              E-Mail-Vorlage & Versand
            </h3>
            <p className="text-[11px] text-slate-400">
              Vordefinierte Vorlage für die monatliche Stundenzettel-Einreichung
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition-all"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{showPreview ? 'Editor' : 'Vorschau'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-slate-400 hover:text-white transition-all"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Verlauf ({history.length})</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSaveTemplate} className="space-y-3.5 relative z-10">
        {/* Empfänger E-Mail */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
            Empfänger E-Mail (Optional)
          </label>
          <input
            type="email"
            value={template.recipient}
            onChange={e => setTemplate({ ...template, recipient: e.target.value })}
            onBlur={() => handleSaveTemplate()}
            placeholder="z.B. personalabteilung@klinik.de"
            className="w-full px-4 py-2.5 rounded-2xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/50 transition-all"
          />
        </div>

        {/* Betreff */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
            Betreff
          </label>
          <input
            type="text"
            value={template.subject}
            onChange={e => setTemplate({ ...template, subject: e.target.value })}
            onBlur={() => handleSaveTemplate()}
            placeholder="Stundenübersicht {MONAT} {JAHR}"
            className="w-full px-4 py-2.5 rounded-2xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs font-bold focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/50 transition-all"
            required
          />
        </div>

        {/* Nachrichtentext */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
            Nachrichtentext
          </label>
          <textarea
            rows={4}
            value={template.body}
            onChange={e => setTemplate({ ...template, body: e.target.value })}
            onBlur={() => handleSaveTemplate()}
            className="w-full px-4 py-3 rounded-2xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs leading-relaxed focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/50 font-mono transition-all"
            required
          />
        </div>

        {/* Platzhalter-Pillen */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
          <span className="font-semibold text-slate-400">Verfügbare Platzhalter:</span>
          {['{MONAT}', '{JAHR}', '{VORNAME}', '{NAME}'].map(tag => (
            <code key={tag} className="px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-mono text-[10px] font-semibold">
              {tag}
            </code>
          ))}
        </div>

        {/* Live-Vorschau Box */}
        {showPreview && (
          <div className="p-4 bg-cyan-950/30 rounded-2xl border border-cyan-500/30 space-y-2 text-xs">
            <div className="text-[10px] font-bold text-cyan-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Live-Vorschau für {monatName} {jahr}:</span>
            </div>
            <div className="font-bold text-white">
              Betreff: {resolvePlaceholders(template.subject)}
            </div>
            <div className="whitespace-pre-line text-slate-300 font-mono text-[11px] pt-1 leading-relaxed border-t border-cyan-500/20">
              {resolvePlaceholders(template.body)}
            </div>
          </div>
        )}

        {/* Buttons: Vorlage speichern, Reset & Direkt versenden */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
          <button
            type="submit"
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white font-bold text-xs border border-white/10 transition-all active:scale-98"
          >
            <Save className="w-3.5 h-3.5 text-slate-400" />
            <span>Vorlage speichern</span>
          </button>

          <button
            type="button"
            onClick={handleResetDefault}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-medium text-xs border border-white/10 transition-all"
            title="Auf Werkseinstellung zurücksetzen"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Standard</span>
          </button>

          <button
            type="button"
            onClick={handleSendEmail}
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all active:scale-98"
          >
            <Send className="w-3.5 h-3.5" />
            <span>PDF herunterladen & E-Mail öffnen</span>
          </button>
        </div>
      </form>

      {/* Gesendete Monate Verlauf */}
      {showHistory && (
        <div className="pt-4 border-t border-white/10 space-y-2.5 relative z-10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">
              Gesendete Monate (Verlauf)
            </span>
            {history.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="text-[11px] text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Verlauf leeren</span>
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic text-center py-3 bg-white/[0.02] rounded-2xl border border-white/5">
              Noch keine E-Mails versendet.
            </p>
          ) : (
            <ul className="divide-y divide-white/5 text-xs">
              {history.map(item => (
                <li key={item.id} className="py-2.5 flex items-center justify-between px-2 hover:bg-white/[0.02] rounded-xl transition-colors">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    📄 {item.zielMonat}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {item.datumGesendet}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default EmailTemplateCard;
