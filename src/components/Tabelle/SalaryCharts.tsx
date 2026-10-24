import React, { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  BarController
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { BarChart3, ChevronLeft, ChevronRight, Clock, Coins, Layers } from 'lucide-react';
import { ShiftEntry, SalaryConfig } from '../../types';
import { calculateMonthSalary } from '../../services/salaryEngine';

// ChartJS Module und Plugin registrieren
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

interface SalaryChartsProps {
  currentYearMonth: string;
  shifts: ShiftEntry[];
  salaryConfig: SalaryConfig;
  isDarkMode: boolean;
}

const MONATSKUERZEL = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export const SalaryCharts: React.FC<SalaryChartsProps> = ({
  currentYearMonth,
  shifts,
  salaryConfig,
  isDarkMode
}) => {
  const [jStr, mStr] = currentYearMonth.split('-');
  const [selectedYear, setSelectedYear] = useState<number>(parseInt(jStr, 10));
  const activeMonth = parseInt(mStr, 10);
  const [viewMode, setViewMode] = useState<'both' | 'hours' | 'salary'>('both');

  const hoursCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const salaryCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hoursChartInstance = useRef<ChartJS | null>(null);
  const salaryChartInstance = useRef<ChartJS | null>(null);

  // Synchronisiere Jahr, wenn der Header das Jahr wechselt
  useEffect(() => {
    const yr = parseInt(currentYearMonth.split('-')[0], 10);
    setSelectedYear(yr);
  }, [currentYearMonth]);

  // Diagramme initialisieren / aktualisieren
  useEffect(() => {
    const textColor = isDarkMode ? '#cbd5e1' : '#64748b';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
    const limit = salaryConfig.minijobLimit || 603;

    // 12 Monate berechnen
    const annualStats = [];
    for (let m = 1; m <= 12; m++) {
      annualStats.push(calculateMonthSalary(selectedYear, m, shifts, salaryConfig));
    }

    // 1. STUNDEN-SÄULENDIAGRAMM (mit smarten Zahlen wie "38.5h")
    if (hoursCanvasRef.current && (viewMode === 'both' || viewMode === 'hours')) {
      if (hoursChartInstance.current) {
        hoursChartInstance.current.destroy();
        hoursChartInstance.current = null;
      }

      const ctxHours = hoursCanvasRef.current.getContext('2d');
      if (ctxHours) {
        const hoursData = annualStats.map(s => Math.round(s.gesamtDezimal * 10) / 10);
        const barColorsHours = MONATSKUERZEL.map((_, idx) => {
          if ((idx + 1) === activeMonth && selectedYear === parseInt(jStr, 10)) {
            return '#3b82f6'; // Ausgewählter Monat hervorgehoben
          }
          return isDarkMode ? 'rgba(96, 165, 250, 0.35)' : 'rgba(30, 41, 59, 0.75)';
        });

        hoursChartInstance.current = new ChartJS(ctxHours, {
          type: 'bar',
          plugins: [ChartDataLabels],
          data: {
            labels: MONATSKUERZEL,
            datasets: [{
              label: 'Arbeitsstunden (h)',
              data: hoursData,
              backgroundColor: barColorsHours,
              borderRadius: 8,
              borderSkipped: false
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: c => ` ${c.raw} Stunden Netto`
                }
              },
              datalabels: {
                display: c => (c.dataset.data[c.dataIndex] as number) > 0,
                anchor: 'end',
                align: 'top',
                offset: 2,
                color: c => {
                  if (c.dataIndex + 1 === activeMonth && selectedYear === parseInt(jStr, 10)) {
                    return '#3b82f6';
                  }
                  return isDarkMode ? '#f8fafc' : '#0f172a';
                },
                font: { weight: 'bold', size: 11, family: 'Inter' },
                formatter: (v: number) => v > 0 ? `${v}h` : ''
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                grace: '25%',
                grid: { color: gridColor },
                ticks: { color: textColor, callback: v => `${v}h` }
              },
              x: {
                grid: { display: false },
                ticks: { color: textColor, font: { weight: 'bold' } }
              }
            },
            layout: { padding: { top: 22 } }
          }
        });
      }
    }

    // 2. GEHALTS-SÄULENDIAGRAMM (mit smarten Zahlen wie "580€" & Ampelfarben)
    if (salaryCanvasRef.current && (viewMode === 'both' || viewMode === 'salary')) {
      if (salaryChartInstance.current) {
        salaryChartInstance.current.destroy();
        salaryChartInstance.current = null;
      }

      const ctxSalary = salaryCanvasRef.current.getContext('2d');
      if (ctxSalary) {
        const salaryData = annualStats.map(s => Math.round(s.erwartetesNetto * 100) / 100);
        const barColorsSalary = salaryData.map(v => {
          if (v >= limit) return '#ef4444';       // Grenze erreicht/überschritten -> Rot
          if (v >= limit * 0.9) return '#f59e0b'; // Grenze nah -> Gelb
          return '#10b981';                      // Sicher im Rahmen -> Grün
        });

        salaryChartInstance.current = new ChartJS(ctxSalary, {
          type: 'bar',
          plugins: [ChartDataLabels],
          data: {
            labels: MONATSKUERZEL,
            datasets: [{
              label: 'Erwartetes Netto (€)',
              data: salaryData,
              backgroundColor: barColorsSalary,
              borderRadius: 8,
              borderSkipped: false
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: c => ` Netto: ${(c.raw as number).toFixed(2)} € (Limit: ${limit} €)`
                }
              },
              datalabels: {
                display: c => (c.dataset.data[c.dataIndex] as number) > 0,
                anchor: 'end',
                align: 'top',
                offset: 2,
                color: c => {
                  const val = c.dataset.data[c.dataIndex] as number;
                  if (val >= limit) return '#ef4444';
                  if (val >= limit * 0.9) return '#f59e0b';
                  return isDarkMode ? '#34d399' : '#059669';
                },
                font: { weight: 'bold', size: 11, family: 'Inter' },
                formatter: (v: number) => v > 0 ? `${Math.round(v)}€` : ''
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                grace: '25%',
                grid: { color: gridColor },
                ticks: { color: textColor, callback: v => `${v}€` }
              },
              x: {
                grid: { display: false },
                ticks: { color: textColor, font: { weight: 'bold' } }
              }
            },
            layout: { padding: { top: 22 } }
          }
        });
      }
    }

    return () => {
      if (hoursChartInstance.current) {
        hoursChartInstance.current.destroy();
        hoursChartInstance.current = null;
      }
      if (salaryChartInstance.current) {
        salaryChartInstance.current.destroy();
        salaryChartInstance.current = null;
      }
    };
  }, [selectedYear, shifts, salaryConfig, isDarkMode, viewMode, activeMonth, jStr]);

  // Jahres-Summen
  const annualStats = [];
  for (let m = 1; m <= 12; m++) {
    annualStats.push(calculateMonthSalary(selectedYear, m, shifts, salaryConfig));
  }
  const totalYearHours = annualStats.reduce((sum, s) => sum + s.gesamtDezimal, 0);
  const totalYearSalary = annualStats.reduce((sum, s) => sum + s.erwartetesNetto, 0);

  return (
    <div className="bg-white/[0.04] backdrop-blur-xl rounded-3xl p-5 border border-white/10 shadow-2xl space-y-4">
      {/* Header mit Modus-Umschalter & Jahres-Stepper */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 grid place-items-center text-cyan-300">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-white">
              Säulendiagramme mit smarten Zahlen
            </h3>
            <p className="text-[11px] text-slate-400">
              Jahr {selectedYear}: <strong className="text-cyan-300 font-mono">{totalYearHours.toFixed(1)} h</strong> gesamt • <strong className="text-emerald-300 font-mono">{totalYearSalary.toFixed(2)} €</strong> Netto
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between">
          {/* Umschalter Beide / Stunden / Gehalt */}
          <div className="flex p-1 rounded-xl bg-white/5 border border-white/10 text-xs">
            <button
              onClick={() => setViewMode('both')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all ${
                viewMode === 'both'
                  ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Beide</span>
            </button>
            <button
              onClick={() => setViewMode('hours')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all ${
                viewMode === 'hours'
                  ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Stunden</span>
            </button>
            <button
              onClick={() => setViewMode('salary')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all ${
                viewMode === 'salary'
                  ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Gehalt</span>
            </button>
          </div>

          {/* Jahres-Stepper */}
          <div className="flex items-center gap-1 bg-white/5 px-1 py-0.5 rounded-xl border border-white/10">
            <button
              onClick={() => setSelectedYear(y => y - 1)}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              title="Vorheriges Jahr"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-display text-xs font-black text-white px-1">
              {selectedYear}
            </span>
            <button
              onClick={() => setSelectedYear(y => y + 1)}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              title="Nächstes Jahr"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid für die beiden Diagramme */}
      <div className={`grid gap-4 ${viewMode === 'both' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        {/* DIAGRAMM 1: Jahresstunden */}
        {(viewMode === 'both' || viewMode === 'hours') && (
          <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Jahresstunden ({selectedYear})</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                Stunden (h)
              </span>
            </div>
            <div className="relative h-56 w-full">
              <canvas ref={hoursCanvasRef} />
            </div>
            <div className="text-[10px] text-slate-400 text-center">
              Cyan = Aktueller Monat ({activeMonth}/{selectedYear})
            </div>
          </div>
        )}

        {/* DIAGRAMM 2: Netto-Gehalt */}
        {(viewMode === 'both' || viewMode === 'salary') && (
          <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                <span>Netto-Gehalt & Minijob-Ampel ({selectedYear})</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium font-mono">
                Limit: {salaryConfig.minijobLimit || 603} €
              </span>
            </div>
            <div className="relative h-56 w-full">
              <canvas ref={salaryCanvasRef} />
            </div>
            <div className="flex items-center justify-center gap-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-sm shadow-emerald-400"></span> Grün (&lt; 90%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> Gelb (90-99%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span> Rot (≥ 603€)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalaryCharts;
