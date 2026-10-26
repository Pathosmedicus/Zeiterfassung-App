import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { User } from 'firebase/auth';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { Toast, ToastMessage } from './components/Toast';
import { RotateCcw } from 'lucide-react';

// Tab 1: Stundenzettel

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
  deduplicateShifts,
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
  const [activeTab, setActiveTab] = useState<TabType>('stundenzettel');

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
  const vaultKeyRef = useRef<string>(vaultKey);
  useEffect(() => {
    vaultKeyRef.current = vaultKey;
  }, [vaultKey]);
  const hasUnlockedRef = useRef<boolean>(false);
  const lastFocusSyncRef = useRef<number>(0);

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

  // Aktuelle User-Kennung für Cloud-Dokumentpfad (users/{email.toLowerCase().trim()})
  const getUserIdentifier = useCallback(() => {
    return firebaseUser?.email || activeSession?.email || firebaseUser?.uid || activeSession?.id || '';
  }, [firebaseUser, activeSession]);

  // Exklusives Entschlüsseln von Mohammads Seed (nur historische Abrechnungen & Nachforderungen für Minijob-Radar)
  const unlockMohammadData = useCallback(async (keyToUse?: string, force: boolean = false) => {
    if (hasUnlockedRef.current && !force) return;
    const activeKey = keyToUse || vaultKeyRef.current || '1971';
    try {
      const seed = await vaultService.unlockSeed(activeKey);
      if (seed) {
        setDecryptedHistoricalRecords(seed.payrollRecords || []);
        setDecryptedInitialClaims(seed.claims || []);
        hasUnlockedRef.current = true;
      }
    } catch (e) {
      console.warn("Konnte Mohammads Seed nicht entschlüsseln:", e);
    }
  }, []);

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
        // WICHTIG: Der Onboarding-Status wird unter der E-Mail gespeichert (nicht unter der Firebase-UID)
        if (!storageService.isUserOnboarded(session.email || session.id)) {
          setShowOnboarding(true);
        }
      }
      loadAllData();
    }
  }, [loadAllData, unlockMohammadData]);

  // Helper zum Anwenden von Daten aus der Google Cloud (1:1 Snapshot ohne fehlerhaftes Merge-Chaos)
  const applyCloudData = useCallback((cloudData: CloudUserData) => {
    if (!cloudData) return;

    // 0. Tombstones für gelöschte Schichten
    if (cloudData.deletedShifts && typeof cloudData.deletedShifts === 'object') {
      storageService.saveDeletedShifts(cloudData.deletedShifts);
    }

    // 1. Schichten aus der Cloud direkt als verlässlichen Snapshot 1:1 übernehmen
    if (cloudData.shifts && Array.isArray(cloudData.shifts)) {
      const cleanShifts = deduplicateShifts(cloudData.shifts);
      storageService.saveShifts(cleanShifts);
      setShifts(cleanShifts);
      setCloudShiftCount(cleanShifts.length);
    }

    // 2. Profil übernehmen & auf offizielle Institutsbezeichnung normieren
    if (cloudData.profile && (cloudData.profile.name || cloudData.profile.personalnummer)) {
      const updatedProfile = {
        ...DEFAULT_USER_PROFILE,
        ...cloudData.profile
      } as UserProfile;
      if (!updatedProfile.abteilung || updatedProfile.abteilung === 'Radiologie' || updatedProfile.abteilung === 'Radiologie & Nuklearmedizin') {
        updatedProfile.abteilung = DEFAULT_USER_PROFILE.abteilung;
      }
      if (!updatedProfile.klinik || updatedProfile.klinik === 'Klinikum' || updatedProfile.klinik === 'Klinikum Minden' || updatedProfile.klinik === 'Universitätsklinikum') {
        updatedProfile.klinik = DEFAULT_USER_PROFILE.klinik;
      }
      storageService.saveProfile(updatedProfile);
      setUserProfile(updatedProfile);
    }

    // 3. Status erledigter Nachforderungen (resolvedClaims) 1:1 übernehmen
    if (cloudData.resolvedClaims && typeof cloudData.resolvedClaims === 'object') {
      storageService.saveAllResolvedClaims(cloudData.resolvedClaims);
      setResolvedClaims(cloudData.resolvedClaims);
    }

    // 4. Bank-Ist Auszahlungs-Overrides 1:1 übernehmen
    if (cloudData.payoutOverrides && typeof cloudData.payoutOverrides === 'object') {
      storageService.saveAllPayoutOverrides(cloudData.payoutOverrides);
      setPayoutOverrides(cloudData.payoutOverrides);
    }

    // 5. Gehaltskonfiguration 1:1 übernehmen
    if (cloudData.salaryConfig && typeof cloudData.salaryConfig === 'object') {
      const mergedSalary = { ...DEFAULT_SALARY_CONFIG, ...cloudData.salaryConfig };
      storageService.saveSalaryConfig(mergedSalary);
      setSalaryConfig(mergedSalary);
    }

    // 6. Presets 1:1 übernehmen
    if (cloudData.presets && Array.isArray(cloudData.presets) && cloudData.presets.length > 0) {
      storageService.savePresets(cloudData.presets);
      setPresets(cloudData.presets);
    }

    // 7. Rollback-Backups aktualisieren
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

    if (showNotification) {
      setIsSyncing(true);
    }
    try {
      const cloudData = await firebaseService.loadUserData(userIdentifier, vaultKeyRef.current);
      if (cloudData) {
        applyCloudData(cloudData);

        if (showNotification) {
          showToast('☁️ Daten mit Gmail-Cloud synchronisiert!', 'success');
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
            storageService.getPresets(),
            vaultKeyRef.current,
            true,
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
      if (showNotification) {
        setIsSyncing(false);
      }
    }
  }, [getUserIdentifier, firebaseUser, applyCloudData, showToast]);

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

        // Autorisierte historische Abrechnungsdaten für Minijob-Radar bereitstellen
        if (isOwner) {
          await unlockMohammadData();
        } else {
          setDecryptedHistoricalRecords([]);
          setDecryptedInitialClaims([]);
        }

        // Exakten Stand aus Firebase (users/{userKey}) abrufen
        try {
          setIsSyncing(true);
          const cloudData = await firebaseService.loadUserData(userIdentifier, vaultKeyRef.current);
          if (cloudData) {
            // Firebase hat gespeicherte Daten -> 1:1 direkt anwenden
            applyCloudData(cloudData);

            // Wer bereits ein ausgefülltes Profil oder Schichten in der Cloud hat, ist kein Neuling mehr
            const hasCloudProfile = Boolean(cloudData.profile?.vorname);
            const hasCloudShifts = Array.isArray(cloudData.shifts) && cloudData.shifts.length > 0;
            if (!isOwner && (hasCloudProfile || hasCloudShifts)) {
              storageService.setUserOnboarded(true, userIdentifier);
              setShowOnboarding(false);
            }
          } else {
            // Firebase ist komplett leer (null) für diesen Nutzer
            // Sauberes, leeres Profil anlegen
            const initialProfile: UserProfile = {
              ...DEFAULT_USER_PROFILE,
              name: session.name || '',
              vorname: ''
            };
            storageService.saveProfile(initialProfile);
            setUserProfile(initialProfile);
            storageService.saveShifts([]);
            setShifts([]);
            storageService.savePresets(DEFAULT_PRESETS);
            setPresets(DEFAULT_PRESETS);
            storageService.saveSalaryConfig(DEFAULT_SALARY_CONFIG);
            setSalaryConfig(DEFAULT_SALARY_CONFIG);
            storageService.saveAllPayoutOverrides({});
            setPayoutOverrides({});
            storageService.saveAllResolvedClaims({});
            setResolvedClaims({});

            if (!isOwner) {
              setShowOnboarding(true);
            }

            // Sofort als initialer Stand in Firebase via set() sichern
            await firebaseService.saveUserData(
              userIdentifier,
              [],
              initialProfile,
              {},
              {},
              DEFAULT_SALARY_CONFIG,
              DEFAULT_PRESETS,
              vaultKeyRef.current,
              true
            );
          }
        } catch (e) {
          console.warn("Initialer Cloud-Abgleich fehlgeschlagen:", e);
        } finally {
          setIsSyncing(false);
        }
      }
    });

    return () => unsubscribe();
  }, [applyCloudData, unlockMohammadData, loadAllData]);

  // Firestore Realtime-Listener für das spezifische Gmail-Konto
  const activeUserUid = firebaseUser?.uid;
  useEffect(() => {
    if (!activeUserUid || !firebaseUser) return;
    const userIdentifier = firebaseUser.email || activeUserUid;
    const unsubscribe = firebaseService.subscribeUserData(userIdentifier, (cloudData) => {
      applyCloudData(cloudData);
    });
    return () => unsubscribe();
  }, [activeUserUid, applyCloudData]);

  // Automatischer Pull bei Tab-Wechsel / Smartphone-Reaktivierung (mit 30s Drosselung)
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' && firebaseUser) {
        const now = Date.now();
        if (now - lastFocusSyncRef.current < 30000) return;
        lastFocusSyncRef.current = now;
        handleManualSync(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [activeUserUid, handleManualSync]);

  // ==========================================
  // CLOUD STATUS MENÜ AKTIONEN (REGEL 4)
  // ==========================================

  // Button 2: Daten aus Gmail-Cloud neu laden (1:1 Stand aus Cloud übernehmen)
  const handlePullFromCloud = async () => {
    const userIdentifier = getUserIdentifier();
    if (!userIdentifier) throw new Error("Kein Benutzer angemeldet");

    setIsSyncing(true);
    try {
      const cloudData = await firebaseService.loadUserData(userIdentifier, vaultKeyRef.current);
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
  // Manueller Push in die Cloud
  const handlePushToCloud = async () => {
    const userIdentifier = getUserIdentifier();
    if (!userIdentifier) throw new Error("Kein Benutzer angemeldet");

    setIsSyncing(true);
    try {
      const currentShifts = storageService.getShifts();
      const res = await firebaseService.saveUserData(
        userIdentifier,
        currentShifts,
        storageService.getProfile(),
        storageService.getResolvedClaims(),
        storageService.getPayoutOverrides(),
        storageService.getSalaryConfig(),
        storageService.getPresets(),
        vaultKeyRef.current,
        true,
        storageService.getDeletedShifts()
      );

      if (res.success) {
        setLastSyncTime(new Date());
        setCloudShiftCount(currentShifts.length);
        showToast(`⬆️ ${currentShifts.length} Dienste erfolgreich in Cloud gesichert!`, 'success');

        const cloudData = await firebaseService.loadUserData(userIdentifier, vaultKeyRef.current);
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

            // Sofort 1:1 per set() in Firebase sichern!
            const userIdentifier = getUserIdentifier();
            if (userIdentifier && firebaseUser) {
              setIsSyncing(true);
              try {
                await firebaseService.saveUserData(
                  userIdentifier,
                  storageService.getShifts(),
                  storageService.getProfile(),
                  storageService.getResolvedClaims(),
                  storageService.getPayoutOverrides(),
                  storageService.getSalaryConfig(),
                  storageService.getPresets(),
                  vaultKeyRef.current,
                  true
                );
                setLastSyncTime(new Date());
                setCloudShiftCount(storageService.getShifts().length);
              } finally {
                setIsSyncing(false);
              }
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

    storageService.saveDeletedShifts({});
    storageService.saveShifts(backup.shifts);
    setShifts(backup.shifts);

    let restoredProfile: UserProfile = userProfile;
    if (backup.profile) {
      restoredProfile = { ...DEFAULT_USER_PROFILE, ...backup.profile } as UserProfile;
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
      restoredSalary = { ...DEFAULT_SALARY_CONFIG, ...backup.salaryConfig } as SalaryConfig;
      storageService.saveSalaryConfig(restoredSalary);
      setSalaryConfig(restoredSalary);
    }
    let restoredPresets: PresetShift[] = presets;
    if (backup.presets && backup.presets.length > 0) {
      restoredPresets = backup.presets;
      storageService.savePresets(restoredPresets);
      setPresets(restoredPresets);
    }

    const userIdentifier = getUserIdentifier();
    if (userIdentifier && firebaseUser) {
      await firebaseService.saveUserData(
        userIdentifier,
        backup.shifts,
        restoredProfile,
        backup.resolvedClaims || resolvedClaims,
        backup.payoutOverrides || payoutOverrides,
        restoredSalary,
        restoredPresets,
        vaultKey,
        true
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
    hasUnlockedRef.current = false;
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
  const handleOnboardingComplete = async (profile: UserProfile, config: SalaryConfig) => {
    storageService.saveProfile(profile);
    storageService.saveSalaryConfig(config);
    storageService.setUserOnboarded(true, getUserIdentifier() || undefined);

    setUserProfile(profile);
    setSalaryConfig(config);
    setShowOnboarding(false);

    // Initial startet der Kollege mit 0 Stunden
    setShifts([]);
    storageService.saveShifts([]);

    showToast(`🎉 Willkommen, ${profile.vorname || profile.name}! Dein Arbeitsbereich ist bereit (0 Stunden).`, 'success');

    // Profil sofort per set() in die Cloud sichern, damit der Nutzer auf jedem Gerät automatisch erkannt wird
    const userIdentifier = getUserIdentifier();
    if (userIdentifier && firebaseUser) {
      try {
        await firebaseService.saveUserData(
          userIdentifier,
          [],
          profile,
          {},
          {},
          config,
          presets,
          vaultKeyRef.current,
          true,
          storageService.getDeletedShifts()
        );
        setLastSyncTime(new Date());
      } catch (e) {
        console.warn('Onboarding-Daten konnten nicht in die Cloud gesichert werden:', e);
      }
    }
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
          presets,
          vaultKey,
          true,
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
          presets,
          vaultKey,
          true,
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
        presets,
        vaultKey,
        true,
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
              presets,
              vaultKey,
              true,
              storageService.getDeletedShifts()
            ).catch(console.warn);
            setLastSyncTime(new Date());
          }
          showToast('Eintrag wiederhergestellt!', 'success');
        }
      }
    );
  };

  // Posten abhaken / öffnen (mit Millisekunden-Sofort-Speicherung in Firebase via set())
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
      // In derselben Millisekunde sofort per set() abfeuern
      firebaseService.saveUserData(
        getUserIdentifier(),
        shifts,
        userProfile,
        updated,
        payoutOverrides,
        salaryConfig,
        presets,
        vaultKey,
        true,
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
          presets,
          vaultKey,
          true,
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
          presets,
          vaultKey,
          true,
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
        presets,
        vaultKey,
        true,
        storageService.getDeletedShifts()
      ).catch(console.warn);
      setLastSyncTime(new Date());
    }
  };

  const handleSavePresets = (newPresets: PresetShift[]) => {
    storageService.savePresets(newPresets);
    setPresets(newPresets);
    if (firebaseUser) {
      firebaseService.saveUserData(
        getUserIdentifier(),
        shifts,
        userProfile,
        resolvedClaims,
        payoutOverrides,
        salaryConfig,
        newPresets,
        vaultKey,
        true,
        storageService.getDeletedShifts()
      ).catch(console.warn);
      setLastSyncTime(new Date());
    }
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
        presets,
        vaultKey,
        true,
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

        {/* TAB 1: 📅 Stundenzettel (direkt bearbeitbare Monatstabelle) */}
        {activeTab === 'stundenzettel' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <KpiCards stats={stats} salaryConfig={salaryConfig} />
            <MonthTable
              currentYearMonth={currentYearMonth}
              shifts={shifts}
              onDeleteShift={handleDeleteShift}
              onSaveShift={handleSaveShift}
              onCleanDuplicates={handleCleanDuplicates}
            />
          </div>
        )}

        {/* TAB 2: ⚡ Abrechnungsabgleich */}
        {activeTab === 'abgleich' && (
          <div className="space-y-4 animate-in fade-in duration-200">
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
          </div>
        )}

        {/* TAB 4: 📈 Statistik */}
        {activeTab === 'statistik' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <SalaryCharts
              currentYearMonth={currentYearMonth}
              shifts={shifts}
              salaryConfig={salaryConfig}
              isDarkMode={isDarkMode}
            />
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
