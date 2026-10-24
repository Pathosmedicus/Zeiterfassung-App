import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { User } from 'firebase/auth';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { Toast, ToastMessage } from './components/Toast';

// Tab 1: Erfassen
import { QuickEntry } from './components/Erfassen/QuickEntry';
import { MiniCalendar } from './components/Erfassen/MiniCalendar';

// Tab 2: Tabelle & KPIs
import { KpiCards } from './components/Tabelle/KpiCards';
import { MonthTable } from './components/Tabelle/MonthTable';
import { SalaryCharts } from './components/Tabelle/SalaryCharts';
import { PayrollComparisonCard } from './components/Tabelle/PayrollComparisonCard';

// Tab 2b & Neuer Haupt-Tab: Minijob-Jahresradar (7.230 €)
import { MinijobJahresradar } from './components/Jahresradar/MinijobJahresradar';

// Tab 3: Export & PDF
import { ExportActions } from './components/Export/ExportActions';
import { SheetPreview } from './components/Export/SheetPreview';
import { EmailTemplateCard } from './components/Export/EmailTemplateCard';

// Tab 4: Einstellungen
import { Stammdaten } from './components/Settings/Stammdaten';
import { PresetsConfig } from './components/Settings/PresetsConfig';
import { SalaryConfig as SalaryConfigComponent } from './components/Settings/SalaryConfig';
import { BackupManager } from './components/Settings/BackupManager';

