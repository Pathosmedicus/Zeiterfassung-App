import {
  ShiftEntry,
  UserProfile,
  PresetShift,
  SalaryConfig,
  AppBackup,
  MonthPayoutOverride,
  ResolvedClaimStatus,
  AppUserSession
} from '../types';

export const DEFAULT_USER_PROFILE: UserProfile = {
  name: '',
  vorname: '',
  personalnummer: '',
  abteilung: 'Radiologie',
  klinik: 'Klinikum'
};

export const DEFAULT_PRESETS: PresetShift[] = [
  {
    id: 'fruh',
    name: 'Frühdienst',
    icon: '☀️',
    kommen: '07:30',
    gehen: '16:00',
    pauseMinuten: 30,
    description: '07:30 – 16:00 (8,0 h)'
  },
  {
    id: 'spat',
    name: 'Spätdienst',
    icon: '🌙',
    kommen: '13:30',
    gehen: '22:00',
    pauseMinuten: 30,
    description: '13:30 – 22:00 (8,0 h)'
  },
  {
    id: 'kurz',
    name: 'Kurzdienst',
    icon: '⚡',
    kommen: '08:00',
    gehen: '14:00',
    pauseMinuten: 0,
    description: '08:00 – 14:00 (6,0 h)'
  },
  {
    id: 'nacht',
    name: 'Nachtdienst',
    icon: '🦉',
    kommen: '20:00',
    gehen: '08:00',
    pauseMinuten: 60,
    description: '20:00 – 08:00 (11,0 h)'
  },
  {
    id: 'ruf',
    name: 'Rufbereitschaft',
    icon: '📞',
    kommen: '16:00',
    gehen: '20:00',
    pauseMinuten: 0,
    description: '16:00 – 20:00 (4,0 h)'
  }
];

export const DEFAULT_HISTORICAL_SHIFTS: ShiftEntry[] = [];

export const DEFAULT_SALARY_CONFIG: SalaryConfig = {
  baseOld: 17.16,
  baseMid: 17.64,
  baseNew: 18.90,
  baseHours: 5.00,
  vblPercent: 1.81,
  minijobLimit: 603,
  annualLimit: 7230,
  sunRateOld: 4.67,
  sunRateNew: 4.80,
  satRate: 0.64,
  nightRate: 3.74,
  cutoffYear: 2026,
  cutoffMonth: 8,
  sunPercent: 27.21,
  satPercent: 3.73
};

const GLOBAL_KEYS = {
  ACTIVE_SESSION: 'zeiterfassung_active_session_v3',
  USERS_INDEX: 'zeiterfassung_users_index_v3',
  THEME: 'zeiterfassung_theme_v3'
};

const LEGACY_KEYS = {
  SHIFTS: 'zeiterfassung_shifts_v3',
  PROFILE: 'zeiterfassung_profile_v3',
  PRESETS: 'zeiterfassung_presets_v3',
  SALARY: 'zeiterfassung_salary_v3',
  PAYOUT_OVERRIDES: 'zeiterfassung_payout_overrides_v3',
  RESOLVED_CLAIMS: 'zeiterfassung_resolved_claims_v3',
  OLD_SHIFTS: 'meine_arbeitszeiten',
  OLD_NAME: 'ma_name',
  OLD_VORNAME: 'ma_vorname',
  OLD_PNR: 'ma_personalnummer',
  OLD_LOHN: 'lohn_config_v2'
};

let activeUserId: string | null = null;
let activeSession: AppUserSession | null = null;

// Initialer Ladeversuch der aktiven Sitzung
try {
  const sessionRaw = localStorage.getItem(GLOBAL_KEYS.ACTIVE_SESSION);
  if (sessionRaw) {
    activeSession = JSON.parse(sessionRaw);
    activeUserId = activeSession?.email || activeSession?.id || null;
  }
} catch {
  activeSession = null;
  activeUserId = null;
}

