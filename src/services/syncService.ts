import { SyncPackage } from '../types';
import { storageService } from './storageService';
import { vaultService } from './vaultService';

const SYNC_PREFIX = 'ZEIT_SYNC_V1:';

export const syncService = {
  /**
   * Erzeugt ein AES-256-GCM verschlüsseltes Sync-Paket für den geräteübergreifenden Transfer (PC ↔ Handy)
   */
  async createSyncToken(pin?: string): Promise<string> {
    const session = storageService.getActiveSession();
    if (!session) {
      throw new Error('Kein aktiver Benutzer angemeldet.');
    }

    const payload: SyncPackage = {
      version: '3.1.2',
      timestamp: new Date().toISOString(),
      userId: session.id,
      userProfile: storageService.getProfile(),
      salaryConfig: storageService.getSalaryConfig(),
      presets: storageService.getPresets(),
      shifts: storageService.getShifts(),
      payoutOverrides: storageService.getPayoutOverrides(),
      resolvedClaims: storageService.getResolvedClaims()
    };

    const encrypted = await vaultService.encryptData(payload, pin);
    const jsonStr = JSON.stringify(encrypted);
    const b64 = window.btoa(unescape(encodeURIComponent(jsonStr)));
    return `${SYNC_PREFIX}${b64}`;
  },

  /**
   * Importiert ein AES-256-GCM verschlüsseltes Sync-Paket und wendet es auf das aktuelle Profil an
   */
  async applySyncToken(token: string, pin: string): Promise<{ success: boolean; shiftCount: number; message: string }> {
    const session = storageService.getActiveSession();
    if (!session) {
      throw new Error('Bitte melde dich zuerst an, um Daten zu synchronisieren.');
    }

    let cleanToken = token.trim();
    if (cleanToken.startsWith(SYNC_PREFIX)) {
      cleanToken = cleanToken.slice(SYNC_PREFIX.length);
    }

    try {
      const jsonStr = decodeURIComponent(escape(window.atob(cleanToken)));
      const encryptedPayload = JSON.parse(jsonStr);

      const syncData = await vaultService.decryptData<SyncPackage>(encryptedPayload, pin);

      if (!syncData || !Array.isArray(syncData.shifts)) {
        throw new Error('Ungültiges Datenformat im Sync-Paket.');
      }

      // Daten in den Scoped Storage des aktuellen Benutzers einspielen
      if (syncData.userProfile && (syncData.userProfile.name || syncData.userProfile.vorname)) {
        storageService.saveProfile(syncData.userProfile);
      }
      if (syncData.salaryConfig) {
        storageService.saveSalaryConfig(syncData.salaryConfig);
      }
      if (syncData.presets && Array.isArray(syncData.presets)) {
        storageService.savePresets(syncData.presets);
      }
      if (syncData.shifts) {
        storageService.saveShifts(syncData.shifts);
      }
      if (syncData.payoutOverrides) {
        storageService.saveAllPayoutOverrides(syncData.payoutOverrides);
      }
      if (syncData.resolvedClaims) {
        storageService.saveAllResolvedClaims(syncData.resolvedClaims);
      }

      storageService.setUserOnboarded(true, session.id);

      return {
        success: true,
        shiftCount: syncData.shifts.length,
        message: `Erfolgreich ${syncData.shifts.length} Schichten und Einstellungen synchronisiert!`
      };
    } catch (err: any) {
      return {
        success: false,
        shiftCount: 0,
        message: err.message || 'Entschlüsselung fehlgeschlagen. Bitte prüfe deine PIN.'
      };
    }
  }
};
