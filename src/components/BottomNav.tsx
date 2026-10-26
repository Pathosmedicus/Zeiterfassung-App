import React from 'react';
import { CalendarDays, Scale, ShieldCheck, BarChart3, Mail, FileSpreadsheet, Settings } from 'lucide-react';
import { TabType } from '../types';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    {
      id: 'stundenzettel' as TabType,
      label: 'Stundenzettel',
      icon: CalendarDays,
      badge: null
    },
    {
      id: 'abgleich' as TabType,
      label: 'Abgleich',
      icon: Scale,
      badge: null
    },
    {
      id: 'jahresradar' as TabType,
      label: '7.230€ Radar',
      icon: ShieldCheck,
      badge: null
    },
    {
      id: 'statistik' as TabType,
      label: 'Statistik',
      icon: BarChart3,
      badge: null
    },
    {
      id: 'email' as TabType,
      label: 'E-Mail',
      icon: Mail,
      badge: null
    },
    {
      id: 'export' as TabType,
      label: 'Export',
      icon: FileSpreadsheet,
      badge: null
    },
    {
      id: 'settings' as TabType,
      label: 'Optionen',
      icon: Settings,
      badge: null
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0b0f1a]/90 backdrop-blur-2xl border-t border-white/10 pb-safe transition-colors duration-200">
      <div className="max-w-md mx-auto flex items-center justify-around px-1 py-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1.5 px-0.5 rounded-2xl transition-all duration-200 active:scale-90 ${
                isActive
                  ? 'text-cyan-300 font-bold'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative">
                <div
                  className={`p-1.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-tr from-violet-600/30 to-cyan-500/30 border border-cyan-500/30 shadow-md shadow-cyan-500/20 scale-110 text-cyan-300'
                      : 'bg-transparent text-slate-400'
                  }`}
                >
                  <Icon className="w-5 h-5 transition-transform duration-200" />
                </div>
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-medium text-center leading-tight">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
