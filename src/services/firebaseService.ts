import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  onAuthStateChanged,
  User,
  setPersistence,
  browserLocalPersistence,
  Auth
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  Firestore
} from 'firebase/firestore';
import {
  ShiftEntry,
  UserProfile,
  ResolvedClaimStatus,
  MonthPayoutOverride,
  SalaryConfig,
  CloudUserData,
  CloudBackupItem
} from '../types';
import { vaultService, isMohammad, MOHAMMAD_EMAIL } from './vaultService';

// Fallback Firebase-Konfiguration für GitHub Pages (osmedicus.github.io)
const FALLBACK_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAkqcW0nGb0bNgZZoV6mfdF-HAylwjeYtw",
  authDomain: "zeiterfassung-app-56bfa.firebaseapp.com",
  projectId: "zeiterfassung-app-56bfa",
  storageBucket: "zeiterfassung-app-56bfa.firebasestorage.app",
  messagingSenderId: "48863732219",
  appId: "1:48863732219:web:7202f1e35ffd4600e76b5e"
};

const getFirebaseConfig = () => {
  const custom = (window as any).__APP_CONFIG__?.firebase;
  if (custom && custom.apiKey) return custom;

  const env = (import.meta as any).env || {};

  const apiKey = env.VITE_FIREBASE_API_KEY || (window as any).ENV_FIREBASE_API_KEY || FALLBACK_FIREBASE_CONFIG.apiKey;
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN || (window as any).ENV_FIREBASE_AUTH_DOMAIN || FALLBACK_FIREBASE_CONFIG.authDomain;
  const projectId = env.VITE_FIREBASE_PROJECT_ID || (window as any).ENV_FIREBASE_PROJECT_ID || FALLBACK_FIREBASE_CONFIG.projectId;
  const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET || (window as any).ENV_FIREBASE_STORAGE_BUCKET || FALLBACK_FIREBASE_CONFIG.storageBucket;
  const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID || (window as any).ENV_FIREBASE_MESSAGING_SENDER_ID || FALLBACK_FIREBASE_CONFIG.messagingSenderId;
  const appId = env.VITE_FIREBASE_APP_ID || (window as any).ENV_FIREBASE_APP_ID || FALLBACK_FIREBASE_CONFIG.appId;

  if (!apiKey || apiKey.length < 10) return null;

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId
  };
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let firebaseInitialized = false;

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

function initFirebase() {
  if (firebaseInitialized && auth && db) return;
  try {
    const config = getFirebaseConfig();
    if (config && config.apiKey) {
      app = getApps().length > 0 ? getApp() : initializeApp(config);
      auth = getAuth(app);
      db = getFirestore(app);
      setPersistence(auth, browserLocalPersistence).catch(() => {});
      firebaseInitialized = true;
    }
  } catch (err) {
    firebaseInitialized = false;
  }
}

initFirebase();

/**
 * Regel 1: Normalisierung der E-Mail für strikte Cloud-Isolation
 */
export function normalizeUserEmail(emailOrUid?: string | null): string {
  if (!emailOrUid) return 'anon';
  return emailOrUid.toLowerCase().trim();
}

/**
 * Regel 2: Intelligenter Smart-Merge auf Eintrags-Ebene (Zero Data Loss & Zero Zombies)
 * Führt lokale Schichten und Cloud-Schichten lückenlos zusammen,
 * filtert gelöschte Schichten anhand von Tombstones aus und erzwingt
 * eine strikte 1-Schicht-pro-Tag-Deduplizierung.
 */
