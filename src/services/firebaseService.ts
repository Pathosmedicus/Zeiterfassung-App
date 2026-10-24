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

// Konfiguration aus Vite-Environment (import.meta.env), window.__APP_CONFIG__ oder Runtime-Globals
const getFirebaseConfig = () => {
  const custom = (window as any).__APP_CONFIG__?.firebase;
  if (custom && custom.apiKey) return custom;

  const env = (import.meta as any).env || {};

  const apiKey = env.VITE_FIREBASE_API_KEY || (window as any).ENV_FIREBASE_API_KEY || "";
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN || (window as any).ENV_FIREBASE_AUTH_DOMAIN || "";
  const projectId = env.VITE_FIREBASE_PROJECT_ID || (window as any).ENV_FIREBASE_PROJECT_ID || "";
  const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET || (window as any).ENV_FIREBASE_STORAGE_BUCKET || "";
  const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID || (window as any).ENV_FIREBASE_MESSAGING_SENDER_ID || "";
  const appId = env.VITE_FIREBASE_APP_ID || (window as any).ENV_FIREBASE_APP_ID || "";

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
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

try {
  const config = getFirebaseConfig();
  if (config && config.apiKey) {
    app = getApps().length > 0 ? getApp() : initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    setPersistence(auth, browserLocalPersistence).catch(console.warn);
  }
} catch (err) {
  console.warn("Firebase Initialisierung übersprungen oder fehlgeschlagen:", err);
}

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
  getAuthInstance(): Auth | undefined {
    return auth;
  },

  getCurrentUser(): User | null {
    return auth?.currentUser || null;
  },

  onAuthChanged(callback: (user: User | null) => void): () => void {
    if (!auth) {
      callback(null);
      return () => {};
    }
    return onAuthStateChanged(auth, callback);
  },

  async loginWithGoogle(): Promise<User> {
    if (!auth) throw new Error("Firebase Auth nicht initialisiert");
    try {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, provider);
        throw new Error("Popup blockiert – Weiterleitung initiiert.");
      }
      throw err;
    }
  },

  async logout(): Promise<void> {
    if (auth) {
      await signOut(auth);
    }
  },

  async loadUserData(uid: string): Promise<CloudUserData | null> {
    if (!db || !uid) return null;
    try {
      const userRef = doc(db, 'users', uid);
      const snapshot = await getDoc(userRef);
      if (!snapshot.exists()) return null;

      return parseCloudUserData(snapshot.data());
    } catch (err) {
      console.warn("Fehler beim Laden der Cloud-Daten:", err);
      return null;
    }
  },

  async saveUserData(
    uid: string,
    shifts: ShiftEntry[],
    profile: UserProfile,
    resolvedClaims?: Record<string, ResolvedClaimStatus>,
    payoutOverrides?: Record<string, MonthPayoutOverride>,
    salaryConfig?: SalaryConfig
  ): Promise<void> {
    if (!db || !uid) return;
    try {
      const userRef = doc(db, 'users', uid);
      const payload: any = {
        arbeitszeiten: JSON.stringify(shifts),
        ma_name: profile.name,
        ma_vorname: profile.vorname,
        ma_personalnummer: profile.personalnummer,
        lastUpdated: serverTimestamp()
      };
      if (resolvedClaims) {
        payload.resolvedClaims = resolvedClaims;
        payload.resolvedClaimsJson = JSON.stringify(resolvedClaims);
      }
      if (payoutOverrides) {
        payload.payoutOverrides = payoutOverrides;
        payload.payoutOverridesJson = JSON.stringify(payoutOverrides);
      }
      if (salaryConfig) {
        payload.salaryConfig = salaryConfig;
        payload.salaryConfigJson = JSON.stringify(salaryConfig);
      }
      await setDoc(userRef, payload, { merge: true });
    } catch (err) {
      console.error("Fehler beim Cloud-Speichern:", err);
      throw err;
    }
  },

  subscribeUserData(uid: string, callback: (data: CloudUserData) => void): () => void {
    if (!db || !uid) return () => {};
    try {
      const userRef = doc(db, 'users', uid);
      const unsubscribe = onSnapshot(userRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const parsed = parseCloudUserData(snapshot.data());
        callback(parsed);
      }, (err) => {
        console.warn("Firestore Realtime-Sync Fehler:", err);
      });
      return unsubscribe;
    } catch (err) {
      console.warn("Fehler beim Erstellen des Realtime-Listeners:", err);
      return () => {};
    }
  }
};

