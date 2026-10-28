import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import confetti from 'canvas-confetti';
import { User } from 'firebase/auth';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { Toast, ToastMessage } from './components/Toast';
import { RotateCcw } from 'lucide-react';

// Tab 1: Stundenzettel (sofort geladen für maximale Startgeschwindigkeit)
import { KpiCards } from './components/Tabelle/KpiCards';
import { MonthTable } from './components/Tabelle/MonthTable';
import { MiniCalendar } from './components/Erfassen/MiniCalendar';
import { QuickEntry } from './components/Erfassen/QuickEntry';
import { StampClock } from './components/Erfassen/StampClock';

// Tab 4: Einstellungen (Kernkomponenten)
import { Stammdaten } from './components/Settings/Stammdaten';
import { PresetsConfig } from './components/Settings/PresetsConfig';
import { SalaryConfig as SalaryConfigComponent } from './components/Settings/SalaryConfig';
import { VaultConfig } from './components/Settings/VaultConfig';
import { AppVersionCard } from './components/Settings/AppVersionCard';

// Erinnerungen & Benachrichtigungen
import { MonthEndReminder } from './components/Common/MonthEndReminder';

// Sicherheits-Architektur, Multi-User & Auth-Wall
import { AuthLockScreen } from './components/Auth/AuthLockScreen';
import { OnboardingModal } from './components/Auth/OnboardingModal';
import { vaultService, isMohammad, MOHAMMAD_EMAIL } from './services/vaultService';
import { webAuthnService } from './services/webAuthnService';
import { setDecryptedHistoricalRecords, setDecryptedInitialClaims } from './services/clinicPayrollEngine';

// Code-Splitting: Schwergewichtige Sekundär-Tabs & Modals per React.lazy laden
// (Spart über 1 MB Initial-Download durch isoliertes Laden von ExcelJS, jsPDF, Chart.js und QR-Code)
const SalaryCharts = React.lazy(() =>
  import('./components/Tabelle/SalaryCharts').then(m => ({ default: m.SalaryCharts }))
);
const PayrollComparisonCard = React.lazy(() =>
  import('./components/Tabelle/PayrollComparisonCard').then(m => ({ default: m.PayrollComparisonCard }))
);
const MinijobJahresradar = React.lazy(() =>
  import('./components/Jahresradar/MinijobJahresradar').then(m => ({ default: m.MinijobJahresradar }))
);
const ExportActions = React.lazy(() =>
  import('./components/Export/ExportActions').then(m => ({ default: m.ExportActions }))
);
const SheetPreview = React.lazy(() =>
  import('./components/Export/SheetPreview').then(m => ({ default: m.SheetPreview }))
);
const EmailTemplateCard = React.lazy(() =>
  import('./components/Export/EmailTemplateCard').then(m => ({ default: m.EmailTemplateCard }))
);
const BackupManager = React.lazy(() =>
  import('./components/Settings/BackupManager').then(m => ({ default: m.BackupManager }))
);
const SyncModal = React.lazy(() =>
  import('./components/Auth/SyncModal').then(m => ({ default: m.SyncModal }))
);
const CloudStatusModal = React.lazy(() =>
  import('./components/Auth/CloudStatusModal').then(m => ({ default: m.CloudStatusModal }))
);
const VersionModal = React.lazy(() =>
  import('./components/Common/VersionModal').then(m => ({ default: m.VersionModal }))
);

const TabLoadingFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-3">
    <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    <span className="text-xs font-medium tracking-wide text-slate-400">Modul wird geladen...</span>
  </div>
);

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
  mergeShiftsWithTombstones,
  sameShiftSet,
  sameDeletedMap,
  checkRestTime,
  annualLimitStatus
} from './services/shiftUtils';
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

