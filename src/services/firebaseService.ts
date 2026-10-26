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
import { ShiftEntry, UserProfile, ResolvedClaimStatus, MonthPayoutOverride, SalaryConfig, CloudUserData } from '../types';
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

// Konfiguration aus Vite-Environment (import.meta.env), window.__APP_CONFIG__ oder Runtime-Globals
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
    // Geräuschlos abfangen, damit niemals ein roter Fehler im UI aufpoppt
    firebaseInitialized = false;
  }
}

// Sichere Initialisierung
initFirebase();

function parseCloudUserData(data: any): CloudUserData {
  let shifts: ShiftEntry[] = [];
  if (typeof data.arbeitszeiten === 'string') {
    try {
      shifts = JSON.parse(data.arbeitszeiten);
    } catch {
      shifts = [];
    }
  } else if (Array.isArray(data.arbeitszeiten)) {
    shifts = data.arbeitszeiten;
  }

  const profile: Partial<UserProfile> = {};
  if (data.ma_name) profile.name = data.ma_name;
  if (data.ma_vorname) profile.vorname = data.ma_vorname;
  if (data.ma_personalnummer) profile.personalnummer = data.ma_personalnummer;
  if (data.abteilung) profile.abteilung = data.abteilung;
  if (data.klinik) profile.klinik = data.klinik;

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

  return {
    shifts,
    profile,
    resolvedClaims,
    payoutOverrides,
    salaryConfig,
    lastUpdated: data.lastUpdated
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

  async loadUserData(uid: string, vaultPassphrase?: string): Promise<CloudUserData | null> {
    if (!db || !uid) return null;
    try {
      const userRef = doc(db, 'users', uid);
      const snapshot = await getDoc(userRef);
      if (!snapshot.exists()) return null;

      const data = snapshot.data();

      // Prüfen, ob AES-256-GCM verschlüsselt
      if (data.isEncrypted && data.encryptedPayload) {
        try {
          const decrypted = await vaultService.decryptData<CloudUserData>(data.encryptedPayload, vaultPassphrase);
          return decrypted;
        } catch {
          console.warn("Konnte Cloud-Daten nicht entschlüsseln (PIN/Schlüssel abweichend).");
          return null;
        }
      }

      return parseCloudUserData(data);
    } catch {
      return null;
    }
  },

  async saveUserData(
    uid: string,
    shifts: ShiftEntry[],
    profile: UserProfile,
    resolvedClaims: Record<string, ResolvedClaimStatus> = {},
    payoutOverrides: Record<string, MonthPayoutOverride> = {},
    salaryConfig?: SalaryConfig,
    vaultPassphrase?: string
  ): Promise<void> {
    if (!db || !uid) return;
    try {
      const userRef = doc(db, 'users', uid);

      const rawData: CloudUserData = {
        shifts,
        profile,
        resolvedClaims,
        payoutOverrides,
        salaryConfig
      };

      // AES-256-GCM verschlüsseln, bevor Daten in die Cloud wandern
      const encryptedPayload = await vaultService.encryptData(rawData, vaultPassphrase);

      await setDoc(userRef, {
        isEncrypted: true,
        encryptedPayload,
        clientVersion: '3.1.2',
        updatedAt: new Date().toISOString(),
        lastUpdated: serverTimestamp()
      }, { merge: true });
    } catch {
      // Geräuschlos abfangen bei Netzwerkunterbrechung
    }
  },

  subscribeUserData(
    uid: string,
    callback: (data: CloudUserData) => void,
    vaultPassphrase?: string
  ): () => void {
    if (!db || !uid) return () => {};
    try {
      const userRef = doc(db, 'users', uid);
      return onSnapshot(userRef, async (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();

        if (data.isEncrypted && data.encryptedPayload) {
          try {
            const decrypted = await vaultService.decryptData<CloudUserData>(data.encryptedPayload, vaultPassphrase);
            callback(decrypted);
          } catch {}
          return;
        }

        callback(parseCloudUserData(data));
      }, () => {});
    } catch {
      return () => {};
    }
  }
};

export { isMohammad, MOHAMMAD_EMAIL };
