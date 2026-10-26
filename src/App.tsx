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
import { VaultConfig } from './components/Settings/VaultConfig';

// Sicherheits-Architektur, Multi-User & Auth-Wall
import { AuthLockScreen } from './components/Auth/AuthLockScreen';
import { OnboardingModal } from './components/Auth/OnboardingModal';
import { SyncModal } from './components/Auth/SyncModal';
import { vaultService, isMohammad, MOHAMMAD_EMAIL } from './services/vaultService';
import { setDecryptedHistoricalRecords, setDecryptedInitialClaims } from './services/clinicPayrollEngine';

import {
  storageService,
  DEFAULT_USER_PROFILE,
  DEFAULT_SALARY_CONFIG,
  DEFAULT_PRESETS
} from './services/storageService';
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
  CloudUserData,
  AppUserSession
} from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('erfassen');
  const [tableSubView, setTableSubView] = useState<'comparison' | 'radar' | 'month' | 'charts'>('comparison');

  // Multi-User Sitzung & Autorisierung
  const [activeSession, setActiveSession] = useState<AppUserSession | null>(() => storageService.getActiveSession());
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [vaultKey, setVaultKey] = useState<string>(() => vaultService.getDefaultPass());
  const [authError, setAuthError] = useState<string | null>(null);

  // Aktuelles Datum für Default-Werte
  const now = new Date();
  const defaultYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const defaultDate = now.toISOString().split('T')[0];

  const [currentYearMonth, setCurrentYearMonth] = useState<string>(defaultYearMonth);
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate);

  // App Daten (im unautorisierten Zustand: 0 Schichten im Speicher!)
  const [shifts, setShifts] = useState<ShiftEntry[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [presets, setPresets] = useState<PresetShift[]>(DEFAULT_PRESETS);
  const [salaryConfig, setSalaryConfig] = useState<SalaryConfig>(DEFAULT_SALARY_CONFIG);

  // Zentral synchronisierter State für Abrechnungsstatus & Overrides
  const [resolvedClaims, setResolvedClaims] = useState<Record<string, ResolvedClaimStatus>>({});
  const [payoutOverrides, setPayoutOverrides] = useState<Record<string, MonthPayoutOverride>>({});

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

  // Daten initial aus dem Scoped Storage des aktuellen Nutzers laden
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

  // Exklusives Entschlüsseln von Mohammads Seed (nur bei Mohammads Konto!)
  const unlockMohammadData = useCallback(async (keyToUse?: string) => {
    const activeKey = keyToUse || vaultKey || '1971';
    try {
      const seed = await vaultService.unlockSeed(activeKey);
      if (seed) {
        if (!storageService.hasSavedShifts()) {
          storageService.importDecryptedSeed(seed.shifts, seed.profile);
        }
        setDecryptedHistoricalRecords(seed.payrollRecords || []);
        setDecryptedInitialClaims(seed.claims || []);
      }
    } catch (e) {
      console.warn("Konnte Mohammads Seed nicht entschlüsseln:", e);
    }
  }, [vaultKey]);

  // Initialisierung beim Start der App, wenn bereits eine Sitzung aktiv ist
  useEffect(() => {
    const session = storageService.getActiveSession();
    if (session) {
      setActiveSession(session);
      if (session.isOwner || isMohammad(session.id)) {
        unlockMohammadData();
      } else {
        setDecryptedHistoricalRecords([]);
        setDecryptedInitialClaims([]);
        if (!storageService.isUserOnboarded(session.id)) {
          setShowOnboarding(true);
        }
      }
      loadAllData();
    }
  }, [loadAllData, unlockMohammadData]);

  // Helper zum Anwenden von Daten aus der Google Cloud (Deduplizierung & Timestamp-Merge)
  const applyCloudData = useCallback((cloudData: CloudUserData) => {
    if (!cloudData) return;

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

    // 5. Gehaltskonfiguration
    if (cloudData.salaryConfig && typeof cloudData.salaryConfig === 'object') {
      const currentSalary = storageService.getSalaryConfig();
      const mergedSalary = { ...currentSalary, ...cloudData.salaryConfig };
      storageService.saveSalaryConfig(mergedSalary);
      setSalaryConfig(mergedSalary);
    }

    setLastSyncTime(new Date());
  }, []);

  // Manueller oder automatischer Cloud-Pull (mit AES-256-GCM Verschlüsselung)
  const handleManualSync = useCallback(async (showNotification: boolean = true) => {
    if (!firebaseUser) {
      if (showNotification) {
        setIsSyncModalOpen(true);
      }
      return;
    }

    setIsSyncing(true);
    try {
      const cloudData = await firebaseService.loadUserData(firebaseUser.uid, vaultKey);
      if (cloudData) {
        applyCloudData(cloudData);

        // Aktuellen Stand auch verschlüsselt in die Cloud spiegeln
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
          currentSalary,
          vaultKey
        );

        if (showNotification) {
          showToast('☁️ Daten mit AES-256-GCM erfolgreich synchronisiert!', 'success');
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
          currentSalary,
          vaultKey
        );
        setLastSyncTime(new Date());

        if (showNotification) {
          showToast('☁️ Cloud-Konto verbunden! Daten AES-256-GCM verschlüsselt.', 'success');
        }
      }
    } catch (err: any) {
      console.warn("Cloud-Sync Fehler:", err);
      if (showNotification) {
        showToast(err.message || 'Fehler bei der Cloud-Synchronisation.', 'error');
      }
    } finally {
      setIsSyncing(false);
    }
  }, [firebaseUser, vaultKey, applyCloudData, showToast]);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = firebaseService.onAuthChanged(async (user) => {
      setFirebaseUser(user);
      if (user) {
        const isOwner = isMohammad(user.email);
        const session: AppUserSession = {
          id: user.uid,
          name: user.displayName || user.email?.split('@')[0] || 'Mitarbeiter',
          email: user.email || undefined,
          authProvider: 'google',
          isOwner,
          isOnboarded: isOwner || storageService.isUserOnboarded(user.uid),
          avatarUrl: user.photoURL || undefined,
          lastLogin: new Date().toISOString()
        };

        storageService.setActiveSession(session);
        setActiveSession(session);

        if (isOwner) {
          await unlockMohammadData();
        } else {
          setDecryptedHistoricalRecords([]);
          setDecryptedInitialClaims([]);
          if (!storageService.isUserOnboarded(user.uid)) {
            setShowOnboarding(true);
          }
        }

        loadAllData();
        handleManualSync(false);
      }
    });

    return () => unsubscribe();
  }, [handleManualSync, unlockMohammadData, loadAllData]);

  // Firestore Realtime-Listener (AES-256-GCM verschlüsselt)
  useEffect(() => {
    if (!firebaseUser) return;
    const unsubscribe = firebaseService.subscribeUserData(firebaseUser.uid, (cloudData) => {
      applyCloudData(cloudData);
    }, vaultKey);
    return () => unsubscribe();
  }, [firebaseUser, applyCloudData, vaultKey]);

  // Automatischer Pull bei Tab-Wechsel / Smartphone-Reaktivierung
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

  // Google Login für beliebige Konten (Mohammad oder Kollegen)
  const handleGoogleLogin = async () => {
    try {
      setIsSyncing(true);
      setAuthError(null);
      const user = await firebaseService.loginWithGoogle();
      const isOwner = isMohammad(user.email);

      const session: AppUserSession = {
        id: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Mitarbeiter',
        email: user.email || undefined,
        authProvider: 'google',
        isOwner,
        isOnboarded: isOwner || storageService.isUserOnboarded(user.uid),
        avatarUrl: user.photoURL || undefined,
        lastLogin: new Date().toISOString()
      };

      storageService.setActiveSession(session);
      setActiveSession(session);
      setFirebaseUser(user);

      if (isOwner) {
        await unlockMohammadData();
      } else {
        setDecryptedHistoricalRecords([]);
        setDecryptedInitialClaims([]);
        if (!storageService.isUserOnboarded(user.uid)) {
          setShowOnboarding(true);
        }
      }

      loadAllData();
      showToast(`Willkommen, ${session.name}!`, 'success');
    } catch (err: any) {
      const msg = err.message || 'Google Anmeldung fehlgeschlagen.';
      setAuthError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Persönliches Schnell-Profil mit PIN entsperren (funktioniert 100% offline!)
  const handleUnlockWithPin = async (
    userId: string,
    pin: string,
    remember: boolean,
    userName?: string
  ): Promise<boolean> => {
    try {
      setAuthError(null);
      const isValid = await vaultService.verifyUserPin(userId, pin);
      if (!isValid) return false;

      const isOwner = isMohammad(userId);
      const session: AppUserSession = {
        id: userId,
        name: userName || (isOwner ? 'Mohammad Almatar' : 'Mitarbeiter'),
        authProvider: 'pin',
        isOwner,
        isOnboarded: isOwner || storageService.isUserOnboarded(userId),
        lastLogin: new Date().toISOString()
      };

      setVaultKey(pin);
      vaultService.setStoredSession(remember);
      storageService.setActiveSession(session);
      setActiveSession(session);

      if (isOwner) {
        await unlockMohammadData(pin);
      } else {
        setDecryptedHistoricalRecords([]);
        setDecryptedInitialClaims([]);
        if (!storageService.isUserOnboarded(userId)) {
          setShowOnboarding(true);
        }
      }

      loadAllData();
      showToast(`🔓 Willkommen, ${session.name}!`, 'success');
      return true;
    } catch (err: any) {
      setAuthError(err.message || 'Entschlüsselung fehlgeschlagen.');
      return false;
    }
  };

  // BLAUER LOGOUT-BUTTON / PROFIL-WECHSEL: Dashboard leeren & zurück zum Anmeldebildschirm
  const handleLogout = useCallback(async () => {
    storageService.clearActiveSession();
    vaultService.clearSession();
    await firebaseService.logout();

    setFirebaseUser(null);
    setActiveSession(null);
    setShowOnboarding(false);

    // Alle React-Zustände restlos leeren (Zero Data Leak)
    setShifts([]);
    setUserProfile(DEFAULT_USER_PROFILE);
    setSalaryConfig(DEFAULT_SALARY_CONFIG);
    setPresets(DEFAULT_PRESETS);
    setResolvedClaims({});
    setPayoutOverrides({});
    setDecryptedHistoricalRecords([]);
    setDecryptedInitialClaims([]);

    showToast('👋 Erfolgreich abgemeldet. Alle Daten aus dem sichtbaren Speicher entfernt.', 'info');
  }, [showToast]);

  // Onboarding für neue Kollegen abschließen
  const handleOnboardingComplete = (profile: UserProfile, config: SalaryConfig) => {
    storageService.saveProfile(profile);
    storageService.saveSalaryConfig(config);
    storageService.setUserOnboarded(true);

    setUserProfile(profile);
    setSalaryConfig(config);
    setShowOnboarding(false);

    // Initial startet der Kollege mit 0 Stunden
    setShifts([]);
    storageService.saveShifts([]);

    showToast(`🎉 Willkommen, ${profile.vorname || profile.name}! Dein Arbeitsbereich ist bereit (0 Stunden).`, 'success');
  };

  // Monatswechsel
  const handleMonthChange = (newYearMonth: string) => {
    setCurrentYearMonth(newYearMonth);
    if (!selectedDate.startsWith(newYearMonth)) {
      setSelectedDate(`${newYearMonth}-01`);
    }
  };

  // Schicht speichern
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

    if (firebaseUser) {
      try {
        setIsSyncing(true);
        await firebaseService.saveUserData(
          firebaseUser.uid,
          updated,
          userProfile,
          resolvedClaims,
          payoutOverrides,
          salaryConfig,
          vaultKey
        );
        setLastSyncTime(new Date());
      } catch (e) {
        console.warn("Cloud-Speicherung im Hintergrund fehlgeschlagen:", e);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // Schicht löschen
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
        salaryConfig,
        vaultKey
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
              salaryConfig,
              vaultKey
            ).catch(console.warn);
            setLastSyncTime(new Date());
          }
          showToast('Eintrag wiederhergestellt!', 'success');
        }
      }
    );
  };

  // Posten abhaken / öffnen
  const handleToggleClaim = async (claimId: string) => {
    const isCurrentlyResolved = Boolean(resolvedClaims[claimId]?.isResolved);
    const updated = storageService.setClaimResolved(claimId, !isCurrentlyResolved);
    setResolvedClaims({ ...updated });

    if (!isCurrentlyResolved) {
      showToast('✅ Posten als beglichen / erledigt markiert!', 'success');
    } else {
      showToast('↩️ Posten wieder geöffnet!', 'info');
    }

    if (firebaseUser) {
      try {
        setIsSyncing(true);
        await firebaseService.saveUserData(
          firebaseUser.uid,
          shifts,
          userProfile,
          updated,
          payoutOverrides,
          salaryConfig,
          vaultKey
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
          salaryConfig,
          vaultKey
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
          salaryConfig,
          vaultKey
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
        salaryConfig,
        vaultKey
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
        config,
        vaultKey
      ).catch(console.warn);
      setLastSyncTime(new Date());
    }
  };

  // STRIKTE AUTH-WALL: Solange kein Nutzer aktiv ist, wird das Dashboard NIEMALS gerendert!
  if (!activeSession) {
    return (
      <>
        <AuthLockScreen
          onGoogleLogin={handleGoogleLogin}
          onUnlockPin={handleUnlockWithPin}
          authError={authError}
          isSyncing={isSyncing}
          onClearError={() => setAuthError(null)}
        />
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // Monatsstatistiken berechnen
  const [jStr, mStr] = currentYearMonth.split('-');
  const stats = calculateMonthSalary(parseInt(jStr, 10), parseInt(mStr, 10), shifts, salaryConfig);

  return (
    <div className="min-h-screen bg-transparent text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black transition-colors duration-200">
      {/* Toast Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Kollegen Onboarding Wizard beim ersten Start */}
      {showOnboarding && (
        <OnboardingModal
          initialName={activeSession.name}
          onComplete={handleOnboardingComplete}
        />
      )}

      {/* Geräteübergreifender Sync-Modal (PC ↔ Handy) */}
      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncComplete={loadAllData}
        showToast={showToast}
      />

      {/* Sticky Header mit Name, Blue-Logout-Button, Sync-Trigger und Monatsnavigation */}
      <Header
        currentYearMonth={currentYearMonth}
        onMonthChange={handleMonthChange}
        stats={stats}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        userName={`${userProfile.vorname} ${userProfile.name}`.trim() || activeSession.name}
        activeSession={activeSession}
        firebaseUser={firebaseUser}
        onLogin={handleGoogleLogin}
        onLogout={handleLogout}
        isSyncing={isSyncing}
        onManualSync={() => handleManualSync(true)}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        lastSyncTime={lastSyncTime}
        onLockApp={handleLogout}
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
                <span>📈 Statistiken</span>
              </button>
            </div>

            {tableSubView === 'comparison' && (
              <PayrollComparisonCard
                userProfile={userProfile}
                currentYearMonth={currentYearMonth}
                shifts={shifts}
                salaryConfig={salaryConfig}
                payoutOverrides={payoutOverrides}
                onSavePayoutOverride={handleSavePayoutOverride}
                onDeletePayoutOverride={handleDeletePayoutOverride}
                resolvedClaims={resolvedClaims}
                onToggleClaim={handleToggleClaim}
                onShowToast={showToast}
                onSelectMonth={handleMonthChange}
                isSyncing={isSyncing}
                lastSyncTime={lastSyncTime}
                onManualSync={() => handleManualSync(true)}
              />
            )}

            {tableSubView === 'radar' && (
              <MinijobJahresradar
                shifts={shifts}
                salaryConfig={salaryConfig}
                userProfile={userProfile}
                currentYearMonth={currentYearMonth}
                onSaveSalaryConfig={handleSaveSalaryConfig}
                onSelectMonth={handleMonthChange}
                onShowToast={showToast}
              />
            )}

            {tableSubView === 'month' && (
              <>
                <KpiCards stats={stats} salaryConfig={salaryConfig} />
                <MonthTable
                  currentYearMonth={currentYearMonth}
                  shifts={shifts}
                  onDeleteShift={handleDeleteShift}
                  onSaveShift={handleSaveShift}
                  onSelectDateForQuickEntry={setSelectedDate}
                />
              </>
            )}

            {tableSubView === 'charts' && (
              <SalaryCharts
                currentYearMonth={currentYearMonth}
                shifts={shifts}
                salaryConfig={salaryConfig}
                isDarkMode={isDarkMode}
              />
            )}
          </div>
        )}

        {/* TAB 2b: 🎯 Direktzugriff auf Minijob-Jahresradar */}
        {activeTab === 'jahresradar' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <MinijobJahresradar
              shifts={shifts}
              salaryConfig={salaryConfig}
              userProfile={userProfile}
              currentYearMonth={currentYearMonth}
              onSaveSalaryConfig={handleSaveSalaryConfig}
              onSelectMonth={handleMonthChange}
              onShowToast={showToast}
            />
          </div>
        )}

        {/* TAB 3: ✉️ E-Mail Vorlage */}
        {activeTab === 'email' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <EmailTemplateCard
              currentYearMonth={currentYearMonth}
              userProfile={userProfile}
              shifts={shifts}
              onShowToast={showToast}
            />
          </div>
        )}

        {/* TAB 4: 📄 Export */}
        {activeTab === 'export' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <ExportActions
              currentYearMonth={currentYearMonth}
              userProfile={userProfile}
              shifts={shifts}
              salaryConfig={salaryConfig}
              onShowToast={showToast}
            />

            <SheetPreview
              currentYearMonth={currentYearMonth}
              userProfile={userProfile}
              shifts={shifts}
            />
          </div>
        )}

        {/* TAB 5: ⚙️ Einstellungen */}
        {activeTab === 'settings' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* 🔒 Tresor & Sicherheits-Konfiguration */}
            <VaultConfig
              onLockApp={handleLogout}
              onOpenSyncModal={() => setIsSyncModalOpen(true)}
              onShowToast={showToast}
            />

            {/* Cloud & Geräte Synchronisation */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden group">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <span className="text-base">🔄</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide font-display">
                      Geräte-Synchronisation (PC ↔ Handy)
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {firebaseUser
                        ? `Cloud aktiv: Verbunden mit ${firebaseUser.email}`
                        : 'AES-256 Offline-Modus aktiv • Sync-Code für Mobilgeräte'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsSyncModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all active:scale-95"
                  >
                    Sync-Code (PC ↔ Handy)
                  </button>
                  {firebaseUser && (
                    <button
                      onClick={() => handleManualSync(true)}
                      disabled={isSyncing}
                      className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold"
                    >
                      Jetzt synchronisieren
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
