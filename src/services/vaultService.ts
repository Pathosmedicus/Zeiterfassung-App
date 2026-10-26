import { ShiftEntry, UserProfile, OpenClaimItem, ClinicPayrollRecord } from '../types';
import { ENCRYPTED_VAULT_SEED, EncryptedVaultPayload } from './encryptedVaultSeed';

export const MOHAMMAD_EMAIL = 'mohammadmattar1971@gmail.com';
const DEFAULT_PASS: string = '1971';
const VAULT_AUTH_STORAGE_KEY = 'zeiterfassung_vault_auth_v1';
const VAULT_CUSTOM_PIN_KEY = 'zeiterfassung_vault_custom_pin_v1';

export function isMohammad(idOrEmail?: string | null): boolean {
  if (!idOrEmail) return false;
  const s = idOrEmail.toLowerCase().trim();
  return s === MOHAMMAD_EMAIL.toLowerCase() || s === 'mohammad' || s.includes('mohammadmattar1971');
}

// Helper für Base64 Kodierung/Dekodierung im Browser
function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface DecryptedSeedResult {
  shifts: ShiftEntry[];
  payrollRecords: ClinicPayrollRecord[];
  claims: OpenClaimItem[];
  profile: UserProfile;
}

export const vaultService = {
  getDefaultPass(): string {
    const custom = localStorage.getItem(VAULT_CUSTOM_PIN_KEY);
    return custom || DEFAULT_PASS;
  },

  setCustomPin(newPin: string): void {
    if (!newPin || newPin.trim().length < 4) {
      throw new Error("Der Master-PIN / das Passwort muss mindestens 4 Zeichen lang sein.");
    }
    localStorage.setItem(VAULT_CUSTOM_PIN_KEY, newPin.trim());
  },

  hasStoredSession(): boolean {
    return localStorage.getItem(VAULT_AUTH_STORAGE_KEY) === 'unlocked' || sessionStorage.getItem(VAULT_AUTH_STORAGE_KEY) === 'unlocked';
  },

  setStoredSession(remember: boolean): void {
    if (remember) {
      localStorage.setItem(VAULT_AUTH_STORAGE_KEY, 'unlocked');
    } else {
      sessionStorage.setItem(VAULT_AUTH_STORAGE_KEY, 'unlocked');
    }
  },

  clearSession(): void {
    localStorage.removeItem(VAULT_AUTH_STORAGE_KEY);
    sessionStorage.removeItem(VAULT_AUTH_STORAGE_KEY);
  },

  async deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as any,
        iterations: 100000,
        hash: 'SHA-256'
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  async encryptData<T>(data: T, passphrase?: string): Promise<EncryptedVaultPayload> {
    const pass = passphrase || this.getDefaultPass();
    const enc = new TextEncoder();
    const jsonStr = JSON.stringify(data);

    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const key = await this.deriveKey(pass, salt);

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as any },
      key,
      enc.encode(jsonStr)
    );

    return {
      version: 'v1-aes256gcm',
      salt: bufferToBase64(salt),
      iv: bufferToBase64(iv),
      ciphertext: bufferToBase64(ciphertextBuffer)
    };
  },

  async decryptData<T>(payloadOrJson: EncryptedVaultPayload | string, passphrase?: string): Promise<T> {
    const pass = passphrase || this.getDefaultPass();
    const payload: EncryptedVaultPayload = typeof payloadOrJson === 'string' ? JSON.parse(payloadOrJson) : payloadOrJson;

    const salt = base64ToUint8(payload.salt);
    const iv = base64ToUint8(payload.iv);
    const ciphertext = base64ToUint8(payload.ciphertext);

    const key = await this.deriveKey(pass, salt);

    try {
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as any },
        key,
        ciphertext as any
      );

      const jsonStr = new TextDecoder().decode(decryptedBuffer);
      return JSON.parse(jsonStr) as T;
    } catch {
      throw new Error("Ungültiger Tresor-Schlüssel / Master-PIN oder Daten beschädigt.");
    }
  },

  async setUserPin(userId: string, pin: string): Promise<void> {
    if (!pin || pin.trim().length < 4) {
      throw new Error("Die PIN muss mindestens 4 Zeichen lang sein.");
    }
    const cleanId = userId.toLowerCase().trim();
    // Verschlüssele ein Prüftoken
    const token = await this.encryptData({ userId: cleanId, verified: true, ts: Date.now() }, pin.trim());
    localStorage.setItem(`usr_${cleanId.replace(/[^a-z0-9_-]/g, '_')}_pin_v1`, JSON.stringify(token));
  },

  async verifyUserPin(userId: string, pin: string): Promise<boolean> {
    const cleanId = userId.toLowerCase().trim();
    // 1. Wenn es Mohammad ist: Master-PIN testen
    if (isMohammad(cleanId)) {
      try {
        await this.decryptData(ENCRYPTED_VAULT_SEED, pin);
        return true;
      } catch {
        const custom = localStorage.getItem(VAULT_CUSTOM_PIN_KEY);
        if (custom && custom === pin) return true;
        return false;
      }
    }

    // 2. Kollege: Prüftoken auslesen
    const tokenRaw = localStorage.getItem(`usr_${cleanId.replace(/[^a-z0-9_-]/g, '_')}_pin_v1`);
    if (!tokenRaw) {
      // Wenn noch keine PIN hinterlegt war (z.B. erster Start), initialisiere sie
      await this.setUserPin(cleanId, pin);
      return true;
    }

    try {
      const token = JSON.parse(tokenRaw);
      const dec = await this.decryptData<{ userId: string }>(token, pin);
      return dec && dec.userId === cleanId;
    } catch {
      return false;
    }
  },

  async verifyPin(pin: string): Promise<boolean> {
    // Standard-Prüfung gegen Mohammad-Seed
    return this.verifyUserPin(MOHAMMAD_EMAIL, pin);
  },

  async unlockSeed(passphrase?: string): Promise<DecryptedSeedResult> {
    const pass = passphrase || this.getDefaultPass();
    return await this.decryptData<DecryptedSeedResult>(ENCRYPTED_VAULT_SEED, pass);
  }
};