export function normalizeEmail(emailOrId?: string | null): string {
  if (!emailOrId) return 'anon';
  return emailOrId.toLowerCase().trim();
}

/**
 * Regel 1: Striktes Präfix zeiterfassung_v2_${email}_ pro Account
 */
function getUserKey(baseKey: string, customUserId?: string): string {
  const target = customUserId || activeSession?.email || activeUserId || '';
  const norm = normalizeEmail(target);
  return `zeiterfassung_v2_${norm}_${baseKey}`;
}

/**
 * Regel 5: Automatische Ermittlung des passenden Start-Monats
 * Springt auf den neuesten Schichtmonat (z. B. 2026-10) statt auf einen statischen alten Monat
 */
export function determineInitialMonth(shifts: ShiftEntry[]): string {
  const currentCalendarMonth = new Date().toISOString().substring(0, 7);

  if (!shifts || shifts.length === 0) {
    return currentCalendarMonth;
  }

  const shiftMonths = Array.from(
    new Set(shifts.map(s => s.datum?.substring(0, 7)).filter(Boolean))
  ).sort();

  if (shiftMonths.length === 0) {
    return currentCalendarMonth;
  }

  // Falls der aktuelle Kalendermonat Schichten hat, nimm diesen
  if (shiftMonths.includes(currentCalendarMonth)) {
    return currentCalendarMonth;
  }

  // Ansonsten den neuesten Monat mit Schichten (z. B. 2026-10)
  return shiftMonths[shiftMonths.length - 1];
}

/**
 * Strikte 1-Schicht-pro-Tag Deduplizierung:
 * Garantiert, dass am selben Datum (YYYY-MM-DD) niemals doppelte Dienste existieren.
 */
export function deduplicateShifts(shifts: ShiftEntry[]): ShiftEntry[] {
  if (!shifts || shifts.length === 0) return [];
  const dayMap = new Map<string, ShiftEntry>();

  for (const s of shifts) {
    if (!s || !s.datum) continue;
    const existing = dayMap.get(s.datum);
    if (!existing) {
      dayMap.set(s.datum, s);
      continue;
    }

    // 1. Wenn eine Schicht >0h hat und die andere 0h, gewinnt die mit >0h
    if (s.nettoStunden > 0 && (!existing.nettoStunden || existing.nettoStunden === 0)) {
      dayMap.set(s.datum, s);
      continue;
    }
    if (existing.nettoStunden > 0 && (!s.nettoStunden || s.nettoStunden === 0)) {
      continue;
    }

    // 2. Zeitstempel updatedAt vergleichen (neuerer gewinnt)
    const tNew = s.updatedAt ? new Date(s.updatedAt).getTime() : 0;
    const tOld = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
    if (tNew > tOld) {
      dayMap.set(s.datum, s);
      continue;
    }
    if (tOld > tNew) {
      continue;
    }

    // 3. Wenn Zeitstempel identisch: vollständigerer Eintrag gewinnt
    const newScore = (s.kommen ? 1 : 0) + (s.gehen ? 1 : 0) + (s.notiz ? 1 : 0) + (s.schichtTyp ? 1 : 0);
    const oldScore = (existing.kommen ? 1 : 0) + (existing.gehen ? 1 : 0) + (existing.notiz ? 1 : 0) + (existing.schichtTyp ? 1 : 0);
    if (newScore >= oldScore) {
      dayMap.set(s.datum, s);
    }
  }

  return Array.from(dayMap.values()).sort((a, b) => a.datum.localeCompare(b.datum));
}

