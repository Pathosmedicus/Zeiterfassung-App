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
import { CloudStatusModal } from './components/Auth/CloudStatusModal';
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
  CloudBackupItem,
  AppUserSession
} from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('erfassen');
  const [tableSubView, setTableSubView] = useState<'comparison' | 'radar' | 'month' | 'charts'>('comparison');

  // Multi-User Sitzung & Autorisierung
  const [activeSession, setActiveSession] = useState<AppUserSession | null>(() => storageService.getActiveSession());
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState<boolean>(false);
  const [cloudShiftCount, setCloudShiftCount] = useState<number | null>(null);
  const [backupHistory, setBackupHistory] = useState<CloudBackupItem[]>([]);
  const [vaultKey, setVaultKey] = useState<string>(() => vaultService.getDefaultPass());
  const [authError, setAuthError] = useState<string | null>(null);

  // Aktuelles Datum für Default-Werte & Dynamischer Startmonat
  const now = new Date();
  const defaultDate = now.toISOString().split('T')[0];

  const [shifts, setShifts] = useState<ShiftEntry[]>([]);
  const [currentYearMonth, setCurrentYearMonth] = useState<string>(() => {
    const savedShifts = storageService.getShifts();
    return storageService.determineInitialMonth(savedShifts);
  });
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate);

  // App Daten (im unautorisierten Zustand: 0 Schichten im Speicher!)
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
    storageService.purgeLegacyKeys();
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

  // Aktuelle User-Kennung für Cloud-Dokumentpfad (users/{email.toLowerCase().trim()})
  const getUserIdentifier = useCallback(() => {
    return firebaseUser?.email || activeSession?.email || firebaseUser?.uid || activeSession?.id || '';
  }, [firebaseUser, activeSession]);

  // Helper zum Anwenden von Daten aus der Google Cloud (Deduplizierung & Smart-Merge)
  const applyCloudData = useCallback((cloudData: CloudUserData) => {
    if (!cloudData) return;

    // 0. Tombstones für gelöschte Schichten mergen (Zero-Zombie-Schutz)
    const localDeleted = storageService.getDeletedShifts();
    const mergedDeleted = cloudData.deletedShifts
      ? firebaseService.smartMergeDeletedShifts(localDeleted, cloudData.deletedShifts)
      : localDeleted;
    storageService.saveDeletedShifts(mergedDeleted);

    // 1. Intelligenter Smart-Merge auf Eintrags-Ebene (Zero Data Loss & strikte Deduplizierung)
    if (cloudData.shifts && Array.isArray(cloudData.shifts)) {
      const currentLocal = storageService.getShifts();
      const merged = firebaseService.smartMergeShifts(currentLocal, cloudData.shifts, mergedDeleted);
      storageService.saveShifts(merged);
      setShifts(merged);
      setCloudShiftCount(merged.length);

      // Dynamischer Startmonat: Neuester Monat mit Diensten statt statischer Default
      const targetMonth = storageService.determineInitialMonth(merged);
      setCurrentYearMonth(targetMonth);
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

    // 3. Status erledigter Nachforderungen (resolvedClaims) mergen (Set-Union: true gewinnt immer)
    if (cloudData.resolvedClaims && typeof cloudData.resolvedClaims === 'object') {
      const localClaims = storageService.getResolvedClaims();
      const mergedClaims = firebaseService.smartMergeClaims(localClaims, cloudData.resolvedClaims);
      storageService.saveAllResolvedClaims(mergedClaims);
      setResolvedClaims(mergedClaims);
    }

    // 4. Bank-Ist Auszahlungs-Overrides mergen
    if (cloudData.payoutOverrides && typeof cloudData.payoutOverrides === 'object') {
      const localOverrides = storageService.getPayoutOverrides();
      const mergedOverrides = firebaseService.smartMergeOverrides(localOverrides, cloudData.payoutOverrides);
      storageService.saveAllPayoutOverrides(mergedOverrides);
      setPayoutOverrides(mergedOverrides);
    }

    // 5. Gehaltskonfiguration
    if (cloudData.salaryConfig && typeof cloudData.salaryConfig === 'object') {
      const currentSalary = storageService.getSalaryConfig();
      const mergedSalary = { ...currentSalary, ...cloudData.salaryConfig };
      storageService.saveSalaryConfig(mergedSalary);
      setSalaryConfig(mergedSalary);
    }

    // 6. Rollback-Backups aktualisieren
    if (cloudData.backupHistory && Array.isArray(cloudData.backupHistory)) {
      setBackupHistory(cloudData.backupHistory);
    }

    setLastSyncTime(new Date());
  }, []);

  // Manueller oder automatischer Cloud-Pull (Smart-Merge & Zero Data Loss)
  const handleManualSync = useCallback(async (showNotification: boolean = true) => {
    const userIdentifier = getUserIdentifier();
    if (!userIdentifier || !firebaseUser) {
      if (showNotification) {
        setIsCloudModalOpen(true);
      }
      return;
    }

    setIsSyncing(true);
    try {
      const cloudData = await firebaseService.loadUserData(userIdentifier, vaultKey);
      if (cloudData) {
        applyCloudData(cloudData);

        // Aktuellen konsolidierten Stand verschlüsselt zurück spiegeln
        const currentShifts = storageService.getShifts();
        const currentProfile = storageService.getProfile();
        const currentClaims = storageService.getResolvedClaims();
        const currentOverrides = storageService.getPayoutOverrides();
        const currentSalary = storageService.getSalaryConfig();
        const currentDeleted = storageService.getDeletedShifts();

        await firebaseService.saveUserData(
          userIdentifier,
          currentShifts,
          currentProfile,
          currentClaims,
          currentOverrides,
          currentSalary,
          vaultKey,
          false,
          currentDeleted
        );

        if (showNotification) {
          showToast('☁️ Daten mit Gmail-Cloud synchronisiert (Smart-Merge aktiv)!', 'success');
        }
      } else {
        // Erstinitialisierung für diesen Gmail-Nutzer
        const currentShifts = storageService.getShifts();
        const currentProfile = storageService.getProfile();
        const currentClaims = storageService.getResolvedClaims();
        const currentOverrides = storageService.getPayoutOverrides();
        const currentSalary = storageService.getSalaryConfig();
        const currentDeleted = storageService.getDeletedShifts();

        if (currentShifts.length > 0) {
          await firebaseService.saveUserData(
            userIdentifier,
            currentShifts,
            currentProfile,
            currentClaims,
            currentOverrides,
            currentSalary,
            vaultKey,
            false,
            currentDeleted
          );
        }
        setLastSyncTime(new Date());

        if (showNotification) {
          showToast('☁️ Gmail-Cloud verbunden! Dein Account ist sicher eingerichtet.', 'success');
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
  }, [getUserIdentifier, firebaseUser, vaultKey, applyCloudData, showToast]);

  // Firebase Auth Listener mit strikter Nutzer-Isolation & Smart-Merge beim Login
  useEffect(() => {
    const unsubscribe = firebaseService.onAuthChanged(async (user) => {
      setFirebaseUser(user);
      if (user) {
        const userEmail = user.email ? user.email.toLowerCase().trim() : '';
        const isOwner = isMohammad(userEmail);
        const userIdentifier = userEmail || user.uid;

        // Scoped LocalStorage umschalten
        storageService.switchUser(userIdentifier);

        const session: AppUserSession = {
          id: user.uid,
          name: user.displayName || userEmail.split('@')[0] || 'Mitarbeiter',
          email: user.email || undefined,
          authProvider: 'google',
          isOwner,
          isOnboarded: isOwner || storageService.isUserOnboarded(userIdentifier),
          avatarUrl: user.photoURL || undefined,
          lastLogin: new Date().toISOString()
        };

        storageService.setActiveSession(session);
        setActiveSession(session);

        // REGEL 3: AUTOMATISCHE RETTUNG MEINER ALTEN BESTANDSDATEN (NUR FÜR MOHAMMAD)
        if (isOwner && userEmail) {
          storageService.migrateLegacyMohammadDataIfNeeded(userEmail);
          await unlockMohammadData();
        } else {
          setDecryptedHistoricalRecords([]);
          setDecryptedInitialClaims([]);
          if (!storageService.isUserOnboarded(userIdentifier)) {
            setShowOnboarding(true);
          }
        }

        // Lokalen Stand laden
        loadAllData();

        // REGEL 2: ZERO-DATA-LOSS SCHUTZ BEIM LOGIN
        // Sofort Cloud-Stand prüfen und Smart-Merge ausführen
        try {
          setIsSyncing(true);
          const cloudData = await firebaseService.loadUserData(userIdentifier, vaultKey);
          if (cloudData) {
            applyCloudData(cloudData);

            // Zurückspiegeln falls lokale Schichten vorhanden waren
            const mergedShifts = storageService.getShifts();
            const mergedProfile = storageService.getProfile();
            const mergedClaims = storageService.getResolvedClaims();
            const mergedOverrides = storageService.getPayoutOverrides();
            const mergedSalary = storageService.getSalaryConfig();
            const currentDeleted = storageService.getDeletedShifts();

            await firebaseService.saveUserData(
              userIdentifier,
              mergedShifts,
              mergedProfile,
              mergedClaims,
              mergedOverrides,
              mergedSalary,
              vaultKey,
              false,
              currentDeleted
            );
          } else {
            // Falls Cloud leer ist und lokal Schichten vorliegen, in Cloud hochladen
            const localShifts = storageService.getShifts();
            if (localShifts.length > 0) {
              await firebaseService.saveUserData(
                userIdentifier,
                localShifts,
                storageService.getProfile(),
                storageService.getResolvedClaims(),
                storageService.getPayoutOverrides(),
                storageService.getSalaryConfig(),
                vaultKey,
                false,
                storageService.getDeletedShifts()
              );
            }
          }
        } catch (e) {
          console.warn("Initialer Cloud-Abgleich fehlgeschlagen:", e);
        } finally {
          setIsSyncing(false);
        }
      }
    });

    return () => unsubscribe();
  }, [vaultKey, applyCloudData, unlockMohammadData, loadAllData]);

  // Firestore Realtime-Listener für das spezifische Gmail-Konto
  useEffect(() => {
    if (!firebaseUser) return;
    const userIdentifier = firebaseUser.email || firebaseUser.uid;
    const unsubscribe = firebaseService.subscribeUserData(userIdentifier, (cloudData) => {
      applyCloudData(cloudData);
    });
    return () => unsubscribe();
  }, [firebaseUser, applyCloudData]);

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

  // ==========================================
  // CLOUD STATUS MENÜ AKTIONEN (REGEL 4)
  // ==========================================

  // Button 2: Daten aus Gmail-Cloud neu laden (1:1 Stand aus Cloud übernehmen)
  const handlePullFromCloud = async () => {
    const userIdentifier = getUserIdentifier();
    if (!userIdentifier) throw new Error("Kein Benutzer angemeldet");

    setIsSyncing(true);
    try {
      const cloudData = await firebaseService.loadUserData(userIdentifier, vaultKey);
      if (!cloudData || !cloudData.shifts || cloudData.shifts.length === 0) {
        showToast("Keine Dienste in der Gmail-Cloud gefunden.", "info");
        return;
      }

      storageService.saveShifts(cloudData.shifts);
      setShifts(cloudData.shifts);
      setCloudShiftCount(cloudData.shifts.length);

      if (cloudData.profile) {
        const mergedProfile = { ...storageService.getProfile(), ...cloudData.profile } as UserProfile;
        storageService.saveProfile(mergedProfile);
        setUserProfile(mergedProfile);
      }
      if (cloudData.resolvedClaims) {
        storageService.saveAllResolvedClaims(cloudData.resolvedClaims);
        setResolvedClaims(cloudData.resolvedClaims);
      }
      if (cloudData.payoutOverrides) {
        storageService.saveAllPayoutOverrides(cloudData.payoutOverrides);
        setPayoutOverrides(cloudData.payoutOverrides);
      }
      if (cloudData.salaryConfig) {
        const mergedSalary = { ...storageService.getSalaryConfig(), ...cloudData.salaryConfig } as SalaryConfig;
        storageService.saveSalaryConfig(mergedSalary);
        setSalaryConfig(mergedSalary);
      }
      if (cloudData.backupHistory) {
        setBackupHistory(cloudData.backupHistory);
      }

      const initialMonth = storageService.determineInitialMonth(cloudData.shifts);
      setCurrentYearMonth(initialMonth);
      setLastSyncTime(new Date());

      showToast(`⬇️ ${cloudData.shifts.length} Dienste aus Gmail-Cloud neu geladen!`, 'success');
    } finally {
      setIsSyncing(false);
    }
  };

  // Button 3: Lokalen Gerätestand in Gmail-Cloud sichern (mit Backup-Historie)
  const handlePushToCloud = async () => {
    const userIdentifier = getUserIdentifier();
    if (!userIdentifier) throw new Error("Kein Benutzer angemeldet");

    setIsSyncing(true);
    try {
      const res = await firebaseService.saveUserData(
        userIdentifier,
        shifts,
        userProfile,
        resolvedClaims,
        payoutOverrides,
        salaryConfig,
        vaultKey,
        false,
        storageService.getDeletedShifts()
      );

      if (res.success) {
        setLastSyncTime(new Date());
        setCloudShiftCount(shifts.length);
        showToast(`⬆️ ${shifts.length} Dienste erfolgreich in Gmail-Cloud gesichert!`, 'success');

        const cloudData = await firebaseService.loadUserData(userIdentifier, vaultKey);
        if (cloudData?.backupHistory) {
          setBackupHistory(cloudData.backupHistory);
        }
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Button 4a: Lokale Backup-Datei (JSON) herunterladen
  const handleDownloadJsonBackup = () => {
    try {
      const backup = storageService.createBackup();
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      const namePart = (userProfile.name || activeSession?.name || 'Mitarbeiter').replace(/\s+/g, '_');
      a.href = url;
      a.download = `Zeiterfassung_${namePart}_Backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('📥 Lokale JSON-Backup-Datei erfolgreich gespeichert!', 'success');
    } catch (e: any) {
      showToast(e.message || 'Fehler beim Erstellen der Backup-Datei', 'error');
    }
  };

  // Button 4b: Lokale Backup-Datei (JSON) wiederherstellen
  const handleRestoreJsonBackup = async (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const text = event.target?.result as string;
          const parsed = JSON.parse(text);
          const result = storageService.restoreBackup(parsed);
          if (result.success) {
            loadAllData();
            showToast(result.message, 'success');
            // Bei Bedarf in Cloud spiegeln
            const userIdentifier = getUserIdentifier();
            if (userIdentifier && firebaseUser) {
              await handlePushToCloud();
            }
            resolve();
          } else {
            showToast(result.message, 'error');
            reject(new Error(result.message));
          }
        } catch (e: any) {
          showToast('Ungültige Backup-Datei.', 'error');
          reject(e);
        }
      };
      reader.onerror = () => reject(new Error('Fehler beim Lesen der Datei'));
      reader.readAsText(file);
    });
  };

  // Rollback auf eine frühere Cloud-Version
  const handleRestoreBackupVersion = async (backup: CloudBackupItem) => {
    if (!backup || !backup.shifts) return;
    const confirmRestore = window.confirm(
      `Möchtest du wirklich den Datenstand vom ${new Date(backup.timestamp).toLocaleString('de-DE')} (${backup.shiftCount} Dienste) wiederherstellen?`
    );
    if (!confirmRestore) return;

    storageService.saveShifts(backup.shifts);
    setShifts(backup.shifts);

    let restoredProfile: UserProfile = userProfile;
    if (backup.profile) {
      restoredProfile = { ...storageService.getProfile(), ...backup.profile } as UserProfile;
      storageService.saveProfile(restoredProfile);
      setUserProfile(restoredProfile);
    }
    if (backup.resolvedClaims) {
      storageService.saveAllResolvedClaims(backup.resolvedClaims);
      setResolvedClaims(backup.resolvedClaims);
    }
    if (backup.payoutOverrides) {
      storageService.saveAllPayoutOverrides(backup.payoutOverrides);
      setPayoutOverrides(backup.payoutOverrides);
    }
    let restoredSalary: SalaryConfig = salaryConfig;
    if (backup.salaryConfig) {
      restoredSalary = { ...storageService.getSalaryConfig(), ...backup.salaryConfig } as SalaryConfig;
      storageService.saveSalaryConfig(restoredSalary);
      setSalaryConfig(restoredSalary);
    }

    const userIdentifier = getUserIdentifier();
    if (userIdentifier) {
      await firebaseService.saveUserData(
        userIdentifier,
        backup.shifts,
        restoredProfile,
        backup.resolvedClaims || resolvedClaims,
        backup.payoutOverrides || payoutOverrides,
        restoredSalary,
        vaultKey,
        false,
        storageService.getDeletedShifts()
      );
    }

    setLastSyncTime(new Date());
    showToast(`↩️ Version vom ${new Date(backup.timestamp).toLocaleTimeString('de-DE')} erfolgreich wiederhergestellt!`, 'success');
  };

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
      const userEmail = user.email ? user.email.toLowerCase().trim() : '';
      const isOwner = isMohammad(userEmail);
      const userIdentifier = userEmail || user.uid;

      storageService.switchUser(userIdentifier);

      const session: AppUserSession = {
        id: user.uid,
        name: user.displayName || userEmail.split('@')[0] || 'Mitarbeiter',
        email: user.email || undefined,
        authProvider: 'google',
        isOwner,
        isOnboarded: isOwner || storageService.isUserOnboarded(userIdentifier),
        avatarUrl: user.photoURL || undefined,
        lastLogin: new Date().toISOString()
      };

      storageService.setActiveSession(session);
      setActiveSession(session);
      setFirebaseUser(user);

      if (isOwner && userEmail) {
        storageService.migrateLegacyMohammadDataIfNeeded(userEmail);
        await unlockMohammadData();
      } else {
        setDecryptedHistoricalRecords([]);
        setDecryptedInitialClaims([]);
        if (!storageService.isUserOnboarded(userIdentifier)) {
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
          getUserIdentifier(),
          updated,
          userProfile,
          resolvedClaims,
          payoutOverrides,
          salaryConfig,
          vaultKey,
          false,
          storageService.getDeletedShifts()
        );
        setLastSyncTime(new Date());
      } catch (e) {
        console.warn("Cloud-Speicherung im Hintergrund fehlgeschlagen:", e);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // Doppelte Schichten am selben Kalendertag bereinigen (Button im Monats-Stundenzettel)
  const handleCleanDuplicates = async () => {
    const res = storageService.cleanDuplicateShifts();
    setShifts(res.remainingShifts);

    const userIdentifier = getUserIdentifier();
    if (userIdentifier && firebaseUser) {
      try {
        setIsSyncing(true);
        await firebaseService.saveUserData(
          userIdentifier,
          res.remainingShifts,
          userProfile,
          resolvedClaims,
          payoutOverrides,
          salaryConfig,
          vaultKey,
          false,
          storageService.getDeletedShifts()
        );
        setLastSyncTime(new Date());
      } catch (e) {
        console.warn("Cloud-Sync nach Bereinigung fehlgeschlagen:", e);
      } finally {
        setIsSyncing(false);
      }
    }

    if (res.cleanedCount > 0) {
      showToast(`🧹 ${res.cleanedCount} doppelte Schichten am selben Tag erfolgreich bereinigt!`, 'success');
    } else {
      showToast('✨ Keine doppelten Schichten am selben Tag gefunden (alle Tage sauber).', 'info');
    }
  };

  // Schicht löschen (mit sofortigem Cloud-Tombstone & Zero-Zombie-Schutz)
  const handleDeleteShift = (datum: string) => {
    const shiftToDelete = shifts.find(s => s.datum === datum);
    if (!shiftToDelete) return;

    const updated = storageService.deleteShift(datum);
    setShifts(updated);

    if (firebaseUser) {
      firebaseService.saveUserData(
        getUserIdentifier(),
        updated,
        userProfile,
        resolvedClaims,
        payoutOverrides,
        salaryConfig,
        vaultKey,
        false,
        storageService.getDeletedShifts()
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
              getUserIdentifier(),
              restored,
              userProfile,
              resolvedClaims,
              payoutOverrides,
              salaryConfig,
              vaultKey,
              false,
              storageService.getDeletedShifts()
            ).catch(console.warn);
            setLastSyncTime(new Date());
          }
          showToast('Eintrag wiederhergestellt!', 'success');
        }
      }
    );
  };

  // Posten abhaken / öffnen (mit Millisekunden-Sofort-Speicherung in Firebase & Set-Union)
  const handleToggleClaim = (claimId: string) => {
    const isCurrentlyResolved = Boolean(resolvedClaims[claimId]?.isResolved);
    const updated = storageService.setClaimResolved(claimId, !isCurrentlyResolved);
    setResolvedClaims({ ...updated });

    if (!isCurrentlyResolved) {
      showToast('✅ Posten als beglichen / erledigt markiert!', 'success');
    } else {
      showToast('↩️ Posten wieder geöffnet!', 'info');
    }

    if (firebaseUser) {
      // In derselben Millisekunde sofort abfeuern
      firebaseService.saveUserData(
        getUserIdentifier(),
        shifts,
        userProfile,
        updated,
        payoutOverrides,
        salaryConfig,
        vaultKey,
        false,
        storageService.getDeletedShifts()
      ).then(res => {
        if (res.success) {
          setLastSyncTime(new Date());
        }
      }).catch(e => {
        console.warn("Auto-Sync für Claim fehlgeschlagen:", e);
      });
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
          getUserIdentifier(),
          shifts,
          userProfile,
          resolvedClaims,
          updated,
          salaryConfig,
          vaultKey,
          false,
          storageService.getDeletedShifts()
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
          getUserIdentifier(),
          shifts,
          userProfile,
          resolvedClaims,
          updated,
          salaryConfig,
          vaultKey,
          false,
          storageService.getDeletedShifts()
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
        getUserIdentifier(),
        shifts,
        profile,
        resolvedClaims,
        payoutOverrides,
        salaryConfig,
        vaultKey,
        false,
        storageService.getDeletedShifts()
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
        getUserIdentifier(),
        shifts,
        userProfile,
        resolvedClaims,
        payoutOverrides,
        config,
        vaultKey,
        false,
        storageService.getDeletedShifts()
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

      {/* Gmail-Cloud Status Menü (Regel 4: Zero Data Loss, Smart-Merge & Rollback) */}
      <CloudStatusModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        firebaseUser={firebaseUser}
        activeSession={activeSession}
        localShiftCount={shifts.length}
        cloudShiftCount={cloudShiftCount}
        lastSyncTime={lastSyncTime}
        backupHistory={backupHistory}
        isSyncing={isSyncing}
        onSmartMergeSync={async () => { await handleManualSync(true); }}
        onPullFromCloud={handlePullFromCloud}
        onPushToCloud={handlePushToCloud}
        onDownloadJsonBackup={handleDownloadJsonBackup}
        onRestoreJsonBackup={handleRestoreJsonBackup}
        onRestoreBackupVersion={handleRestoreBackupVersion}
        onOpenOfflineSyncModal={() => setIsSyncModalOpen(true)}
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
        onOpenSyncModal={() => setIsCloudModalOpen(true)}
        onOpenCloudModal={() => setIsCloudModalOpen(true)}
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
                  onCleanDuplicates={handleCleanDuplicates}
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
                    onClick={() => setIsCloudModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600/30 to-blue-600/30 hover:from-cyan-600/40 hover:to-blue-600/40 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                  >
                    Gmail-Cloud Menü 🟢
                  </button>
                  <button
                    onClick={() => setIsSyncModalOpen(true)}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-semibold"
                  >
                    Sync-Code (PC ↔ Handy)
                  </button>
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
