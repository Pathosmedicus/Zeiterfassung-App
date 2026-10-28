/**
 * WebAuthn Service für Biometrischen Login (Touch ID, Face ID, Windows Hello, Fingerabdruck)
 * Ermöglicht sekundenschnelles Entsperren der PWA ohne Passwort-/PIN-Eingabe.
 */

const STORAGE_KEY_CRED_ID = 'zeiterfassung_biometric_cred_v1';
const STORAGE_KEY_USER_ID = 'zeiterfassung_biometric_user_id_v1';
const STORAGE_KEY_USER_NAME = 'zeiterfassung_biometric_user_name_v1';

// Helper für Base64URL-Konvertierung
function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export const webAuthnService = {
  /**
   * Prüft, ob der Browser WebAuthn unterstützt.
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' && Boolean(window.PublicKeyCredential);
  },

  /**
   * Prüft, ob ein plattformbasierter Biometrie-Sensor (Touch ID, Face ID, Fingerabdruck) verfügbar ist.
   */
  async isPlatformAuthenticatorAvailable(): Promise<boolean> {
    if (!this.isSupported()) return false;
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
      return false;
    }
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  },

  /**
   * Prüft, ob auf diesem Gerät bereits ein biometrischer Schlüssel hinterlegt ist.
   */
  hasRegisteredBiometrics(): boolean {
    return Boolean(localStorage.getItem(STORAGE_KEY_CRED_ID) && localStorage.getItem(STORAGE_KEY_USER_ID));
  },

  /**
   * Gibt den Benutzernamen des für Biometrie registrierten Nutzers zurück.
   */
  getRegisteredUser(): { userId: string; userName: string } | null {
    const userId = localStorage.getItem(STORAGE_KEY_USER_ID);
    const userName = localStorage.getItem(STORAGE_KEY_USER_NAME) || userId;
    if (!userId) return null;
    return { userId, userName: userName || userId };
  },

  /**
   * Registriert Biometrie (Touch ID / Face ID / Windows Hello) für das aktuelle Benutzerkonto.
   */
  async registerBiometrics(userId: string, userName: string = ''): Promise<{ success: boolean; message?: string }> {
    if (!this.isSupported()) {
      return { success: false, message: 'WebAuthn wird von diesem Browser nicht unterstützt.' };
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userBytes = new TextEncoder().encode(userId);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'Zeiterfassung Radiologie',
            id: window.location.hostname
          },
          user: {
            id: userBytes,
            name: userId,
            displayName: userName || userId
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },  // ES256
            { type: 'public-key', alg: -257 } // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred'
          },
          timeout: 60000
        }
      }) as PublicKeyCredential | null;

      if (!credential || !credential.id) {
        return { success: false, message: 'Registrierung abgebrochen.' };
      }

      localStorage.setItem(STORAGE_KEY_CRED_ID, credential.id);
      localStorage.setItem(STORAGE_KEY_USER_ID, userId);
      localStorage.setItem(STORAGE_KEY_USER_NAME, userName || userId);

      return { success: true };
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        return { success: false, message: 'Biometrie-Einrichtung vom Nutzer abgebrochen.' };
      }
      return { success: false, message: err.message || 'Biometrie konnte nicht eingerichtet werden.' };
    }
  },

  /**
   * Entsperrt die App per Biometrie (Touch ID / Face ID / Fingerabdruck).
   */
  async authenticate(): Promise<{ success: boolean; userId?: string; userName?: string; message?: string }> {
    if (!this.isSupported()) {
      return { success: false, message: 'Biometrie nicht unterstützt.' };
    }

    const reg = this.getRegisteredUser();
    const credId = localStorage.getItem(STORAGE_KEY_CRED_ID);
    if (!reg || !credId) {
      return { success: false, message: 'Noch kein biometrischer Zugang auf diesem Gerät eingerichtet.' };
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const allowCredentials: PublicKeyCredentialDescriptor[] = [
        {
          id: base64urlToBuffer(credId),
          type: 'public-key',
          transports: ['internal']
        }
      ];

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          userVerification: 'required',
          timeout: 60000,
          allowCredentials
        }
      });

      if (assertion) {
        return {
          success: true,
          userId: reg.userId,
          userName: reg.userName
        };
      }
      return { success: false, message: 'Authentifizierung fehlgeschlagen.' };
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        return { success: false, message: 'Biometrische Prüfung abgebrochen.' };
      }
      return { success: false, message: err.message || 'Authentifizierung fehlgeschlagen.' };
    }
  },

  /**
   * Entfernt hinterlegte Biometrie-Schlüssel.
   */
  clearBiometrics(): void {
    localStorage.removeItem(STORAGE_KEY_CRED_ID);
    localStorage.removeItem(STORAGE_KEY_USER_ID);
    localStorage.removeItem(STORAGE_KEY_USER_NAME);
  }
};