export const storageService = {
  // --- SITZUNGSVERWALTUNG (MULTI-USER ISOLATION) ---

  getActiveSession(): AppUserSession | null {
    if (activeSession) return activeSession;
    try {
      const raw = localStorage.getItem(GLOBAL_KEYS.ACTIVE_SESSION);
      if (raw) {
        activeSession = JSON.parse(raw);
        activeUserId = activeSession?.email || activeSession?.id || null;
        return activeSession;
      }
    } catch {}
    return null;
  },

  setActiveSession(session: AppUserSession): void {
    activeSession = session;
    activeUserId = session.email || session.id;
    try {
      localStorage.setItem(GLOBAL_KEYS.ACTIVE_SESSION, JSON.stringify(session));
      this.registerUserInIndex(session);

      // Regel 3: Nur wenn Mohammad sich anmeldet, Altdaten migrieren
      if (this.isMohammadUser(session.email || session.id)) {
        this.migrateMohammadLegacyIfPresent();
      }
    } catch (e) {
      console.warn('Fehler beim Speichern der aktiven Sitzung:', e);
    }
  },

  /**
   * Regel 1: Beim Logout wird NUR die Sitzung im Speicher geleert, NIEMALS Daten gelöscht!
   */
  clearActiveSession(): void {
    activeSession = null;
    activeUserId = null;
    try {
      localStorage.removeItem(GLOBAL_KEYS.ACTIVE_SESSION);
    } catch {}
  },

  switchUser(userIdOrEmail: string): void {
    activeUserId = userIdOrEmail ? normalizeEmail(userIdOrEmail) : null;
  },

  migrateLegacyMohammadDataIfNeeded(emailOrId?: string): void {
    if (this.isMohammadUser(emailOrId || activeUserId)) {
      this.migrateMohammadLegacyIfPresent();
    }
  },

  determineInitialMonth(shifts?: ShiftEntry[]): string {
    const list = shifts || this.getShifts();
    if (list && list.length > 0) {
      const validMonths = list
        .map(s => s.datum ? s.datum.substring(0, 7) : '')
        .filter(m => /^\d{4}-\d{2}$/.test(m));
      if (validMonths.length > 0) {
        validMonths.sort((a, b) => b.localeCompare(a));
        return validMonths[0];
      }
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  },

  isMohammadUser(userIdOrEmail?: string | null): boolean {
    const id = normalizeEmail(userIdOrEmail || activeSession?.email || activeUserId);
    return id === 'mohammadmattar1971@gmail.com' || id === 'mohammad';
  },

  getRegisteredUsers(): AppUserSession[] {
    try {
      const raw = localStorage.getItem(GLOBAL_KEYS.USERS_INDEX);
      if (raw) return JSON.parse(raw);
      return [];
    } catch {
      return [];
    }
  },

  registerUserInIndex(user: AppUserSession): void {
    try {
      const users = this.getRegisteredUsers();
      const existingIdx = users.findIndex(u =>
        normalizeEmail(u.email || u.id) === normalizeEmail(user.email || user.id)
      );
      const updatedUser: AppUserSession = {
        ...user,
        lastLogin: new Date().toISOString()
      };
      if (existingIdx >= 0) {
        users[existingIdx] = { ...users[existingIdx], ...updatedUser };
      } else {
        users.push(updatedUser);
      }
      localStorage.setItem(GLOBAL_KEYS.USERS_INDEX, JSON.stringify(users));
    } catch (e) {
      console.warn('Konnte User-Index nicht aktualisieren:', e);
    }
  },

  removeUserFromIndex(userId: string): void {
    try {
      const users = this.getRegisteredUsers().filter(u =>
        normalizeEmail(u.email || u.id) !== normalizeEmail(userId)
      );
      localStorage.setItem(GLOBAL_KEYS.USERS_INDEX, JSON.stringify(users));
    } catch {}
  },

  isUserOnboarded(userId?: string): boolean {
    const uid = userId || activeSession?.email || activeUserId;
    if (!uid) return false;
    // Mohammad ist standardmäßig onboarded
    if (this.isMohammadUser(uid)) return true;
    return localStorage.getItem(getUserKey('onboarded', uid)) === 'true';
  },

  setUserOnboarded(onboarded: boolean = true, userId?: string): void {
    const uid = userId || activeSession?.email || activeUserId;
    if (!uid) return;
    localStorage.setItem(getUserKey('onboarded', uid), onboarded ? 'true' : 'false');
  },

  /**
   * Regel 3: Alte Legacy-Keys aus vorherigen Versionen restlos löschen,
   * damit alte oder gelöschte Schichten niemals wieder als Zombies auferstehen!
   */
  purgeLegacyKeys(): void {
    const keysToRemove = [
      'zeiterfassung_shifts_v3',
      'meine_arbeitszeiten',
      'usr_mohammadmattar1971_gmail_com_shifts_v3',
      'usr_mohammadmattar1971_gmail_com_profile_v3',
      'usr_mohammadmattar1971_gmail_com_payout_overrides_v3',
      'usr_mohammadmattar1971_gmail_com_resolved_claims_v3',
      'zeiterfassung_user_profile_v3',
      'zeiterfassung_payout_overrides_v3',
      'zeiterfassung_resolved_claims_v3',
      'ma_name',
      'ma_vorname',
      'ma_personalnummer'
    ];
    for (const k of keysToRemove) {
      try {
        localStorage.removeItem(k);
      } catch {}
    }
  },

  migrateMohammadLegacyIfPresent(): void {
    // Altdaten-Migration dauerhaft ABGESCHALTET! Veraltete Keys bereinigen
    this.purgeLegacyKeys();
  },

  // --- STAMMDATEN & PROFIL (USER SCOPED) ---

  getProfile(): UserProfile {
    if (!activeUserId) return DEFAULT_USER_PROFILE;
    try {
      const stored = localStorage.getItem(getUserKey('profile'));
      if (stored) return { ...DEFAULT_USER_PROFILE, ...JSON.parse(stored) };
      return DEFAULT_USER_PROFILE;
    } catch {
      return DEFAULT_USER_PROFILE;
    }
  },

  saveProfile(profile: UserProfile): void {
    if (!activeUserId) return;
    localStorage.setItem(getUserKey('profile'), JSON.stringify(profile));
  },

  hasSavedShifts(): boolean {
    if (!activeUserId) return false;
    const raw = localStorage.getItem(getUserKey('shifts'));
    if (!raw || raw === '[]') return false;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  },

  importDecryptedSeed(shifts: ShiftEntry[], profile?: UserProfile): void {
    if (!activeUserId) return;
    if (!this.isMohammadUser()) {
      console.warn('Seed-Import für Nicht-Owner abgewiesen (Datenschutz).');
      return;
    }
    // Nur importieren, wenn der Nutzer tatsächlich noch gar keine Schichten besitzt
    if (!this.hasSavedShifts() && shifts && shifts.length > 0) {
      this.saveShifts(shifts);
    }
    if (profile && (profile.name || profile.vorname)) {
      this.saveProfile(profile);
    }
  },

  // --- TOMBSTONES FÜR GELÖSCHTE SCHICHTEN (ZERO ZOMBIES) ---

  getDeletedShifts(): Record<string, { datum: string; deletedAt: string }> {
    if (!activeUserId) return {};
    try {
      const raw = localStorage.getItem(getUserKey('deleted_shifts'));
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  saveDeletedShifts(deletedMap: Record<string, { datum: string; deletedAt: string }>): void {
    if (!activeUserId) return;
    localStorage.setItem(getUserKey('deleted_shifts'), JSON.stringify(deletedMap));
  },

  markShiftDeleted(datum: string): Record<string, { datum: string; deletedAt: string }> {
    const deleted = this.getDeletedShifts();
    deleted[datum] = {
      datum,
      deletedAt: new Date().toISOString()
    };
    this.saveDeletedShifts(deleted);
    return deleted;
  },

  clearShiftDeleted(datum: string): void {
    const deleted = this.getDeletedShifts();
    if (deleted[datum]) {
      delete deleted[datum];
      this.saveDeletedShifts(deleted);
    }
  },

  // --- SCHICHTEN (USER SCOPED) & STRIKTE DEDUPLIZIERUNG PRO TAG ---

  getShifts(): ShiftEntry[] {
    if (!activeUserId) return [];
    try {
      const raw = localStorage.getItem(getUserKey('shifts'));
      if (!raw || raw === '[]') return [];
      const parsed: ShiftEntry[] = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      // Strikte Deduplizierung pro Tag durchführen (max 1 Eintrag pro Kalendertag)
      const deduplicated = deduplicateShifts(parsed);
      if (deduplicated.length !== parsed.length) {
        localStorage.setItem(getUserKey('shifts'), JSON.stringify(deduplicated));
      }
      return deduplicated;
    } catch (e) {
      console.warn('Fehler beim Laden der Schichten:', e);
      return [];
    }
  },

  saveShifts(shifts: ShiftEntry[]): void {
    if (!activeUserId) return;
    const nowIso = new Date().toISOString();
    const enriched = (shifts || []).map(s => ({
      ...s,
      updatedAt: s.updatedAt || nowIso
    }));
    // Strikte Deduplizierung pro Kalendertag (allgemeingültig für jeden Mitarbeiter)
    const deduplicated = deduplicateShifts(enriched);
    localStorage.setItem(getUserKey('shifts'), JSON.stringify(deduplicated));
  },

  upsertShift(newEntry: ShiftEntry): ShiftEntry[] {
    // Falls für dieses Datum ein Lösch-Tombstone existierte, entfernen
    this.clearShiftDeleted(newEntry.datum);

    const withTimestamp: ShiftEntry = {
      ...newEntry,
      updatedAt: new Date().toISOString()
    };
    const shifts = this.getShifts().filter(s => s.datum !== newEntry.datum);
    shifts.push(withTimestamp);
    this.saveShifts(shifts);
    return this.getShifts();
  },

  deleteShift(datum: string): ShiftEntry[] {
    // 1. Tombstone setzen
    this.markShiftDeleted(datum);

    // 2. Lokal entfernen und dedupliziert speichern
    const shifts = this.getShifts().filter(s => s.datum !== datum);
    this.saveShifts(shifts);
    return shifts;
  },

  cleanDuplicateShifts(): { cleanedCount: number; remainingShifts: ShiftEntry[] } {
    if (!activeUserId) return { cleanedCount: 0, remainingShifts: [] };
    const raw = this.getShifts();
    const deletedMap = this.getDeletedShifts();

    // 1. Entferne alle Dienste, die einen aktiven Lösch-Tombstone haben
    const withoutDeleted = raw.filter(s => {
      const tombstone = deletedMap[s.datum];
      if (!tombstone) return true;
      const tDel = new Date(tombstone.deletedAt).getTime();
      const tShift = s.updatedAt ? new Date(s.updatedAt).getTime() : 0;
      return tShift > tDel;
    });

    // 2. Strikte Deduplizierung pro Tag
    const deduplicated = deduplicateShifts(withoutDeleted);
    const cleanedCount = raw.length - deduplicated.length;

    this.saveShifts(deduplicated);
    return {
      cleanedCount: Math.max(0, cleanedCount),
      remainingShifts: deduplicated
    };
  },

  restoreCleanShifts(cleanShifts: ShiftEntry[]): ShiftEntry[] {
    if (!activeUserId) return [];
    this.saveDeletedShifts({});
    this.saveShifts(cleanShifts);
    return this.getShifts();
  },

  deleteMonth(yearMonth: string): ShiftEntry[] {
    const toDelete = this.getShifts().filter(s => s.datum.startsWith(yearMonth));
    for (const s of toDelete) {
      this.markShiftDeleted(s.datum);
    }
    const shifts = this.getShifts().filter(s => !s.datum.startsWith(yearMonth));
    this.saveShifts(shifts);
    return shifts;
  },

  // --- PRESETS (USER SCOPED) ---

  getPresets(): PresetShift[] {
    if (!activeUserId) return DEFAULT_PRESETS;
    try {
      const stored = localStorage.getItem(getUserKey('presets'));
      if (stored) return JSON.parse(stored);
      return DEFAULT_PRESETS;
    } catch {
      return DEFAULT_PRESETS;
    }
  },

  savePresets(presets: PresetShift[]): void {
    if (!activeUserId) return;
    localStorage.setItem(getUserKey('presets'), JSON.stringify(presets));
  },

  // --- TARIF & LOHNKONFIGURATION (USER SCOPED) ---

  getSalaryConfig(): SalaryConfig {
    if (!activeUserId) return DEFAULT_SALARY_CONFIG;
    try {
      const stored = localStorage.getItem(getUserKey('salary'));
      if (stored) return { ...DEFAULT_SALARY_CONFIG, ...JSON.parse(stored) };
      return DEFAULT_SALARY_CONFIG;
    } catch {
      return DEFAULT_SALARY_CONFIG;
    }
  },

  saveSalaryConfig(config: SalaryConfig): void {
    if (!activeUserId) return;
    localStorage.setItem(getUserKey('salary'), JSON.stringify(config));
  },

  // --- AUSZAHLUNGS-OVERRIDES & NACHFORERUNGEN (USER SCOPED) ---

  getPayoutOverrides(): Record<string, MonthPayoutOverride> {
    if (!activeUserId) return {};
    try {
      const stored = localStorage.getItem(getUserKey('payout_overrides'));
      if (stored) return JSON.parse(stored);
      return {};
    } catch {
      return {};
    }
  },

  savePayoutOverride(override: MonthPayoutOverride): Record<string, MonthPayoutOverride> {
    if (!activeUserId) return {};
    const current = this.getPayoutOverrides();
    current[override.yearMonth] = {
      ...current[override.yearMonth],
      ...override,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(getUserKey('payout_overrides'), JSON.stringify(current));
    return current;
  },

  deletePayoutOverride(yearMonth: string): Record<string, MonthPayoutOverride> {
    if (!activeUserId) return {};
    const current = this.getPayoutOverrides();
    delete current[yearMonth];
    localStorage.setItem(getUserKey('payout_overrides'), JSON.stringify(current));
    return current;
  },

  getResolvedClaims(): Record<string, ResolvedClaimStatus> {
    if (!activeUserId) return {};
    try {
      const stored = localStorage.getItem(getUserKey('resolved_claims'));
      if (stored) return JSON.parse(stored);
      return {};
    } catch {
      return {};
    }
  },

  setClaimResolved(claimId: string, isResolved: boolean): Record<string, ResolvedClaimStatus> {
    if (!activeUserId) return {};
    const current = this.getResolvedClaims();
    const now = new Date();
    const nowIso = now.toISOString();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
    current[claimId] = {
      isResolved,
      resolvedDate: isResolved ? (current[claimId]?.resolvedDate || dateStr) : undefined,
      updatedAt: nowIso,
      reopenedAt: !isResolved ? nowIso : undefined
    };
    localStorage.setItem(getUserKey('resolved_claims'), JSON.stringify(current));
    return current;
  },

  saveAllResolvedClaims(claims: Record<string, ResolvedClaimStatus>): Record<string, ResolvedClaimStatus> {
    if (!activeUserId) return claims;
    localStorage.setItem(getUserKey('resolved_claims'), JSON.stringify(claims));
    return claims;
  },

  saveAllPayoutOverrides(overrides: Record<string, MonthPayoutOverride>): Record<string, MonthPayoutOverride> {
    if (!activeUserId) return overrides;
    localStorage.setItem(getUserKey('payout_overrides'), JSON.stringify(overrides));
    return overrides;
  },

  // --- BACKUP & EXPORT/IMPORT (USER SCOPED) ---

  createBackup(): AppBackup {
    const profile = this.getProfile();
    const salary = this.getSalaryConfig();
    const presets = this.getPresets();
    const shifts = this.getShifts();
    const payoutOverrides = this.getPayoutOverrides();
    const resolvedClaims = this.getResolvedClaims();

    return {
      version: '3.2.0',
      timestamp: new Date().toISOString(),
      userProfile: profile,
      salaryConfig: salary,
      presets,
      shifts,
      payoutOverrides,
      resolvedClaims
    };
  },

  restoreBackup(backupJson: any): { success: boolean; shiftCount: number; message: string } {
    if (!activeUserId) {
      return { success: false, shiftCount: 0, message: 'Kein aktiver Benutzer angemeldet.' };
    }
    try {
      if (!backupJson || typeof backupJson !== 'object') {
        return { success: false, shiftCount: 0, message: 'Ungültiges JSON-Format' };
      }

      const importedShifts: ShiftEntry[] = Array.isArray(backupJson.shifts)
        ? backupJson.shifts
        : (Array.isArray(backupJson.meine_arbeitszeiten) ? backupJson.meine_arbeitszeiten : []);

      if (importedShifts.length === 0 && !backupJson.userProfile && !backupJson.ma_name) {
        return { success: false, shiftCount: 0, message: 'Keine gültigen Zeiterfassungsdaten in der Datei gefunden.' };
      }

      if (backupJson.userProfile) {
        this.saveProfile(backupJson.userProfile);
      }
      if (Array.isArray(backupJson.presets)) {
        this.savePresets(backupJson.presets);
      }
      if (backupJson.salaryConfig) {
        this.saveSalaryConfig(backupJson.salaryConfig);
      }
      if (importedShifts.length > 0) {
        this.saveShifts(importedShifts);
      }
      if (backupJson.payoutOverrides && typeof backupJson.payoutOverrides === 'object') {
        this.saveAllPayoutOverrides(backupJson.payoutOverrides);
      }
      if (backupJson.resolvedClaims && typeof backupJson.resolvedClaims === 'object') {
        this.saveAllResolvedClaims(backupJson.resolvedClaims);
      }

      return {
        success: true,
        shiftCount: importedShifts.length,
        message: `Erfolgreich ${importedShifts.length} Schichten und Einstellungen wiederhergestellt!`
      };
    } catch (err: any) {
      return { success: false, shiftCount: 0, message: err?.message || 'Fehler beim Wiederherstellen des Backups' };
    }
  },

  getEmailTemplate(): { recipient: string; subject: string; body: string } {
    const key = getUserKey('email_tpl');
    const raw = localStorage.getItem(key);
    if (raw) {
      try { return JSON.parse(raw); } catch {}
    }
    return {
      recipient: '',
      subject: 'Stundenübersicht {MONAT} {JAHR}',
      body: 'Sehr geehrte Damen und Herren,\n\nanbei sende ich Ihnen meine Stundenübersicht für den Monat {MONAT} {JAHR}.\n\nMit freundlichen Grüßen,\n{VORNAME} {NAME}'
    };
  },

  saveEmailTemplate(template: { recipient: string; subject: string; body: string }): void {
    if (!activeUserId) return;
    localStorage.setItem(getUserKey('email_tpl'), JSON.stringify(template));
  },

  getEmailHistory(): Array<{ id: string; zielMonat: string; datumGesendet: string }> {
    if (!activeUserId) return [];
    try {
      const raw = localStorage.getItem(getUserKey('email_history'));
      if (raw) return JSON.parse(raw);
      return [];
    } catch {
      return [];
    }
  },

  addEmailHistory(zielMonat: string): Array<{ id: string; zielMonat: string; datumGesendet: string }> {
    if (!activeUserId) return [];
    const list = this.getEmailHistory();
    const now = new Date();
    const dateFormatted = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()} um ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} Uhr`;
    list.unshift({
      id: `${Date.now()}`,
      zielMonat,
      datumGesendet: dateFormatted
    });
    if (list.length > 25) list.pop();
    localStorage.setItem(getUserKey('email_history'), JSON.stringify(list));
    return list;
  },

  clearEmailHistory(): void {
    if (!activeUserId) return;
    localStorage.removeItem(getUserKey('email_history'));
  }
};