import { storageService } from './services/storageService';
import { firebaseService } from './services/firebaseService';
import { calculateMonthSalary } from './services/salaryEngine';
import {
  TabType,
  ShiftEntry,
  UserProfile,
  PresetShift,
  SalaryConfig,
  MonthPayoutOverride,
  ResolvedClaimStatus,
  CloudUserData
} from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('erfassen');
  const [tableSubView, setTableSubView] = useState<'comparison' | 'radar' | 'month' | 'charts'>('comparison');

  // Aktuelles Datum für Default-Werte
  const now = new Date();
  const defaultYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const defaultDate = now.toISOString().split('T')[0];

  const [currentYearMonth, setCurrentYearMonth] = useState<string>(defaultYearMonth);
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate);

  // App Daten
  const [shifts, setShifts] = useState<ShiftEntry[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>(storageService.getProfile());
  const [presets, setPresets] = useState<PresetShift[]>(storageService.getPresets());
  const [salaryConfig, setSalaryConfig] = useState<SalaryConfig>(storageService.getSalaryConfig());

  // Zentral synchronisierter State für Abrechnungsstatus & Overrides
  const [resolvedClaims, setResolvedClaims] = useState<Record<string, ResolvedClaimStatus>>(
    () => storageService.getResolvedClaims()
  );
  const [payoutOverrides, setPayoutOverrides] = useState<Record<string, MonthPayoutOverride>>(
    () => storageService.getPayoutOverrides()
  );

  // Firebase Auth & Cloud Sync State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('zeiterfassung_theme_v3');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((
    text: string,
    type: 'success' | 'error' | 'info' = 'info',
    actionText?: string,
    onAction?: () => void
  ) => {
    const id = `${Date.now()}_${Math.random()}`;
    const newToast: ToastMessage = { id, text, type, actionText, onAction };
    setToasts(prev => [...prev, newToast]);

    setTimeout(() => {
      dismissToast(id);
    }, 4500);
  }, []);

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Daten initial lokal laden
  const loadAllData = useCallback(() => {
    const loadedShifts = storageService.getShifts();
    const loadedProfile = storageService.getProfile();
    const loadedPresets = storageService.getPresets();
    const loadedSalary = storageService.getSalaryConfig();
    const loadedClaims = storageService.getResolvedClaims();
    const loadedOverrides = storageService.getPayoutOverrides();

    setShifts(loadedShifts);
    setUserProfile(loadedProfile);
    setPresets(loadedPresets);
    setSalaryConfig(loadedSalary);
    setResolvedClaims(loadedClaims);
    setPayoutOverrides(loadedOverrides);

    return { loadedShifts, loadedProfile, loadedClaims, loadedOverrides };
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Helper zum Anwenden von Daten aus der Google Cloud (Deduplizierung & Timestamp-Merge)
  const applyCloudData = useCallback((cloudData: CloudUserData) => {
    // 1. Schichten zusammenführen
    if (cloudData.shifts && Array.isArray(cloudData.shifts)) {
      const currentLocal = storageService.getShifts();
      const shiftMap = new Map<string, ShiftEntry>();
      for (const s of currentLocal) {
        if (s && s.datum) shiftMap.set(s.datum, s);
      }
      for (const s of cloudData.shifts) {
        if (s && s.datum) shiftMap.set(s.datum, s);
      }
      const merged = Array.from(shiftMap.values()).sort((a, b) => a.datum.localeCompare(b.datum));
      storageService.saveShifts(merged);
      setShifts(merged);
    }

    // 2. Profil aktualisieren
    if (cloudData.profile && (cloudData.profile.name || cloudData.profile.personalnummer)) {
      const updatedProfile = {
        ...storageService.getProfile(),
        ...cloudData.profile
      } as UserProfile;
      storageService.saveProfile(updatedProfile);
      setUserProfile(updatedProfile);
    }

    // 3. Status erledigter Nachforderungen (resolvedClaims) mergen
    if (cloudData.resolvedClaims && typeof cloudData.resolvedClaims === 'object') {
      const localClaims = storageService.getResolvedClaims();
      const mergedClaims: Record<string, ResolvedClaimStatus> = { ...localClaims };

      for (const [k, cloudClaim] of Object.entries(cloudData.resolvedClaims)) {
        const localClaim = mergedClaims[k];
        if (!localClaim || !localClaim.updatedAt || !cloudClaim.updatedAt) {
          mergedClaims[k] = cloudClaim;
        } else {
          // Neuester Zeitstempel gewinnt
          if (new Date(cloudClaim.updatedAt) >= new Date(localClaim.updatedAt)) {
            mergedClaims[k] = cloudClaim;
          }
        }
      }

      storageService.saveAllResolvedClaims(mergedClaims);
      setResolvedClaims({ ...mergedClaims });
    }

    // 4. Bank-Ist Auszahlungs-Overrides mergen
    if (cloudData.payoutOverrides && typeof cloudData.payoutOverrides === 'object') {
      const localOverrides = storageService.getPayoutOverrides();
      const mergedOverrides = { ...localOverrides, ...cloudData.payoutOverrides };
      storageService.saveAllPayoutOverrides(mergedOverrides);
      setPayoutOverrides({ ...mergedOverrides });
    }

    // 5. Gehaltskonfiguration (inkl. konfigurierte Jahresgrenze)
    if (cloudData.salaryConfig && typeof cloudData.salaryConfig === 'object') {
      const currentSalary = storageService.getSalaryConfig();
      const mergedSalary = { ...currentSalary, ...cloudData.salaryConfig };
      storageService.saveSalaryConfig(mergedSalary);
      setSalaryConfig(mergedSalary);
    }

    setLastSyncTime(new Date());
  }, []);

  // Manueller oder automatischer Cloud-Pull
  const handleManualSync = useCallback(async (showNotification: boolean = true) => {
    if (!firebaseUser) {
      if (showNotification) {
        showToast('ℹ️ Offline-Modus aktiv. Bitte mit Google anmelden für Cloud-Sync.', 'info');
      }
      return;
    }

    setIsSyncing(true);
    try {
      const cloudData = await firebaseService.loadUserData(firebaseUser.uid);
      if (cloudData) {
        applyCloudData(cloudData);

        // Aktuellen Stand auch zurück in die Cloud spiegeln
        const currentShifts = storageService.getShifts();
        const currentProfile = storageService.getProfile();
        const currentClaims = storageService.getResolvedClaims();
        const currentOverrides = storageService.getPayoutOverrides();
        const currentSalary = storageService.getSalaryConfig();

        await firebaseService.saveUserData(
          firebaseUser.uid,
          currentShifts,
          currentProfile,
          currentClaims,
          currentOverrides,
          currentSalary
        );

        if (showNotification) {
          showToast('☁️ Daten & Nachforderungsstatus erfolgreich synchronisiert!', 'success');
        }
      } else {
        // Erste Initialisierung in Firestore
        const currentShifts = storageService.getShifts();
        const currentProfile = storageService.getProfile();
        const currentClaims = storageService.getResolvedClaims();
        const currentOverrides = storageService.getPayoutOverrides();
        const currentSalary = storageService.getSalaryConfig();

        await firebaseService.saveUserData(
          firebaseUser.uid,
          currentShifts,
          currentProfile,
          currentClaims,
          currentOverrides,
          currentSalary
        );
        setLastSyncTime(new Date());

        if (showNotification) {
          showToast('☁️ Cloud-Konto verbunden! Lokale Daten gesichert.', 'success');
        }
      }
    } catch (err: any) {
      console.warn("Cloud-Sync Fehler:", err);
      if (showNotification) {
        showToast('Fehler bei der Cloud-Synchronisation.', 'error');
      }
    } finally {
      setIsSyncing(false);
    }
  }, [firebaseUser, applyCloudData, showToast]);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = firebaseService.onAuthChanged(async user => {
      setFirebaseUser(user);
      if (user) {
        handleManualSync(false);
      }
    });

    return () => unsubscribe();
  }, [handleManualSync]);

  // Firestore Realtime-Listener (onSnapshot: PC & Handy sofort synchron!)
  useEffect(() => {
    if (!firebaseUser) return;
    const unsubscribe = firebaseService.subscribeUserData(firebaseUser.uid, (cloudData) => {
      applyCloudData(cloudData);
    });
    return () => unsubscribe();
  }, [firebaseUser, applyCloudData]);

  // Automatischer Pull bei Tab-Wechsel / Smartphone-Reaktivierung (visibilitychange / focus)
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' && firebaseUser) {
        handleManualSync(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [firebaseUser, handleManualSync]);

  // Theme Sync
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('zeiterfassung_theme_v3', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('zeiterfassung_theme_v3', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  // Google Login / Logout
  const handleGoogleLogin = async () => {
    try {
      setIsSyncing(true);
      await firebaseService.loginWithGoogle();
    } catch (err: any) {
      showToast(err.message || 'Google Anmeldung fehlgeschlagen.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await firebaseService.logout();
      showToast('Erfolgreich von Google abgemeldet. Lokaler Modus aktiv.', 'info');
    } catch (err: any) {
      showToast('Fehler beim Abmelden.', 'error');
    }
  };

  // Monatswechsel
  const handleMonthChange = (newYearMonth: string) => {
    setCurrentYearMonth(newYearMonth);
    if (!selectedDate.startsWith(newYearMonth)) {
      setSelectedDate(`${newYearMonth}-01`);
    }
  };

  // Schicht speichern (Lokal + Cloud Sync)
  const handleSaveShift = async (newShift: ShiftEntry) => {
    const updated = storageService.upsertShift(newShift);
    setShifts(updated);

    showToast(`✅ Schicht für ${newShift.datum} gespeichert (${newShift.nettoStunden.toFixed(2)} h)`, 'success');

    if (newShift.nettoStunden >= 8) {
      confetti({
        particleCount: 25,
        spread: 45,
        origin: { y: 0.85 }
      });
    }

    // In Cloud sichern
    if (firebaseUser) {
      try {
        setIsSyncing(true);
        await firebaseService.saveUserData(
          firebaseUser.uid,
          updated,
          userProfile,
          resolvedClaims,
          payoutOverrides,
          salaryConfig
        );
        setLastSyncTime(new Date());
      } catch (e) {
        console.warn("Cloud-Speicherung im Hintergrund fehlgeschlagen:", e);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // Schicht löschen (mit Undo & Cloud Sync)
  const handleDeleteShift = (datum: string) => {
    const shiftToDelete = shifts.find(s => s.datum === datum);
    if (!shiftToDelete) return;

    const updated = storageService.deleteShift(datum);
    setShifts(updated);

    if (firebaseUser) {
      firebaseService.saveUserData(
        firebaseUser.uid,
        updated,
        userProfile,
        resolvedClaims,
        payoutOverrides,
        salaryConfig
      ).catch(console.warn);
      setLastSyncTime(new Date());
    }

    showToast(
      `Schicht für ${datum} gelöscht`,
      'info',
      'Rückgängig',
      () => {
        if (shiftToDelete) {
          const restored = storageService.upsertShift(shiftToDelete);
          setShifts(restored);
          if (firebaseUser) {
            firebaseService.saveUserData(
              firebaseUser.uid,
              restored,
              userProfile,
              resolvedClaims,
              payoutOverrides,
              salaryConfig
            ).catch(console.warn);
            setLastSyncTime(new Date());
          }
          showToast('Eintrag wiederhergestellt!', 'success');
        }
      }
    );
  };

  // Posten abhaken / öffnen (mit direktem Auto-Sync)
  const handleToggleClaim = async (claimId: string) => {
    const isCurrentlyResolved = Boolean(resolvedClaims[claimId]?.isResolved);
    const updated = storageService.setClaimResolved(claimId, !isCurrentlyResolved);
    setResolvedClaims({ ...updated });

    if (!isCurrentlyResolved) {
      showToast('✅ Posten als beglichen / erledigt markiert!', 'success');
    } else {
      showToast('↩️ Posten wieder geöffnet!', 'info');
    }

    // Sofortiger Cloud-Auto-Sync
    if (firebaseUser) {
      try {
        setIsSyncing(true);
        await firebaseService.saveUserData(
          firebaseUser.uid,
          shifts,
          userProfile,
          updated,
          payoutOverrides,
          salaryConfig
        );
        setLastSyncTime(new Date());
      } catch (e) {
        console.warn("Auto-Sync für Claim fehlgeschlagen:", e);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // Auszahlungs-Override (Bank-Ist) speichern
  const handleSavePayoutOverride = async (override: MonthPayoutOverride) => {
    const updated = storageService.savePayoutOverride(override);
    setPayoutOverrides({ ...updated });

    if (firebaseUser) {
      try {
        setIsSyncing(true);
        await firebaseService.saveUserData(
          firebaseUser.uid,
          shifts,
          userProfile,
          resolvedClaims,
          updated,
          salaryConfig
        );
        setLastSyncTime(new Date());
      } catch (e) {
        console.warn("Auto-Sync für Auszahlung fehlgeschlagen:", e);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const handleDeletePayoutOverride = async (yearMonth: string) => {
    const updated = storageService.deletePayoutOverride(yearMonth);
    setPayoutOverrides({ ...updated });

    if (firebaseUser) {
      try {
        setIsSyncing(true);
        await firebaseService.saveUserData(
          firebaseUser.uid,
          shifts,
          userProfile,
          resolvedClaims,
          updated,
          salaryConfig
        );
        setLastSyncTime(new Date());
      } catch (e) {
        console.warn("Auto-Sync für Reset Auszahlung fehlgeschlagen:", e);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // Profile / Config Saves
  const handleSaveProfile = (profile: UserProfile) => {
    storageService.saveProfile(profile);
    setUserProfile(profile);
    if (firebaseUser) {
      firebaseService.saveUserData(
        firebaseUser.uid,
        shifts,
        profile,
        resolvedClaims,
        payoutOverrides,
        salaryConfig
      ).catch(console.warn);
      setLastSyncTime(new Date());
    }
  };

  const handleSavePresets = (newPresets: PresetShift[]) => {
    storageService.savePresets(newPresets);
    setPresets(newPresets);
  };

  const handleSaveSalaryConfig = (config: SalaryConfig) => {
    storageService.saveSalaryConfig(config);
    setSalaryConfig(config);
    if (firebaseUser) {
      firebaseService.saveUserData(
        firebaseUser.uid,
        shifts,
        userProfile,
        resolvedClaims,
        payoutOverrides,
        config
      ).catch(console.warn);
      setLastSyncTime(new Date());
    }
  };

  // Monatsstatistiken berechnen
  const [jStr, mStr] = currentYearMonth.split('-');
  const stats = calculateMonthSalary(parseInt(jStr, 10), parseInt(mStr, 10), shifts, salaryConfig);

  return (
    <div className="min-h-screen bg-transparent text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black transition-colors duration-200">
      {/* Toast Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Sticky Header mit Monatsauswahl, Live-Stundenzähler, Cloud-Sync-Button & Google-Login */}
      <Header
        currentYearMonth={currentYearMonth}
        onMonthChange={handleMonthChange}
        stats={stats}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        userName={`${userProfile.vorname} ${userProfile.name}`}
        firebaseUser={firebaseUser}
        onLogin={handleGoogleLogin}
        onLogout={handleGoogleLogout}
        isSyncing={isSyncing}
        onManualSync={() => handleManualSync(true)}
        lastSyncTime={lastSyncTime}
      />

      {/* Hauptinhalt */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 pt-4 pb-28">
        {/* TAB 1: ⏱️ Erfassen */}
        {activeTab === 'erfassen' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <QuickEntry
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              shifts={shifts}
              presets={presets}
              onSaveShift={handleSaveShift}
              onDeleteShift={handleDeleteShift}
            />

            <MiniCalendar
              currentYearMonth={currentYearMonth}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              shifts={shifts}
            />
          </div>
        )}

        {/* TAB 2: 📊 Monatsübersicht & Abrechnungsabgleich */}
        {activeTab === 'tabelle' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Sub-Nav Pillen für Übersicht */}
            <div className="flex p-1 rounded-2xl bg-slate-200/80 dark:bg-zinc-800/80 border border-slate-300/60 dark:border-zinc-700/60 text-xs gap-1 flex-wrap sm:flex-nowrap">
              <button
                onClick={() => setTableSubView('comparison')}
                className={`flex-1 py-2 px-3 rounded-xl font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                  tableSubView === 'comparison'
                    ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>⚡ Abrechnungsabgleich</span>
              </button>
              <button
                onClick={() => setTableSubView('radar')}
                className={`flex-1 py-2 px-3 rounded-xl font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                  tableSubView === 'radar'
                    ? 'bg-white dark:bg-zinc-900 text-cyan-600 dark:text-cyan-400 shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>🎯 7.230€ Jahresradar</span>
              </button>
              <button
                onClick={() => setTableSubView('month')}
                className={`flex-1 py-2 px-3 rounded-xl font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                  tableSubView === 'month'
                    ? 'bg-white dark:bg-zinc-900 text-brand-600 dark:text-brand-400 shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>📅 Stundenzettel</span>
              </button>
              <button
                onClick={() => setTableSubView('charts')}
                className={`flex-1 py-2 px-3 rounded-xl font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                  tableSubView === 'charts'
                    ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>📊 Diagramme</span>
              </button>
            </div>

            {/* Ansicht 1: Reale Vergleichstabelle & Offene Nachforderungen */}
            {tableSubView === 'comparison' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <PayrollComparisonCard
                  userProfile={userProfile}
                  currentYearMonth={currentYearMonth}
                  shifts={shifts}
                  salaryConfig={salaryConfig}
                  onSelectMonth={ym => {
                    handleMonthChange(ym);
                    setTableSubView('month');
                    showToast(`Monat ${ym} im Stundenzettel geladen!`, 'info');
                  }}
                  onShowToast={showToast}
                  resolvedClaims={resolvedClaims}
                  onToggleClaim={handleToggleClaim}
                  payoutOverrides={payoutOverrides}
                  onSavePayoutOverride={handleSavePayoutOverride}
                  onDeletePayoutOverride={handleDeletePayoutOverride}
                  lastSyncTime={lastSyncTime}
                  onManualSync={() => handleManualSync(true)}
                  isSyncing={isSyncing}
                />
                <KpiCards stats={stats} salaryConfig={salaryConfig} />
              </div>
            )}

            {/* Ansicht 1b: 🎯 Minijob-Jahresradar (7.230 €) */}
            {tableSubView === 'radar' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <MinijobJahresradar
                  shifts={shifts}
                  salaryConfig={salaryConfig}
                  userProfile={userProfile}
                  currentYearMonth={currentYearMonth}
                  onSaveSalaryConfig={handleSaveSalaryConfig}
                  onSelectMonth={ym => {
                    handleMonthChange(ym);
                    setTableSubView('month');
                    showToast(`Monat ${ym} im Stundenzettel geladen!`, 'info');
                  }}
                  onShowToast={showToast}
                  lastSyncTime={lastSyncTime}
                  onManualSync={() => handleManualSync(true)}
                  isSyncing={isSyncing}
                />
              </div>
            )}

            {/* Ansicht 2: Stundenzettel des ausgewählten Monats */}
            {tableSubView === 'month' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <KpiCards stats={stats} salaryConfig={salaryConfig} />
                <MonthTable
                  currentYearMonth={currentYearMonth}
                  shifts={shifts}
                  onSaveShift={handleSaveShift}
                  onDeleteShift={handleDeleteShift}
                  onSelectDateForQuickEntry={datum => {
                    setSelectedDate(datum);
                    setActiveTab('erfassen');
                  }}
                />
              </div>
            )}

            {/* Ansicht 3: Säulendiagramme */}
            {tableSubView === 'charts' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <SalaryCharts
                  currentYearMonth={currentYearMonth}
                  shifts={shifts}
                  salaryConfig={salaryConfig}
                  isDarkMode={isDarkMode}
                />
                <KpiCards stats={stats} salaryConfig={salaryConfig} />
              </div>
            )}
          </div>
        )}

        {/* NEUER TAB: 🎯 Minijob-Jahresradar (7.230 €) aus Bottom-Navigation */}
        {activeTab === 'jahresradar' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <MinijobJahresradar
              shifts={shifts}
              salaryConfig={salaryConfig}
              userProfile={userProfile}
              currentYearMonth={currentYearMonth}
              onSaveSalaryConfig={handleSaveSalaryConfig}
              onSelectMonth={ym => {
                handleMonthChange(ym);
                setActiveTab('tabelle');
                setTableSubView('month');
                showToast(`Monat ${ym} im Stundenzettel geladen!`, 'info');
              }}
              onShowToast={showToast}
              lastSyncTime={lastSyncTime}
              onManualSync={() => handleManualSync(true)}
              isSyncing={isSyncing}
            />
          </div>
        )}

        {/* TAB 3: ✉️ E-Mail */}
        {activeTab === 'email' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <EmailTemplateCard
              currentYearMonth={currentYearMonth}
              shifts={shifts}
              userProfile={userProfile}
              onShowToast={showToast}
            />
          </div>
        )}

        {/* TAB 4: 📤 Export & PDF */}
        {activeTab === 'export' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <ExportActions
              currentYearMonth={currentYearMonth}
              shifts={shifts}
              userProfile={userProfile}
              salaryConfig={salaryConfig}
              onShowToast={showToast}
            />

            <EmailTemplateCard
              currentYearMonth={currentYearMonth}
              shifts={shifts}
              userProfile={userProfile}
              onShowToast={showToast}
            />

            <SheetPreview
              currentYearMonth={currentYearMonth}
              shifts={shifts}
              userProfile={userProfile}
            />
          </div>
        )}

        {/* TAB 5: ⚙️ Einstellungen */}
        {activeTab === 'settings' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Google Cloud Status Kachel mit manuellem Sync Button */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden group">
              <div className="absolute -top-12 -right-12 w-36 h-36 bg-blue-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-500/15 transition-all duration-700" />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between relative z-10 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/10">
                    <span className="text-lg">☁️</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide font-display">
                      Google Cloud Synchronisation
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {firebaseUser
                        ? `Verbunden mit ${firebaseUser.email} • Echtzeit-Synchronisation aktiv`
                        : 'Nicht angemeldet • Lokaler Offline-Modus aktiv'}
                    </p>
                    {lastSyncTime && (
                      <p className="text-[10px] text-emerald-400 mt-0.5">
                        Zuletzt synchronisiert: {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} Uhr
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {firebaseUser ? (
                    <>
                      <button
                        onClick={() => handleManualSync(true)}
                        disabled={isSyncing}
                        className="px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
                      >
                        <span className={isSyncing ? 'animate-spin inline-block' : ''}>🔄</span>
                        <span>Jetzt synchronisieren</span>
                      </button>

                      <button
                        onClick={handleGoogleLogout}
                        className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-rose-500/10 text-slate-300 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 text-xs font-semibold transition-all"
                      >
                        Abmelden
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleGoogleLogin}
                      className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
                    >
                      Mit Google anmelden
                    </button>
                  )}
                </div>
              </div>
            </div>

            <Stammdaten
              userProfile={userProfile}
              onSaveProfile={handleSaveProfile}
              onShowToast={showToast}
            />

            <PresetsConfig
              presets={presets}
              onSavePresets={handleSavePresets}
              onShowToast={showToast}
            />

            <SalaryConfigComponent
              salaryConfig={salaryConfig}
              onSaveSalaryConfig={handleSaveSalaryConfig}
              onShowToast={showToast}
            />

            <BackupManager
              currentYearMonth={currentYearMonth}
              onDataReload={loadAllData}
              onShowToast={showToast}
            />
          </div>
        )}
      </main>

      {/* Feste App-Navigation (Bottom Tab Bar) */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default App;