// Maximale Wartezeit für einen Cloud-Push (offline hängt Firestore sonst unbegrenzt)
const CLOUD_PUSH_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>(resolve => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

// Grundlohn-Summe eines Kalenderjahres (Basis für die Jahresgrenze-Hinweise)
function annualBasisWage(year: number, shifts: ShiftEntry[], config: SalaryConfig): number {
  let total = 0;
  for (let month = 1; month <= 12; month++) {
    total += calculateMonthSalary(year, month, shifts, config).basisLohn;
  }
  return Math.round(total * 100) / 100;
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('stundenzettel');
  const [stundenzettelView, setStundenzettelView] = useState<'tabelle' | 'kalender'>('tabelle');

  // Multi-User Sitzung & Autorisierung
  const [activeSession, setActiveSession] = useState<AppUserSession | null>(() => storageService.getActiveSession());
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState<boolean>(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState<boolean>(false);
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

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((
    text: string,
    type: 'success' | 'error' | 'info' = 'info',
    actionText?: string,
    onAction?: () => void,
    durationMs: number = 4500
  ) => {
    const id = `${Date.now()}_${Math.random()}`;
    const newToast: ToastMessage = { id, text, type, actionText, onAction };
    setToasts(prev => [...prev, newToast]);

    setTimeout(() => {
      dismissToast(id);
    }, durationMs);
  }, [dismissToast]);

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
    const activeKey = keyToUse || vaultKeyRef.current;
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

  // Helper zum Anwenden von Daten aus der Google Cloud.
  // Schichten werden pro Tag mit dem lokalen Stand zusammengeführt (neuerer Zeitstempel gewinnt,
  // Lösch-Tombstones werden respektiert), damit offline erfasste Dienste nicht verloren gehen.
  // Alle übrigen Daten übernimmt die Cloud 1:1 – es sei denn, es liegen noch nicht synchronisierte
  // lokale Änderungen vor (Offline-Queue); dann bleiben diese erhalten und werden nachgereicht.
  // Rückgabe: true, wenn der lokale Stand Daten enthält, die die Cloud noch nicht kennt (Push nötig).
  const applyCloudData = useCallback((cloudData: CloudUserData): boolean => {
    if (!cloudData) return false;

    const hasPendingLocalChanges = storageService.isCloudDirty();

    // 1. Schichten & Lösch-Tombstones zusammenführen
    const cloudDeleted =
      cloudData.deletedShifts && typeof cloudData.deletedShifts === 'object' ? cloudData.deletedShifts : {};
    const cloudShifts = deduplicateShifts(Array.isArray(cloudData.shifts) ? cloudData.shifts : []);
    const merged = mergeShiftsWithTombstones(
      storageService.getShifts(),
      cloudShifts,
      storageService.getDeletedShifts(),
      cloudDeleted
    );
    storageService.saveDeletedShifts(merged.deleted);
    storageService.saveShifts(merged.shifts);
    const finalShifts = storageService.getShifts();
    setShifts(finalShifts);
    setCloudShiftCount(cloudShifts.length);
    const needsPush = !sameShiftSet(finalShifts, cloudShifts) || !sameDeletedMap(merged.deleted, cloudDeleted);

    if (!hasPendingLocalChanges) {
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

      // 6b. E-Mail-Vorlage 1:1 übernehmen
      if (cloudData.emailTemplate && typeof cloudData.emailTemplate === 'object') {
        storageService.saveEmailTemplate(cloudData.emailTemplate);
      }
    }

    // 7. Rollback-Backups aktualisieren
    if (cloudData.backupHistory && Array.isArray(cloudData.backupHistory)) {
      setBackupHistory(cloudData.backupHistory);
    }

    setLastSyncTime(new Date());
    return needsPush;
  }, []);

  // ZENTRALER CLOUD-PUSH: sendet IMMER den aktuellen lokalen Speicherstand (Quelle der Wahrheit).
  // Das "ausstehend"-Flag (Offline-Queue) wird vor dem Senden gesetzt und erst nach bestätigtem
  // Erfolg gelöscht. Schlägt der Push fehl, bleiben alle Daten lokal erhalten und werden beim
  // nächsten Abgleich (Fokus, Wieder-Online, nächste Änderung) automatisch nachgereicht.
  const pushSeqRef = useRef<number>(0);
  const lastAutoPushRef = useRef<number>(0);

  const pushLocalToCloud = useCallback(async (
    opts: { identifier?: string; spinner?: boolean; notify?: boolean } = {}
  ): Promise<boolean> => {
    const identifier = opts.identifier || getUserIdentifier();
    if (!identifier || !firebaseService.getCurrentUser()) return false;

    const seq = ++pushSeqRef.current;
    storageService.setCloudDirty(true);
    if (opts.spinner) setIsSyncing(true);
    try {
      const res = await withTimeout(
        firebaseService.saveUserData(
          identifier,
          storageService.getShifts(),
          storageService.getProfile(),
          storageService.getResolvedClaims(),
          storageService.getPayoutOverrides(),
          storageService.getSalaryConfig(),
          storageService.getPresets(),
          vaultKeyRef.current,
          true,
          storageService.getDeletedShifts(),
          storageService.getEmailTemplate()
        ),
        CLOUD_PUSH_TIMEOUT_MS,
        { success: false, message: 'Zeitüberschreitung beim Speichern in der Cloud.' }
      );
      if (res.success) {
        // Nur löschen, wenn zwischenzeitlich kein neuerer Push gestartet wurde
        if (seq === pushSeqRef.current) storageService.setCloudDirty(false);
        setLastSyncTime(new Date());
        return true;
      }
    } catch (e) {
      console.warn('Cloud-Push fehlgeschlagen:', e);
    } finally {
      if (opts.spinner) setIsSyncing(false);
    }

    if (opts.notify !== false) {
      showToast(
        '⚠️ Cloud nicht erreichbar – Änderungen sind lokal gesichert und werden automatisch synchronisiert.',
        'info',
        undefined,
        undefined,
        7000
      );
    }
    return false;
  }, [getUserIdentifier, showToast]);

  // Immer die aktuellste Push-Funktion für Effekte mit eigenem Closure bereithalten
  const pushRef = useRef(pushLocalToCloud);
  pushRef.current = pushLocalToCloud;

  // Hintergrund-Push nach einem Cloud-Snapshot (mit Drosselung gegen Endlosschleifen zwischen Geräten)
  const requestBackgroundPush = useCallback(() => {
    const t = Date.now();
    if (t - lastAutoPushRef.current < 5000) {
      storageService.setCloudDirty(true);
      return;
    }
    lastAutoPushRef.current = t;
    void pushRef.current({ notify: false });
  }, []);

  // Manueller oder automatischer Cloud-Abgleich (Smart-Merge & Zero Data Loss)
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
        const needsPush = applyCloudData(cloudData) || storageService.isCloudDirty();
        const pushedOk = needsPush ? await pushLocalToCloud({ notify: showNotification }) : true;

        if (showNotification && pushedOk) {
          showToast('☁️ Daten mit Gmail-Cloud synchronisiert!', 'success');
        }
      } else {
        // Erstinitialisierung für diesen Gmail-Nutzer
        const hasLocalData = storageService.getShifts().length > 0;
        const pushedOk = hasLocalData ? await pushLocalToCloud({ notify: showNotification }) : true;
        setLastSyncTime(new Date());

        if (showNotification && pushedOk) {
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
  }, [getUserIdentifier, firebaseUser, applyCloudData, showToast, pushLocalToCloud]);

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
            // Firebase hat gespeicherte Daten -> mit dem lokalen Stand zusammenführen (nichts geht verloren)
            const needsPush = applyCloudData(cloudData) || storageService.isCloudDirty();

            // Wer bereits ein ausgefülltes Profil oder Schichten in der Cloud hat, ist kein Neuling mehr
            const hasCloudProfile = Boolean(cloudData.profile?.vorname);
            const hasCloudShifts = Array.isArray(cloudData.shifts) && cloudData.shifts.length > 0;
            if (!isOwner && (hasCloudProfile || hasCloudShifts)) {
              storageService.setUserOnboarded(true, userIdentifier);
              setShowOnboarding(false);
            }

            // Lokale Änderungen, die noch nicht in der Cloud sind (z. B. offline erfasst), nachreichen
            if (needsPush) {
              await pushRef.current({ identifier: userIdentifier, notify: false });
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
          // Offline / Verbindungsfehler: lokal gespeicherte Daten anzeigen; Abgleich folgt automatisch
          loadAllData();
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
      // Lokale Daten, die der Cloud-Stand nicht kennt, werden per Hintergrund-Push nachgereicht
      const needsPush = applyCloudData(cloudData);
      if (needsPush) requestBackgroundPush();
    });
    return () => unsubscribe();
  }, [activeUserUid, applyCloudData, requestBackgroundPush]);

  // Automatischer Abgleich bei Tab-Wechsel / Smartphone-Reaktivierung (mit 30s Drosselung)
  // und sofort nach Wiederherstellung der Internetverbindung (Offline-Queue wird nachgereicht)
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' && firebaseUser) {
        const now = Date.now();
        if (now - lastFocusSyncRef.current < 30000) return;
        lastFocusSyncRef.current = now;
        handleManualSync(false);
      }
    };

    const handleOnline = () => {
      if (!firebaseUser) return;
      lastFocusSyncRef.current = Date.now();
      handleManualSync(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('online', handleOnline);
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

      // Explizites 1:1-Neuladen: Cloud-Stand inklusive Lösch-Tombstones übernehmen
      storageService.saveDeletedShifts(
        cloudData.deletedShifts && typeof cloudData.deletedShifts === 'object' ? cloudData.deletedShifts : {}
      );
      storageService.saveShifts(cloudData.shifts);
      storageService.setCloudDirty(false);
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
      if (cloudData.emailTemplate && typeof cloudData.emailTemplate === 'object') {
        storageService.saveEmailTemplate(cloudData.emailTemplate);
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
        storageService.setCloudDirty(false);
        setLastSyncTime(new Date());
        setCloudShiftCount(currentShifts.length);
        showToast(`⬆️ ${currentShifts.length} Dienste erfolgreich in Cloud gesichert!`, 'success');

        try {
          const cloudData = await firebaseService.loadUserData(userIdentifier, vaultKeyRef.current);
          if (cloudData?.backupHistory) {
            setBackupHistory(cloudData.backupHistory);
          }
        } catch (e) {
          // Der Push war erfolgreich; ein Fehler beim Nachladen der Backup-Historie ist nicht kritisch
          console.warn('Backup-Historie konnte nicht nachgeladen werden:', e);
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

  // Wiederherstellung: Der wiederhergestellte Stand gilt auf allen Geräten als "neueste Wahrheit".
  // Alle Schichten erhalten einen aktuellen Zeitstempel, und Tage, die im alten Stand existierten,
  // im wiederhergestellten aber fehlen, bekommen einen Lösch-Tombstone. Sonst würde der Merge
  // sie von anderen Geräten wieder einspielen.
  const applyRestoredShifts = (restored: ShiftEntry[], previous: ShiftEntry[]): ShiftEntry[] => {
    const nowIso = new Date().toISOString();
    storageService.saveDeletedShifts({});
    storageService.saveShifts(restored.map(s => ({ ...s, updatedAt: nowIso })));
    const finalShifts = storageService.getShifts();
    const keptDates = new Set(finalShifts.map(s => s.datum));
    for (const s of previous) {
      if (!keptDates.has(s.datum)) storageService.markShiftDeleted(s.datum);
    }
    return finalShifts;
  };

  // Button 4b: Lokale Backup-Datei (JSON) wiederherstellen
  const handleRestoreJsonBackup = async (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const text = event.target?.result as string;
          const parsed = JSON.parse(text);
          const previousShifts = storageService.getShifts();
          const result = storageService.restoreBackup(parsed);
          if (result.success) {
            applyRestoredShifts(storageService.getShifts(), previousShifts);
            loadAllData();
            showToast(result.message, 'success');

            // Sofort 1:1 in die Cloud sichern (inkl. Tombstones)
            const ok = await pushLocalToCloud({ spinner: true });
            if (ok) setCloudShiftCount(storageService.getShifts().length);
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

    const restoredShifts = applyRestoredShifts(backup.shifts, storageService.getShifts());
    setShifts(restoredShifts);

    if (backup.profile) {
      const restoredProfile = { ...DEFAULT_USER_PROFILE, ...backup.profile } as UserProfile;
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
    if (backup.salaryConfig) {
      const restoredSalary = { ...DEFAULT_SALARY_CONFIG, ...backup.salaryConfig } as SalaryConfig;
      storageService.saveSalaryConfig(restoredSalary);
      setSalaryConfig(restoredSalary);
    }
    if (backup.presets && backup.presets.length > 0) {
      storageService.savePresets(backup.presets);
      setPresets(backup.presets);
    }

    const ok = await pushLocalToCloud({ spinner: true, notify: false });
    const timeLabel = new Date(backup.timestamp).toLocaleTimeString('de-DE');
    if (ok) {
      showToast(`↩️ Version vom ${timeLabel} erfolgreich wiederhergestellt!`, 'success');
    } else {
      showToast(`↩️ Version vom ${timeLabel} lokal wiederhergestellt – Cloud-Sync folgt automatisch.`, 'info');
    }
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
        email: isOwner ? MOHAMMAD_EMAIL : (userId.includes('@') ? userId : undefined),
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

  // Biometrischer Login (Touch ID / Face ID / Windows Hello)
  const handleBiometricLogin = async (): Promise<boolean> => {
    try {
      setAuthError(null);
      const res = await webAuthnService.authenticate();
      if (!res.success || !res.userId) {
        if (res.message) {
          setAuthError(res.message);
          showToast(res.message, 'error');
        }
        return false;
      }

      const userId = res.userId;
      const isOwner = isMohammad(userId);
      const session: AppUserSession = {
        id: userId,
        name: res.userName || (isOwner ? 'Mohammad Almatar' : 'Mitarbeiter'),
        email: isOwner ? MOHAMMAD_EMAIL : (userId.includes('@') ? userId : undefined),
        authProvider: 'biometric',
        isOwner,
        isOnboarded: isOwner || storageService.isUserOnboarded(userId),
        lastLogin: new Date().toISOString()
      };

      storageService.setActiveSession(session);
      setActiveSession(session);

      if (isOwner) {
        await unlockMohammadData(vaultService.getDefaultPass());
      } else {
        setDecryptedHistoricalRecords([]);
        setDecryptedInitialClaims([]);
        if (!storageService.isUserOnboarded(userId)) {
          setShowOnboarding(true);
        }
      }

      loadAllData();
      showToast(`✨ Biometrisch entsperrt: Willkommen, ${session.name}!`, 'success');
      return true;
    } catch (err: any) {
      const msg = err.message || 'Biometrische Authentifizierung fehlgeschlagen.';
      setAuthError(msg);
      showToast(msg, 'error');
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

  // Schicht speichern (inkl. Hinweise zu Ruhezeit und Jahresgrenze)
  const buildAnnualLimitWarning = (before: ShiftEntry[], entry: ShiftEntry): string | null => {
    const year = parseInt(entry.datum.substring(0, 4), 10);
    if (!Number.isFinite(year) || !(entry.nettoStunden > 0)) return null;

    const totalBefore = annualBasisWage(year, before, salaryConfig);
    const totalAfter = annualBasisWage(year, [...before.filter(s => s.datum !== entry.datum), entry], salaryConfig);
    if (totalAfter <= totalBefore) return null;

    const limit = salaryConfig.annualLimit;
    const { ratio, level } = annualLimitStatus(totalAfter, limit);
    if (level === 'ok') return null;

    const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return level === 'over'
      ? `Jahresgrenze von ${fmt(limit)} € überschritten (Grundlohn bisher ${fmt(totalAfter)} €).`
      : `${Math.round(ratio * 100)} % der Jahresgrenze (${fmt(limit)} €) erreicht – Grundlohn bisher ${fmt(totalAfter)} €.`;
  };

  const handleSaveShift = async (newShift: ShiftEntry) => {
    // Hinweise VOR dem Speichern berechnen (Vergleich mit dem bisherigen Stand)
    const previousShifts = storageService.getShifts();
    const restWarning = checkRestTime(previousShifts, newShift);
    const limitWarning = buildAnnualLimitWarning(previousShifts, newShift);

    const updated = storageService.upsertShift(newShift);
    setShifts(updated);

    showToast(`✅ Schicht für ${newShift.datum} gespeichert (${newShift.nettoStunden.toFixed(2)} h)`, 'success');
    if (restWarning) showToast(`⚠️ ${restWarning}`, 'info', undefined, undefined, 9000);
    if (limitWarning) showToast(`⚠️ ${limitWarning}`, 'info', undefined, undefined, 9000);

    if (newShift.nettoStunden >= 8) {
      confetti({
        particleCount: 25,
        spread: 45,
        origin: { y: 0.85 }
      });
    }

    await pushLocalToCloud({ spinner: true });
  };

  // Doppelte Schichten am selben Kalendertag bereinigen (Button im Monats-Stundenzettel)
  const handleCleanDuplicates = async () => {
    const res = storageService.cleanDuplicateShifts();
    setShifts(res.remainingShifts);

    await pushLocalToCloud({ spinner: true });

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
    void pushLocalToCloud();

    showToast(
      `Schicht für ${datum} gelöscht`,
      'info',
      'Rückgängig',
      () => {
        const restored = storageService.upsertShift(shiftToDelete);
        setShifts(restored);
        void pushLocalToCloud();
        showToast('Eintrag wiederhergestellt!', 'success');
      }
    );
  };

  // Posten abhaken / öffnen (sofortige Sicherung in der Cloud)
  const handleToggleClaim = (claimId: string) => {
    const isCurrentlyResolved = Boolean(resolvedClaims[claimId]?.isResolved);
    const updated = storageService.setClaimResolved(claimId, !isCurrentlyResolved);
    setResolvedClaims({ ...updated });

    if (!isCurrentlyResolved) {
      showToast('✅ Posten als beglichen / erledigt markiert!', 'success');
    } else {
      showToast('↩️ Posten wieder geöffnet!', 'info');
    }

    void pushLocalToCloud();
  };

  // Auszahlungs-Override (Bank-Ist) speichern
  const handleSavePayoutOverride = async (override: MonthPayoutOverride) => {
    const updated = storageService.savePayoutOverride(override);
    setPayoutOverrides({ ...updated });
    await pushLocalToCloud({ spinner: true });
  };

  const handleDeletePayoutOverride = async (yearMonth: string) => {
    const updated = storageService.deletePayoutOverride(yearMonth);
    setPayoutOverrides({ ...updated });
    await pushLocalToCloud({ spinner: true });
  };

  // Profile / Config Saves
  const handleSaveProfile = (profile: UserProfile) => {
    storageService.saveProfile(profile);
    setUserProfile(profile);
    void pushLocalToCloud();
  };

  const handleSavePresets = (newPresets: PresetShift[]) => {
    storageService.savePresets(newPresets);
    setPresets(newPresets);
    void pushLocalToCloud();
  };

  const handleSaveSalaryConfig = (config: SalaryConfig) => {
    storageService.saveSalaryConfig(config);
    setSalaryConfig(config);
    void pushLocalToCloud();
  };

  // STRIKTE AUTH-WALL: Solange kein Nutzer aktiv ist, wird das Dashboard NIEMALS gerendert!
  if (!activeSession) {
    return (
      <>
        <AuthLockScreen
          onGoogleLogin={handleGoogleLogin}
          onUnlockWithPin={handleUnlockWithPin}
          onBiometricLogin={handleBiometricLogin}
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
      <Suspense fallback={null}>
        <SyncModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          onSyncComplete={loadAllData}
          showToast={showToast}
        />
      </Suspense>

      {/* Gmail-Cloud Status Menü (Regel 4: Zero Data Loss, Smart-Merge & Rollback) */}
      <Suspense fallback={null}>
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
      </Suspense>

      {/* App-Version & Update-Modal */}
      <Suspense fallback={null}>
        <VersionModal
          isOpen={isVersionModalOpen}
          onClose={() => setIsVersionModalOpen(false)}
        />
      </Suspense>

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
        onOpenVersionModal={() => setIsVersionModalOpen(true)}
        lastSyncTime={lastSyncTime}
        onLockApp={handleLogout}
      />

      {/* Hauptinhalt */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 pt-4 pb-28">

        {/* Monatsabschluss-Erinnerung (>= 24. des Monats oder <= 6. Folgemonat) */}
        <MonthEndReminder
          shifts={shifts}
          onNavigateTab={setActiveTab}
          onShowToast={showToast}
        />

        {/* TAB 1: 📅 Stundenzettel (direkt bearbeitbare Monatstabelle oder Kalender + Schnelleingabe) */}
        {activeTab === 'stundenzettel' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <StampClock shifts={shifts} onSaveShift={handleSaveShift} onShowToast={showToast} />
            <KpiCards stats={stats} salaryConfig={salaryConfig} />

            {/* Ansichts-Umschalter: Tabelle vs. Kalender & Schnelleingabe */}
            <div className="flex items-center gap-2 p-1.5 bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/10">
              <button
                type="button"
                onClick={() => setStundenzettelView('tabelle')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  stundenzettelView === 'tabelle'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>📋</span> Tabellenansicht
              </button>
              <button
                type="button"
                onClick={() => setStundenzettelView('kalender')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  stundenzettelView === 'kalender'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>📅</span> Kalender & Schnelleingabe
              </button>
            </div>

            {stundenzettelView === 'tabelle' ? (
              <MonthTable
                currentYearMonth={currentYearMonth}
                shifts={shifts}
                onDeleteShift={handleDeleteShift}
                onSaveShift={handleSaveShift}
                onCleanDuplicates={handleCleanDuplicates}
              />
            ) : (
              <div className="space-y-4 animate-in fade-in duration-150">
                <MiniCalendar
                  currentYearMonth={currentYearMonth}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  shifts={shifts}
                />
                <QuickEntry
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                  shifts={shifts}
                  presets={presets}
                  onSaveShift={handleSaveShift}
                  onDeleteShift={handleDeleteShift}
                />
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ⚡ Abrechnungsabgleich */}
        {activeTab === 'abgleich' && (
          <Suspense fallback={<TabLoadingFallback />}>
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
          </Suspense>
        )}

        {/* TAB 4: 📈 Statistik */}
        {activeTab === 'statistik' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <div className="space-y-4 animate-in fade-in duration-200">
              <SalaryCharts
                currentYearMonth={currentYearMonth}
                shifts={shifts}
                salaryConfig={salaryConfig}
                isDarkMode={isDarkMode}
              />
            </div>
          </Suspense>
        )}

        {/* TAB 2b: 🎯 Direktzugriff auf Minijob-Jahresradar */}
        {activeTab === 'jahresradar' && (
          <Suspense fallback={<TabLoadingFallback />}>
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
          </Suspense>
        )}

        {/* TAB 3: ✉️ E-Mail Vorlage */}
        {activeTab === 'email' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <div className="space-y-4 animate-in fade-in duration-200">
              <EmailTemplateCard
                currentYearMonth={currentYearMonth}
                userProfile={userProfile}
                shifts={shifts}
                onShowToast={showToast}
                onSaveEmailTemplate={() => void pushLocalToCloud()}
              />
            </div>
          </Suspense>
        )}

        {/* TAB 4: 📄 Export */}
        {activeTab === 'export' && (
          <Suspense fallback={<TabLoadingFallback />}>
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
          </Suspense>
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
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-semibold cursor-pointer"
                  >
                    Sync-Code (PC ↔ Handy)
                  </button>
                </div>
              </div>
            </div>

            {/* App-Version & Aktualisierungs-Verfolgung */}
            <AppVersionCard onShowToast={showToast} />

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

            <Suspense fallback={<TabLoadingFallback />}>
              <BackupManager
                currentYearMonth={currentYearMonth}
                onDataReload={loadAllData}
                onShowToast={showToast}
              />
            </Suspense>
          </div>
        )}
      </main>

      {/* Feste App-Navigation (Bottom Tab Bar) */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default App;
