import React from 'react';
import { ShiftEntry, UserProfile } from '../../types';
import { berechneMinuten } from '../../services/salaryEngine';

interface SheetPreviewProps {
  currentYearMonth: string;
  shifts: ShiftEntry[];
  userProfile: UserProfile;
}

const MONATSNAMEN = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

export const SheetPreview: React.FC<SheetPreviewProps> = ({
  currentYearMonth,
  shifts,
  userProfile
}) => {
  const [jStr, mStr] = currentYearMonth.split('-');
  const jahr = parseInt(jStr, 10);
  const monat = parseInt(mStr, 10);
  const tageImMonat = new Date(jahr, monat, 0).getDate();
  const shiftMap = new Map(shifts.map(s => [s.datum, s]));

  let summeMinuten = 0;
  let summeDezimal = 0;

  const rows = [];
  for (let tag = 1; tag <= tageImMonat; tag++) {
    const tagStr = String(tag).padStart(2, '0');
    const monatStr = String(monat).padStart(2, '0');
    const jahrKurz = String(jahr).slice(-2);
    const anzeigeDatum = `${tagStr}.${monatStr}.${jahrKurz}`;
    const suchDatum = `${jahr}-${monatStr}-${tagStr}`;
    const eintrag = shiftMap.get(suchDatum);

    let netM = 0;
    let arbeitszeitHHMM = "0:00";
    let dezimalStr = "0,00";
    let pauseHHMM = "";

    if (eintrag && (eintrag.kommen || eintrag.nettoStunden > 0)) {
      netM = berechneMinuten(eintrag.kommen, eintrag.gehen, eintrag.pauseMinuten);
      summeMinuten += netM;
      summeDezimal += eintrag.nettoStunden;
      const std = Math.floor(netM / 60);
      const min = netM % 60;
      arbeitszeitHHMM = `${std}:${String(min).padStart(2, '0')}`;
      dezimalStr = eintrag.nettoStunden.toFixed(2).replace('.', ',');

      if (eintrag.pauseMinuten > 0) {
        const pStd = Math.floor(eintrag.pauseMinuten / 60);
        const pMin = eintrag.pauseMinuten % 60;
        pauseHHMM = `${String(pStd).padStart(2, '0')}:${String(pMin).padStart(2, '0')}`;
      }
    }

    rows.push({
      tag,
      anzeigeDatum,
      eintrag,
      arbeitszeitHHMM,
      dezimalStr,
      pauseHHMM
    });
  }

  const gesStd = Math.floor(summeMinuten / 60);
  const gesMin = summeMinuten % 60;

  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">
          Offizielle Stundenzettel-Druckansicht (A4 Portrait)
        </h3>
        <span className="text-[11px] font-semibold text-cyan-400 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20">
          Mühlenkreiskliniken Minden
        </span>
      </div>

      {/* Papier-Simulation */}
      <div className="border border-slate-300 dark:border-zinc-700 bg-white text-slate-900 p-4 sm:p-6 rounded-2xl shadow-inner max-w-full overflow-x-auto text-xs">
        {/* Briefkopf */}
        <div className="mb-4 space-y-1 text-slate-900">
          <div className="flex gap-2">
            <span className="w-32 font-semibold">Name:</span>
            <span className="font-bold underline">
              {userProfile.vorname} {userProfile.name}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="w-32 font-semibold">Personalnummer:</span>
            <span className="font-bold underline">
              {userProfile.personalnummer}
            </span>
          </div>
          <div className="flex gap-2 text-[10px] text-slate-600">
            <span className="w-32 font-semibold">Institut / Klinik:</span>
            <span>
              {(userProfile.abteilung && userProfile.abteilung !== 'Radiologie' && userProfile.abteilung !== 'Radiologie & Nuklearmedizin')
                ? userProfile.abteilung
                : 'Universitätsinstitut für Radiologie, Neuroradiologie und Nuklearmedizin'} • {(userProfile.klinik && userProfile.klinik !== 'Klinikum' && userProfile.klinik !== 'Universitätsklinikum')
                ? userProfile.klinik
                : 'Mühlenkreiskliniken Minden'}
            </span>
          </div>
        </div>

        {/* Tabelle */}
        <div className="border border-black">
          <div className="border-b border-black py-1.5 text-center font-bold text-sm bg-slate-50">
            Stundenübersichtstabelle – {MONATSNAMEN[monat - 1]} {jahr}
          </div>

          <table className="w-full text-center border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-black font-semibold bg-slate-50">
                <th className="border-r border-black p-1 w-20"></th>
                <th className="border-r border-black p-1 w-10"></th>
                <th className="border-r border-black p-1 w-16"></th>
                <th className="border-r border-black p-1 w-10"></th>
                <th className="border-r border-black p-1 w-16"></th>
                <th className="border-r border-black p-1 w-16">Pause</th>
                <th className="border-r border-black p-1 w-24">Geleistete Stunden</th>
                <th className="p-1 w-24">Stunden in Zahl</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.anzeigeDatum} className="border-b border-black/30">
                  <td className="border-r border-black p-0.5 font-medium">{r.anzeigeDatum}</td>
                  {i === 0 && (
                    <td rowSpan={tageImMonat} className="border-r border-black p-1 align-middle font-medium bg-slate-50">
                      Von
                    </td>
                  )}
                  <td className={`border-r border-black p-0.5 font-bold ${r.eintrag?.kommen ? 'bg-[#92D050]' : ''}`}>
                    {r.eintrag?.kommen || ''}
                  </td>
                  {i === 0 && (
                    <td rowSpan={tageImMonat} className="border-r border-black p-1 align-middle font-medium bg-slate-50">
                      Bis
                    </td>
                  )}
                  <td className={`border-r border-black p-0.5 font-bold ${r.eintrag?.gehen ? 'bg-[#92D050]' : ''}`}>
                    {r.eintrag?.gehen || ''}
                  </td>
                  <td className={`border-r border-black p-0.5 font-bold ${r.pauseHHMM ? 'bg-rose-500 text-white' : ''}`}>
                    {r.pauseHHMM || ''}
                  </td>
                  <td className={`border-r border-black p-0.5 font-bold ${r.eintrag?.nettoStunden ? 'bg-[#92D050]' : ''}`}>
                    {r.arbeitszeitHHMM}
                  </td>
                  <td className={`p-0.5 font-bold ${r.eintrag?.nettoStunden ? 'bg-[#92D050]' : ''}`}>
                    {r.dezimalStr}
                  </td>
                </tr>
              ))}

              {/* Schwarzer Trennbalken */}
              <tr>
                <td colSpan={8} className="bg-black h-1.5 border-t border-b border-black"></td>
              </tr>

              {/* Gesamt-Zeile */}
              <tr className="font-bold border-b border-black bg-slate-50">
                <td colSpan={6} className="border-r border-black p-1.5 text-center">
                  Gesamt
                </td>
                <td className="border-r border-black p-1.5 bg-[#92D050]">
                  {gesStd}:{String(gesMin).padStart(2, '0')}
                </td>
                <td className="p-1.5 bg-[#92D050]">
                  {summeDezimal.toFixed(2).replace('.', ',')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Unterschriftenzeilen */}
        <div className="mt-8 flex justify-between pt-4">
          <div className="w-5/12">
            <div className="border-b border-black mb-1 h-6"></div>
            <span className="font-bold text-xs">Datum und Ort</span>
          </div>
          <div className="w-5/12">
            <div className="border-b border-black mb-1 h-6"></div>
            <span className="font-bold text-xs">Unterschrift</span>
          </div>
        </div>
      </div>
    </div>
  );
};