export function smartMergeShifts(
  localShifts: ShiftEntry[] = [],
  cloudShifts: ShiftEntry[] = [],
  deletedShifts: Record<string, { datum: string; deletedAt: string }> = {}
): ShiftEntry[] {
  const map = new Map<string, ShiftEntry>();

  const isShiftDeleted = (shift: ShiftEntry): boolean => {
    if (!shift || !shift.datum) return true;
    const tombstone = deletedShifts[shift.datum];
    if (!tombstone) return false;
    const tDel = new Date(tombstone.deletedAt).getTime();
    const tShift = shift.updatedAt ? new Date(shift.updatedAt).getTime() : 0;
    return tDel >= tShift;
  };

  const pickBestShift = (s1: ShiftEntry, s2: ShiftEntry): ShiftEntry => {
    // 1. Schicht mit geleisteter Arbeitszeit (>0) gewinnt vor leeren 0h-Einträgen
    if (s1.nettoStunden > 0 && (!s2.nettoStunden || s2.nettoStunden === 0)) return s1;
    if (s2.nettoStunden > 0 && (!s1.nettoStunden || s1.nettoStunden === 0)) return s2;

    // 2. Wenn beide updatedAt haben, gewinnt das neuere
    if (s1.updatedAt && s2.updatedAt) {
      const t1 = new Date(s1.updatedAt).getTime();
      const t2 = new Date(s2.updatedAt).getTime();
      if (!isNaN(t1) && !isNaN(t2)) {
        if (t1 > t2) return s1;
        if (t2 > t1) return s2;
      }
    } else if (s1.updatedAt && !s2.updatedAt) {
      return s1;
    } else if (!s1.updatedAt && s2.updatedAt) {
      return s2;
    }

    // 3. Vollständigerer Eintrag gewinnt
    const score1 = (s1.kommen ? 1 : 0) + (s1.gehen ? 1 : 0) + (s1.notiz ? 1 : 0);
    const score2 = (s2.kommen ? 1 : 0) + (s2.gehen ? 1 : 0) + (s2.notiz ? 1 : 0);
    if (score1 >= score2) return s1;
    return s2;
  };

  // 1. Alle Cloud-Schichten einlesen (nur wenn nicht durch Tombstone gelöscht)
  for (const cs of cloudShifts || []) {
    if (cs && cs.datum && !isShiftDeleted(cs)) {
      const existing = map.get(cs.datum);
      if (existing) {
        map.set(cs.datum, pickBestShift(cs, existing));
      } else {
        map.set(cs.datum, cs);
      }
    }
  }

  // 2. Lokale Schichten einmischen / mergen (nur wenn nicht gelöscht)
  for (const ls of localShifts || []) {
    if (ls && ls.datum && !isShiftDeleted(ls)) {
      const existing = map.get(ls.datum);
      if (existing) {
        map.set(ls.datum, pickBestShift(ls, existing));
      } else {
        map.set(ls.datum, ls);
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.datum.localeCompare(b.datum));
}

/**
 * Regel 2: Mengen-Vereinigung (Union / Set) für erledigte Nachforderungen:
 * Ein Posten, der auf dem Gerät ODER in der Cloud als erledigt markiert wurde,
 * BLEIBT dauerhaft erledigt (true gewinnt IMMER gegen false!).
 * Ein Posten wird nur dann geöffnet, wenn er explizit nach dem Schließen wieder geöffnet wurde.
 */
export function smartMergeClaims(
  localClaims: Record<string, ResolvedClaimStatus> = {},
  cloudClaims: Record<string, ResolvedClaimStatus> = {}
): Record<string, ResolvedClaimStatus> {
  const allKeys = new Set([
    ...Object.keys(localClaims || {}),
    ...Object.keys(cloudClaims || {})
  ]);
  const merged: Record<string, ResolvedClaimStatus> = {};

  for (const key of allKeys) {
    const lClaim = localClaims?.[key];
    const cClaim = cloudClaims?.[key];

    if (lClaim && !cClaim) {
      merged[key] = { ...lClaim };
      continue;
    }
    if (!lClaim && cClaim) {
      merged[key] = { ...cClaim };
      continue;
    }
    if (!lClaim && !cClaim) continue;

    const lResolved = Boolean(lClaim?.isResolved);
    const cResolved = Boolean(cClaim?.isResolved);

    if (lResolved && !cResolved) {
      // Prüfe, ob cloud explizit danach wiedereröffnet wurde
      const cReopened = cClaim?.reopenedAt ? new Date(cClaim.reopenedAt).getTime() : 0;
      const lUpdated = lClaim?.updatedAt ? new Date(lClaim.updatedAt).getTime() : 0;
      if (cReopened > lUpdated) {
        merged[key] = { ...cClaim, isResolved: false };
      } else {
        // MENGEN-VEREINIGUNG: true gewinnt immer gegen false!
        merged[key] = { ...lClaim, isResolved: true };
      }
    } else if (!lResolved && cResolved) {
      const lReopened = lClaim?.reopenedAt ? new Date(lClaim.reopenedAt).getTime() : 0;
      const cUpdated = cClaim?.updatedAt ? new Date(cClaim.updatedAt).getTime() : 0;
      if (lReopened > cUpdated) {
        merged[key] = { ...lClaim, isResolved: false };
      } else {
        // MENGEN-VEREINIGUNG: true gewinnt immer gegen false!
        merged[key] = { ...cClaim, isResolved: true };
      }
    } else if (lResolved && cResolved) {
      const tL = lClaim?.updatedAt ? new Date(lClaim.updatedAt).getTime() : 0;
      const tC = cClaim?.updatedAt ? new Date(cClaim.updatedAt).getTime() : 0;
      const base = tL >= tC ? lClaim : cClaim;
      merged[key] = {
        ...base,
        isResolved: true,
        resolvedDate: lClaim?.resolvedDate || cClaim?.resolvedDate
      };
    } else {
      const tL = lClaim?.updatedAt ? new Date(lClaim.updatedAt).getTime() : 0;
      const tC = cClaim?.updatedAt ? new Date(cClaim.updatedAt).getTime() : 0;
      merged[key] = tL >= tC ? { ...lClaim } : { ...cClaim };
    }
  }

  return merged;
}

export function smartMergeDeletedShifts(
  localDeleted: Record<string, { datum: string; deletedAt: string }> = {},
  cloudDeleted: Record<string, { datum: string; deletedAt: string }> = {}
): Record<string, { datum: string; deletedAt: string }> {
  const merged: Record<string, { datum: string; deletedAt: string }> = { ...(cloudDeleted || {}) };
  for (const [datum, lItem] of Object.entries(localDeleted || {})) {
    const cItem = merged[datum];
    if (!cItem) {
      merged[datum] = lItem;
    } else {
      const tL = lItem.deletedAt ? new Date(lItem.deletedAt).getTime() : 0;
      const tC = cItem.deletedAt ? new Date(cItem.deletedAt).getTime() : 0;
      if (tL >= tC) {
        merged[datum] = lItem;
      }
    }
  }
  return merged;
}

export function smartMergeOverrides(
  localOverrides: Record<string, MonthPayoutOverride> = {},
  cloudOverrides: Record<string, MonthPayoutOverride> = {}
): Record<string, MonthPayoutOverride> {
  const merged: Record<string, MonthPayoutOverride> = { ...cloudOverrides };

  for (const [ym, lOver] of Object.entries(localOverrides || {})) {
    const cOver = merged[ym];
    if (!cOver) {
      merged[ym] = lOver;
    } else {
      const tLocal = lOver.updatedAt ? new Date(lOver.updatedAt).getTime() : 0;
      const tCloud = cOver.updatedAt ? new Date(cOver.updatedAt).getTime() : 0;
      if (tLocal >= tCloud) {
        merged[ym] = lOver;
      }
    }
  }

  return merged;
}

function parseCloudUserData(data: any): CloudUserData {
  let shifts: ShiftEntry[] = [];
  if (typeof data.arbeitszeiten === 'string') {
    try {
      shifts = JSON.parse(data.arbeitszeiten);
    } catch {
      shifts = [];
    }
  } else if (Array.isArray(data.shifts)) {
    shifts = data.shifts;
  } else if (Array.isArray(data.arbeitszeiten)) {
    shifts = data.arbeitszeiten;
  }

  const profile: Partial<UserProfile> = data.profile || {};
  if (data.ma_name && !profile.name) profile.name = data.ma_name;
  if (data.ma_vorname && !profile.vorname) profile.vorname = data.ma_vorname;
  if (data.ma_personalnummer && !profile.personalnummer) profile.personalnummer = data.ma_personalnummer;
  if (data.abteilung && !profile.abteilung) profile.abteilung = data.abteilung;
  if (data.klinik && !profile.klinik) profile.klinik = data.klinik;

  let resolvedClaims: Record<string, ResolvedClaimStatus> = {};
  if (typeof data.resolvedClaimsJson === 'string') {
    try {
      resolvedClaims = JSON.parse(data.resolvedClaimsJson);
    } catch {}
  } else if (data.resolvedClaims && typeof data.resolvedClaims === 'object') {
    resolvedClaims = data.resolvedClaims;
  }

  let payoutOverrides: Record<string, MonthPayoutOverride> = {};
  if (typeof data.payoutOverridesJson === 'string') {
    try {
      payoutOverrides = JSON.parse(data.payoutOverridesJson);
    } catch {}
  } else if (data.payoutOverrides && typeof data.payoutOverrides === 'object') {
    payoutOverrides = data.payoutOverrides;
  }

  let salaryConfig: Partial<SalaryConfig> | undefined;
  if (typeof data.salaryConfigJson === 'string') {
    try {
      salaryConfig = JSON.parse(data.salaryConfigJson);
    } catch {}
  } else if (data.salaryConfig && typeof data.salaryConfig === 'object') {
    salaryConfig = data.salaryConfig;
  }

  let backupHistory: CloudBackupItem[] = [];
  if (Array.isArray(data.backupHistory)) {
    backupHistory = data.backupHistory;
  }

  let deletedShifts: Record<string, { datum: string; deletedAt: string }> = {};
  if (data.deletedShifts && typeof data.deletedShifts === 'object') {
    deletedShifts = data.deletedShifts;
  }

  return {
    email: data.email,
    uid: data.uid,
    shifts,
    profile,
    resolvedClaims,
    payoutOverrides,
    salaryConfig,
    backupHistory,
    deletedShifts,
    lastUpdated: data.lastUpdated,
    lastDevice: data.lastDevice
  };
}

export const firebaseService = {
  isConfigured(): boolean {
    return Boolean(auth && db);
  },

  getAuthInstance(): Auth | undefined {
    if (!auth) initFirebase();
    return auth;
  },

  getCurrentUser(): User | null {
    return auth?.currentUser || null;
  },

  onAuthChanged(callback: (user: User | null, errorMsg?: string | null) => void): () => void {
    if (!auth) initFirebase();
    if (!auth) {
      callback(null, null);
      return () => {};
    }
    return onAuthStateChanged(auth, (user) => {
      callback(user, null);
    });
  },

  async loginWithGoogle(): Promise<User> {
    if (!auth) initFirebase();
    if (!auth) {
      throw new Error("Google Login ist auf diesem Server aktuell nicht verfügbar. Bitte nutze dein persönliches Schnell-Profil (Name & PIN) – funktioniert sofort und 100% offline.");
    }
    try {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (err: any) {
      if (err.code === 'auth/unauthorized-domain') {
        throw new Error("Diese Domain (osmedicus.github.io) ist im Google-Projekt noch nicht als autorisierte Domain hinterlegt. Bitte nutze das Schnell-Profil mit PIN – 100% offline & sicher!");
      }
      if (err.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, provider);
        throw new Error("Popup wurde blockiert – Weiterleitung initiiert.");
      }
      throw err;
    }
  },

  async logout(): Promise<void> {
    if (auth) {
      try {
        await signOut(auth);
      } catch {}
    }
  },

  /**
   * Regel 1: Lädt Daten primär aus users/{normalizedEmail}, mit Fallback auf users/{uid}
   */
  async loadUserData(emailOrUid: string, vaultPassphrase?: string): Promise<CloudUserData | null> {
    if (!db || !emailOrUid) return null;
    try {
      const norm = normalizeUserEmail(emailOrUid);

      // 1. Suche nach Dokument mit normalisierter E-Mail
      let userRef = doc(db, 'users', norm);
      let snapshot = await getDoc(userRef);

      // 2. Fallback: Suche nach UID (für Altbestände)
      if (!snapshot.exists() && auth?.currentUser?.uid && auth.currentUser.uid !== norm) {
        const altRef = doc(db, 'users', auth.currentUser.uid);
        const altSnap = await getDoc(altRef);
        if (altSnap.exists()) {
          snapshot = altSnap;
          userRef = altRef;
        }
      }

      if (!snapshot.exists()) return null;

      const data = snapshot.data();

      // Verschlüsselungskompatibilität für Altdaten
      if (data.isEncrypted && data.encryptedPayload) {
        try {
          const decrypted = await vaultService.decryptData<CloudUserData>(data.encryptedPayload, vaultPassphrase);
          return decrypted;
        } catch {
          // Falls Entschlüsselung fehlschlägt, versuche plain zu parsen
          return parseCloudUserData(data);
        }
      }

      return parseCloudUserData(data);
    } catch (e) {
      console.warn("Fehler beim Laden der Cloud-Daten:", e);
      return null;
    }
  },

  /**
   * Regel 2 & 4: Zero-Data-Loss Schutz & 3-Versionen-Backup-History
   * Ein leerer lokaler Zustand (0.00h) darf NIEMALS einen vorhandenen Cloud-Stand überschreiben!
   */
  async saveUserData(
    emailOrUid: string,
    shifts: ShiftEntry[],
    profile: UserProfile,
    resolvedClaims: Record<string, ResolvedClaimStatus> = {},
    payoutOverrides: Record<string, MonthPayoutOverride> = {},
    salaryConfig?: SalaryConfig,
    vaultPassphrase?: string,
    forceOverwrite: boolean = false,
    deletedShifts: Record<string, { datum: string; deletedAt: string }> = {}
  ): Promise<{ success: boolean; message: string }> {
    if (!db || !emailOrUid) {
      return { success: false, message: 'Datenbank nicht initialisiert.' };
    }

    try {
      const norm = normalizeUserEmail(emailOrUid);
      const userRef = doc(db, 'users', norm);

      // Vorherigen Cloud-Stand abfragen für Zero-Data-Loss-Prüfung & Backup
      const existingSnap = await getDoc(userRef);
      let backupHistory: CloudBackupItem[] = [];
      let consolidatedClaims = { ...resolvedClaims };
      let consolidatedDeleted = { ...deletedShifts };

      if (existingSnap.exists()) {
        const exData = existingSnap.data();

        // Regel 2: Mengen-Vereinigung für resolvedClaims - geschlossener Posten darf NIEMALS durch ältere Daten wieder geöffnet werden!
        const exResolved = exData.resolvedClaims && typeof exData.resolvedClaims === 'object' ? exData.resolvedClaims : {};
        consolidatedClaims = smartMergeClaims(resolvedClaims, exResolved);

        if (forceOverwrite) {
          consolidatedDeleted = { ...deletedShifts };
        } else {
          // Merge deletedShifts (Tombstones)
          const exDeleted = exData.deletedShifts && typeof exData.deletedShifts === 'object' ? exData.deletedShifts : {};
          consolidatedDeleted = smartMergeDeletedShifts(deletedShifts, exDeleted);
        }

        // ZERO-DATA-LOSS SCHUTZ:
        // Wenn lokal 0 Schichten vorliegen, in der Cloud aber Schichten vorhanden sind und kein forceOverwrite vorliegt:
        if (!forceOverwrite && shifts.length === 0 && Array.isArray(exData.shifts) && exData.shifts.length > 0) {
          console.warn("ZERO-DATA-LOSS SCHUTZ AKTIV: Lokaler Leerstand (0.00h) blockiert! Cloud-Stand mit", exData.shifts.length, "Schichten bleibt geschützt.");
          return {
            success: false,
            message: `Zero-Data-Loss Schutz: Cloud enthält bereits ${exData.shifts.length} Schichten. Überschreiben mit leerem Zustand abgelehnt.`
          };
        }

        // Regel 4: Vorherigen Zustand als Sicherheitskopie in backupHistory archivieren (max. 3)
        backupHistory = Array.isArray(exData.backupHistory) ? exData.backupHistory : [];
        if (Array.isArray(exData.shifts) && exData.shifts.length > 0) {
          const snapshotItem: CloudBackupItem = {
            timestamp: exData.updatedAt || new Date().toISOString(),
            shiftCount: exData.shifts.length,
            note: `Automatisches Backup vor Änderung am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Uhr`,
            shifts: exData.shifts,
            profile: exData.profile || {},
            salaryConfig: exData.salaryConfig || {},
            resolvedClaims: exData.resolvedClaims || {},
            payoutOverrides: exData.payoutOverrides || {},
            deletedShifts: exData.deletedShifts || {}
          };
          backupHistory.unshift(snapshotItem);
          if (backupHistory.length > 3) {
            backupHistory = backupHistory.slice(0, 3);
          }
        }
      }

      // Reines Dokument ohne Datenverlust speichern (mit deduplizierten Schichten)
      const cloudPayload: any = {
        email: norm,
        uid: auth?.currentUser?.uid || norm,
        shifts: forceOverwrite ? smartMergeShifts(shifts, [], {}) : smartMergeShifts(shifts, [], consolidatedDeleted),
        profile,
        resolvedClaims: consolidatedClaims,
        payoutOverrides,
        salaryConfig,
        backupHistory,
        deletedShifts: consolidatedDeleted,
        clientVersion: '3.2.0',
        updatedAt: new Date().toISOString(),
        lastUpdated: serverTimestamp(),
        lastDevice: navigator.userAgent
      };

      await setDoc(userRef, cloudPayload, { merge: true });

      return {
        success: true,
        message: `Erfolgreich ${cloudPayload.shifts.length} Schichten in Gmail-Cloud gesichert!`
      };
    } catch (err: any) {
      console.warn("Cloud-Speicherung fehlgeschlagen:", err);
      return { success: false, message: err.message || 'Fehler beim Speichern in Cloud.' };
    }
  },

  /**
   * Stellt einen der 3 Backup-Stände aus der Cloud wieder her
   */
  async restoreCloudBackup(
    emailOrUid: string,
    backupIndex: number
  ): Promise<CloudBackupItem | null> {
    if (!db || !emailOrUid) return null;
    try {
      const norm = normalizeUserEmail(emailOrUid);
      const userRef = doc(db, 'users', norm);
      const snap = await getDoc(userRef);
      if (!snap.exists()) return null;

      const data = snap.data();
      const history: CloudBackupItem[] = Array.isArray(data.backupHistory) ? data.backupHistory : [];
      if (backupIndex < 0 || backupIndex >= history.length) return null;

      return history[backupIndex];
    } catch {
      return null;
    }
  },

  subscribeUserData(
    emailOrUid: string,
    callback: (data: CloudUserData) => void
  ): () => void {
    if (!db || !emailOrUid) return () => {};
    try {
      const norm = normalizeUserEmail(emailOrUid);
      const userRef = doc(db, 'users', norm);
      return onSnapshot(userRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        callback(parseCloudUserData(data));
      }, () => {});
    } catch {
      return () => {};
    }
  },

  smartMergeShifts,
  smartMergeClaims,
  smartMergeOverrides,
  smartMergeDeletedShifts,
  normalizeUserEmail
};

export { isMohammad, MOHAMMAD_EMAIL };
