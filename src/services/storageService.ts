import { ShiftEntry, UserProfile, PresetShift, SalaryConfig, AppBackup, MonthPayoutOverride, ResolvedClaimStatus } from '../types';

export const DEFAULT_USER_PROFILE: UserProfile = {
  name: 'Mustermann',
  vorname: 'Max',
  personalnummer: '123456',
  abteilung: 'Radiologie & Nuklearmedizin',
  klinik: 'Universitätsklinikum'
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

export const DEFAULT_HISTORICAL_SHIFTS: ShiftEntry[] = [
  // 08/2025: 23.00h (5.00h So, 6.00h Sa)
  { datum: '2025-08-03', kommen: '11:00', gehen: '16:00', pauseMinuten: 0, nettoStunden: 5.00, schichtTyp: 'Sonntagsdienst' },
  { datum: '2025-08-09', kommen: '13:00', gehen: '19:00', pauseMinuten: 0, nettoStunden: 6.00, schichtTyp: 'Samstagsdienst' },
  { datum: '2025-08-15', kommen: '08:00', gehen: '14:00', pauseMinuten: 0, nettoStunden: 6.00, schichtTyp: 'Kurzdienst' },
  { datum: '2025-08-22', kommen: '08:00', gehen: '14:00', pauseMinuten: 0, nettoStunden: 6.00, schichtTyp: 'Kurzdienst' },

  // 09/2025: 24.50h (9.00h So, 0.17h Sa)
  { datum: '2025-09-07', kommen: '07:30', gehen: '17:00', pauseMinuten: 30, nettoStunden: 9.00, schichtTyp: 'Sonntagsdienst' },
  { datum: '2025-09-13', kommen: '13:00', gehen: '13:10', pauseMinuten: 0, nettoStunden: 0.17, schichtTyp: 'Kurz-Einsatz Sa' },
  { datum: '2025-09-18', kommen: '08:00', gehen: '16:00', pauseMinuten: 30, nettoStunden: 7.50, schichtTyp: 'Regeldienst' },
  { datum: '2025-09-25', kommen: '08:00', gehen: '16:20', pauseMinuten: 30, nettoStunden: 7.83, schichtTyp: 'Regeldienst' },

  // 10/2025: 28.00h (3.25h So, 3.75h Sa)
  { datum: '2025-10-05', kommen: '13:00', gehen: '16:15', pauseMinuten: 0, nettoStunden: 3.25, schichtTyp: 'Sonntagsdienst' },
  { datum: '2025-10-11', kommen: '13:00', gehen: '16:45', pauseMinuten: 0, nettoStunden: 3.75, schichtTyp: 'Samstagsdienst' },
  { datum: '2025-10-16', kommen: '08:00', gehen: '16:30', pauseMinuten: 30, nettoStunden: 8.00, schichtTyp: 'Frühdienst' },
  { datum: '2025-10-23', kommen: '08:00', gehen: '16:30', pauseMinuten: 30, nettoStunden: 8.00, schichtTyp: 'Frühdienst' },
  { datum: '2025-10-30', kommen: '09:00', gehen: '14:00', pauseMinuten: 0, nettoStunden: 5.00, schichtTyp: 'Kurzdienst' },

  // 11/2025: 25.00h (12.00h So, 0.00h Sa)
  { datum: '2025-11-02', kommen: '08:00', gehen: '14:00', pauseMinuten: 0, nettoStunden: 6.00, schichtTyp: 'Sonntagsdienst' },
  { datum: '2025-11-16', kommen: '08:00', gehen: '14:00', pauseMinuten: 0, nettoStunden: 6.00, schichtTyp: 'Sonntagsdienst' },
  { datum: '2025-11-20', kommen: '08:00', gehen: '15:00', pauseMinuten: 30, nettoStunden: 6.50, schichtTyp: 'Regeldienst' },
  { datum: '2025-11-27', kommen: '08:00', gehen: '15:00', pauseMinuten: 30, nettoStunden: 6.50, schichtTyp: 'Regeldienst' },

  // 12/2025: 14.00h (14.00h So, 0.00h Sa)
  { datum: '2025-12-07', kommen: '08:00', gehen: '15:30', pauseMinuten: 30, nettoStunden: 7.00, schichtTyp: 'Sonntagsdienst' },
  { datum: '2025-12-21', kommen: '08:00', gehen: '15:30', pauseMinuten: 30, nettoStunden: 7.00, schichtTyp: 'Sonntagsdienst' },

  // 01/2026: 29.00h (12.75h So [abgerechnet 12.50h], 0.00h Sa)
  { datum: '2026-01-04', kommen: '08:00', gehen: '14:45', pauseMinuten: 0, nettoStunden: 6.75, schichtTyp: 'Sonntagsdienst' },
  { datum: '2026-01-18', kommen: '08:00', gehen: '14:00', pauseMinuten: 0, nettoStunden: 6.00, schichtTyp: 'Sonntagsdienst' },
  { datum: '2026-01-15', kommen: '08:00', gehen: '16:30', pauseMinuten: 30, nettoStunden: 8.00, schichtTyp: 'Frühdienst' },
  { datum: '2026-01-22', kommen: '08:00', gehen: '16:45', pauseMinuten: 30, nettoStunden: 8.25, schichtTyp: 'Frühdienst' },

  // 02/2026: 29.50h (16.00h So [abgerechnet 15.25h], 0.75h Sa)
  { datum: '2026-02-01', kommen: '08:00', gehen: '16:30', pauseMinuten: 30, nettoStunden: 8.00, schichtTyp: 'Sonntagsdienst' },
  { datum: '2026-02-15', kommen: '08:00', gehen: '16:30', pauseMinuten: 30, nettoStunden: 8.00, schichtTyp: 'Sonntagsdienst' },
  { datum: '2026-02-21', kommen: '13:00', gehen: '13:45', pauseMinuten: 0, nettoStunden: 0.75, schichtTyp: 'Samstagsdienst' },
  { datum: '2026-02-26', kommen: '08:00', gehen: '16:45', pauseMinuten: 30, nettoStunden: 8.25, schichtTyp: 'Frühdienst' },
  { datum: '2026-02-27', kommen: '09:00', gehen: '13:30', pauseMinuten: 0, nettoStunden: 4.50, schichtTyp: 'Kurzdienst' },

  // 03/2026: 30.00h (14.75h So, 0.00h Sa, 3.17h Nacht)
  { datum: '2026-03-01', kommen: '08:00', gehen: '15:45', pauseMinuten: 30, nettoStunden: 7.25, schichtTyp: 'Sonntagsdienst' },
  { datum: '2026-03-15', kommen: '08:00', gehen: '16:00', pauseMinuten: 30, nettoStunden: 7.50, schichtTyp: 'Sonntagsdienst' },
  { datum: '2026-03-19', kommen: '20:00', gehen: '03:40', pauseMinuten: 30, nettoStunden: 7.17, nachtStunden: 3.17, schichtTyp: 'Nachtdienst' },
  { datum: '2026-03-26', kommen: '08:00', gehen: '16:35', pauseMinuten: 30, nettoStunden: 8.08, schichtTyp: 'Frühdienst' },

  // 04/2026: 29.00h (12.25h So, 0.00h Sa)
  { datum: '2026-04-05', kommen: '08:00', gehen: '14:15', pauseMinuten: 0, nettoStunden: 6.25, schichtTyp: 'Ostersonntag' },
  { datum: '2026-04-19', kommen: '08:00', gehen: '14:00', pauseMinuten: 0, nettoStunden: 6.00, schichtTyp: 'Sonntagsdienst' },
  { datum: '2026-04-16', kommen: '08:00', gehen: '16:30', pauseMinuten: 30, nettoStunden: 8.00, schichtTyp: 'Frühdienst' },
  { datum: '2026-04-23', kommen: '08:00', gehen: '17:15', pauseMinuten: 30, nettoStunden: 8.75, schichtTyp: 'Frühdienst' },

  // 05/2026: 29.75h (13.25h So, 5.25h Sa [abgerechnet 5.00h])
  { datum: '2026-05-03', kommen: '08:00', gehen: '15:15', pauseMinuten: 30, nettoStunden: 6.75, schichtTyp: 'Sonntagsdienst' },
  { datum: '2026-05-17', kommen: '08:00', gehen: '15:00', pauseMinuten: 30, nettoStunden: 6.50, schichtTyp: 'Sonntagsdienst' },
  { datum: '2026-05-23', kommen: '13:00', gehen: '18:15', pauseMinuten: 0, nettoStunden: 5.25, schichtTyp: 'Samstagsdienst' },
  { datum: '2026-05-28', kommen: '08:00', gehen: '16:45', pauseMinuten: 30, nettoStunden: 8.25, schichtTyp: 'Frühdienst' },
  { datum: '2026-05-29', kommen: '09:00', gehen: '12:00', pauseMinuten: 0, nettoStunden: 3.00, schichtTyp: 'Kurzdienst' },

  // 06/2026: 30.00h (14.00h So [abgerechnet 13.50h], 0.00h Sa)
  { datum: '2026-06-07', kommen: '08:00', gehen: '15:30', pauseMinuten: 30, nettoStunden: 7.00, schichtTyp: 'Sonntagsdienst' },
  { datum: '2026-06-21', kommen: '08:00', gehen: '15:30', pauseMinuten: 30, nettoStunden: 7.00, schichtTyp: 'Sonntagsdienst' },
  { datum: '2026-06-18', kommen: '08:00', gehen: '16:30', pauseMinuten: 30, nettoStunden: 8.00, schichtTyp: 'Frühdienst' },
  { datum: '2026-06-25', kommen: '08:00', gehen: '16:30', pauseMinuten: 30, nettoStunden: 8.00, schichtTyp: 'Frühdienst' },

  // 07/2026: 29.50h (7.00h So, 6.17h Sa)
  { datum: '2026-07-05', kommen: '08:00', gehen: '15:30', pauseMinuten: 30, nettoStunden: 7.00, schichtTyp: 'Sonntagsdienst' },
  { datum: '2026-07-11', kommen: '13:00', gehen: '19:10', pauseMinuten: 0, nettoStunden: 6.17, schichtTyp: 'Samstagsdienst' },
  { datum: '2026-07-16', kommen: '08:00', gehen: '16:45', pauseMinuten: 30, nettoStunden: 8.25, schichtTyp: 'Frühdienst' },
  { datum: '2026-07-23', kommen: '08:00', gehen: '16:35', pauseMinuten: 30, nettoStunden: 8.08, schichtTyp: 'Frühdienst' },

  // 08/2026: 29.33h (12.33h So, 6.25h Sa)
  { datum: '2026-08-02', kommen: '08:00', gehen: '14:20', pauseMinuten: 0, nettoStunden: 6.33, schichtTyp: 'Sonntagsdienst' },
  { datum: '2026-08-16', kommen: '08:00', gehen: '14:00', pauseMinuten: 0, nettoStunden: 6.00, schichtTyp: 'Sonntagsdienst' },
  { datum: '2026-08-22', kommen: '13:00', gehen: '19:15', pauseMinuten: 0, nettoStunden: 6.25, schichtTyp: 'Samstagsdienst' },
  { datum: '2026-08-27', kommen: '08:00', gehen: '17:15', pauseMinuten: 30, nettoStunden: 8.75, schichtTyp: 'Frühdienst' },
  { datum: '2026-08-28', kommen: '09:00', gehen: '11:00', pauseMinuten: 0, nettoStunden: 2.00, schichtTyp: 'Kurzdienst' },

  // 09/2026: 28.50h (8.00h So, 6.50h Sa)
  { datum: '2026-09-06', kommen: '08:00', gehen: '16:30', pauseMinuten: 30, nettoStunden: 8.00, schichtTyp: 'Sonntagsdienst' },
  { datum: '2026-09-12', kommen: '13:00', gehen: '19:30', pauseMinuten: 0, nettoStunden: 6.50, schichtTyp: 'Samstagsdienst' },
  { datum: '2026-09-17', kommen: '08:00', gehen: '15:30', pauseMinuten: 30, nettoStunden: 7.00, schichtTyp: 'Regeldienst' },
  { datum: '2026-09-24', kommen: '08:00', gehen: '15:30', pauseMinuten: 30, nettoStunden: 7.00, schichtTyp: 'Regeldienst' },

  // 10/2026: 29.42h (19.75h So, 1.75h Sa)
  { datum: '2026-10-04', kommen: '08:00', gehen: '15:45', pauseMinuten: 30, nettoStunden: 7.25, schichtTyp: 'Sonntagsdienst' },
  { datum: '2026-10-11', kommen: '08:00', gehen: '15:00', pauseMinuten: 30, nettoStunden: 6.50, schichtTyp: 'Sonntagsdienst' },
  { datum: '2026-10-18', kommen: '08:00', gehen: '14:30', pauseMinuten: 30, nettoStunden: 6.00, schichtTyp: 'Sonntagsdienst' },
  { datum: '2026-10-24', kommen: '13:00', gehen: '14:45', pauseMinuten: 0, nettoStunden: 1.75, schichtTyp: 'Samstagsdienst' },
  { datum: '2026-10-29', kommen: '08:00', gehen: '16:25', pauseMinuten: 30, nettoStunden: 7.92, schichtTyp: 'Regeldienst' }
];

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

const STORAGE_KEYS = {
  SHIFTS: 'zeiterfassung_shifts_v3',
  PROFILE: 'zeiterfassung_profile_v3',
  PRESETS: 'zeiterfassung_presets_v3',
  SALARY: 'zeiterfassung_salary_v3',
  THEME: 'zeiterfassung_theme_v3',
  PAYOUT_OVERRIDES: 'zeiterfassung_payout_overrides_v3',
  RESOLVED_CLAIMS: 'zeiterfassung_resolved_claims_v3',
  LEGACY_SHIFTS: 'meine_arbeitszeiten',
  LEGACY_NAME: 'ma_name',
  LEGACY_VORNAME: 'ma_vorname',
  LEGACY_PNR: 'ma_personalnummer',
  LEGACY_LOHN: 'lohn_config_v2'
};

export const storageService = {
  getProfile(): UserProfile {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (stored) return { ...DEFAULT_USER_PROFILE, ...JSON.parse(stored) };

      // Legacy Übernahme falls vorhanden
      const legacyName = localStorage.getItem(STORAGE_KEYS.LEGACY_NAME);
      const legacyVorname = localStorage.getItem(STORAGE_KEYS.LEGACY_VORNAME);
      const legacyPnr = localStorage.getItem(STORAGE_KEYS.LEGACY_PNR);

      return {
        ...DEFAULT_USER_PROFILE,
        name: legacyName || DEFAULT_USER_PROFILE.name,
        vorname: legacyVorname || DEFAULT_USER_PROFILE.vorname,
        personalnummer: legacyPnr || DEFAULT_USER_PROFILE.personalnummer
      };
    } catch {
      return DEFAULT_USER_PROFILE;
    }
  },

  saveProfile(profile: UserProfile): void {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    // Synchrone Rückfallebene für altes Schema
    localStorage.setItem(STORAGE_KEYS.LEGACY_NAME, profile.name);
    localStorage.setItem(STORAGE_KEYS.LEGACY_VORNAME, profile.vorname);
    localStorage.setItem(STORAGE_KEYS.LEGACY_PNR, profile.personalnummer);
  },

  getShifts(): ShiftEntry[] {
    try {
      const v3Raw = localStorage.getItem(STORAGE_KEYS.SHIFTS);
      const legacyRaw = localStorage.getItem(STORAGE_KEYS.LEGACY_SHIFTS);

      const v3Shifts: ShiftEntry[] = v3Raw ? JSON.parse(v3Raw) : [];
      const legacyShifts: ShiftEntry[] = legacyRaw ? JSON.parse(legacyRaw) : [];

      // Fusioniere Altdaten und Neudaten lückenlos nach Datum (neuere überschreiben ältere)
      const shiftMap = new Map<string, ShiftEntry>();

      // Falls noch überhaupt keine Schichten gespeichert sind, mit realen historischen Schichten vorinitialisieren
      if ((!v3Raw && !legacyRaw) || (v3Shifts.length === 0 && legacyShifts.length === 0)) {
        for (const s of DEFAULT_HISTORICAL_SHIFTS) {
          shiftMap.set(s.datum, s);
        }
      }

      if (Array.isArray(legacyShifts)) {
        for (const s of legacyShifts) {
          if (s && s.datum) shiftMap.set(s.datum, s);
        }
      }
      if (Array.isArray(v3Shifts)) {
        for (const s of v3Shifts) {
          if (s && s.datum) shiftMap.set(s.datum, s);
        }
      }

      const merged = Array.from(shiftMap.values()).sort((a, b) => a.datum.localeCompare(b.datum));

      // Beide Keys synchron halten
      localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(merged));
      localStorage.setItem(STORAGE_KEYS.LEGACY_SHIFTS, JSON.stringify(merged));

      return merged;
    } catch (e) {
      console.warn("Fehler beim Laden/Fugieren der Schichten:", e);
      return DEFAULT_HISTORICAL_SHIFTS;
    }
  },

  saveShifts(shifts: ShiftEntry[]): void {
    const sorted = [...shifts].sort((a, b) => a.datum.localeCompare(b.datum));
    localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(sorted));
    localStorage.setItem(STORAGE_KEYS.LEGACY_SHIFTS, JSON.stringify(sorted));
  },

  upsertShift(newEntry: ShiftEntry): ShiftEntry[] {
    const shifts = this.getShifts().filter(s => s.datum !== newEntry.datum);
    shifts.push(newEntry);
    this.saveShifts(shifts);
    return shifts;
  },

  deleteShift(datum: string): ShiftEntry[] {
    const shifts = this.getShifts().filter(s => s.datum !== datum);
    this.saveShifts(shifts);
    return shifts;
  },

  deleteMonth(yearMonth: string): ShiftEntry[] {
    const shifts = this.getShifts().filter(s => !s.datum.startsWith(yearMonth));
    this.saveShifts(shifts);
    return shifts;
  },

  getPresets(): PresetShift[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PRESETS);
      if (stored) return JSON.parse(stored);
      return DEFAULT_PRESETS;
    } catch {
      return DEFAULT_PRESETS;
    }
  },

  savePresets(presets: PresetShift[]): void {
    localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(presets));
  },

  getSalaryConfig(): SalaryConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SALARY);
      if (stored) return { ...DEFAULT_SALARY_CONFIG, ...JSON.parse(stored) };

      const legacyLohn = localStorage.getItem(STORAGE_KEYS.LEGACY_LOHN);
      if (legacyLohn) {
        const parsed = JSON.parse(legacyLohn);
        return {
          ...DEFAULT_SALARY_CONFIG,
          baseOld: parsed.baseOld ?? DEFAULT_SALARY_CONFIG.baseOld,
          baseMid: parsed.baseMid ?? DEFAULT_SALARY_CONFIG.baseMid,
          baseNew: parsed.baseNew ?? DEFAULT_SALARY_CONFIG.baseNew,
          vblPercent: parsed.vblPercent ?? DEFAULT_SALARY_CONFIG.vblPercent,
          minijobLimit: parsed.limit ?? DEFAULT_SALARY_CONFIG.minijobLimit,
          annualLimit: parsed.annualLimit ?? DEFAULT_SALARY_CONFIG.annualLimit
        };
      }
      return DEFAULT_SALARY_CONFIG;
    } catch {
      return DEFAULT_SALARY_CONFIG;
    }
  },

  saveSalaryConfig(config: SalaryConfig): void {
    localStorage.setItem(STORAGE_KEYS.SALARY, JSON.stringify(config));
    // Sync legacy format
    localStorage.setItem(STORAGE_KEYS.LEGACY_LOHN, JSON.stringify({
      baseOld: config.baseOld,
      baseMid: config.baseMid,
      baseNew: config.baseNew,
      vblPercent: config.vblPercent,
      limit: config.minijobLimit,
      annualLimit: config.annualLimit
    }));
  },

  getPayoutOverrides(): Record<string, MonthPayoutOverride> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PAYOUT_OVERRIDES);
      if (stored) return JSON.parse(stored);
      return {};
    } catch {
      return {};
    }
  },

  savePayoutOverride(override: MonthPayoutOverride): Record<string, MonthPayoutOverride> {
    const current = this.getPayoutOverrides();
    current[override.yearMonth] = {
      ...current[override.yearMonth],
      ...override
    };
    localStorage.setItem(STORAGE_KEYS.PAYOUT_OVERRIDES, JSON.stringify(current));
    return current;
  },

  deletePayoutOverride(yearMonth: string): Record<string, MonthPayoutOverride> {
    const current = this.getPayoutOverrides();
    delete current[yearMonth];
    localStorage.setItem(STORAGE_KEYS.PAYOUT_OVERRIDES, JSON.stringify(current));
    return current;
  },

  getResolvedClaims(): Record<string, ResolvedClaimStatus> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.RESOLVED_CLAIMS);
      if (stored) return JSON.parse(stored);
      return {};
    } catch {
      return {};
    }
  },

  setClaimResolved(claimId: string, isResolved: boolean): Record<string, ResolvedClaimStatus> {
    const current = this.getResolvedClaims();
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
    current[claimId] = {
      isResolved,
      resolvedDate: isResolved ? (current[claimId]?.resolvedDate || dateStr) : undefined,
      updatedAt: now.toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.RESOLVED_CLAIMS, JSON.stringify(current));
    return current;
  },

  saveAllResolvedClaims(claims: Record<string, ResolvedClaimStatus>): Record<string, ResolvedClaimStatus> {
    localStorage.setItem(STORAGE_KEYS.RESOLVED_CLAIMS, JSON.stringify(claims));
    return claims;
  },

  saveAllPayoutOverrides(overrides: Record<string, MonthPayoutOverride>): Record<string, MonthPayoutOverride> {
    localStorage.setItem(STORAGE_KEYS.PAYOUT_OVERRIDES, JSON.stringify(overrides));
    return overrides;
  },

  createBackup(): AppBackup {
    const profile = this.getProfile();
    const salary = this.getSalaryConfig();
    const presets = this.getPresets();
    const shifts = this.getShifts();
    const payoutOverrides = this.getPayoutOverrides();
    const resolvedClaims = this.getResolvedClaims();

    return {
      version: '3.1.1',
      timestamp: new Date().toISOString(),
      userProfile: profile,
      salaryConfig: salary,
      presets,
      shifts,
      payoutOverrides,
      resolvedClaims,
      // Abwärtskompatibilität
      ma_name: profile.name,
      ma_vorname: profile.vorname,
      ma_personalnummer: profile.personalnummer,
      lohn_config_v2: {
        baseOld: salary.baseOld,
        baseMid: salary.baseMid,
        baseNew: salary.baseNew,
        vblPercent: salary.vblPercent,
        limit: salary.minijobLimit,
        annualLimit: salary.annualLimit
      },
      meine_arbeitszeiten: shifts
    };
  },

  restoreBackup(backupJson: any): { success: boolean; shiftCount: number; message: string } {
    try {
      if (!backupJson || typeof backupJson !== 'object') {
        return { success: false, shiftCount: 0, message: 'Ungültiges JSON-Format' };
      }

      // Erkennung von Schichten (v3 oder v2 Format)
      const importedShifts: ShiftEntry[] = Array.isArray(backupJson.shifts)
        ? backupJson.shifts
        : (Array.isArray(backupJson.meine_arbeitszeiten) ? backupJson.meine_arbeitszeiten : []);

      if (importedShifts.length === 0 && !backupJson.userProfile && !backupJson.ma_name) {
        return { success: false, shiftCount: 0, message: 'Keine gültigen Zeiterfassungsdaten in der Datei gefunden.' };
      }

      // Profil wiederherstellen
      if (backupJson.userProfile) {
        this.saveProfile(backupJson.userProfile);
      } else if (backupJson.ma_name || backupJson.ma_vorname) {
        this.saveProfile({
          ...DEFAULT_USER_PROFILE,
          name: backupJson.ma_name || DEFAULT_USER_PROFILE.name,
          vorname: backupJson.ma_vorname || DEFAULT_USER_PROFILE.vorname,
          personalnummer: backupJson.ma_personalnummer || DEFAULT_USER_PROFILE.personalnummer
        });
      }

      // Presets wiederherstellen
      if (Array.isArray(backupJson.presets)) {
        this.savePresets(backupJson.presets);
      }

      // Gehaltskonfiguration wiederherstellen
      if (backupJson.salaryConfig) {
        this.saveSalaryConfig(backupJson.salaryConfig);
      } else if (backupJson.lohn_config_v2) {
        const c = backupJson.lohn_config_v2;
        this.saveSalaryConfig({
          ...DEFAULT_SALARY_CONFIG,
          baseOld: c.baseOld ?? DEFAULT_SALARY_CONFIG.baseOld,
          baseNew: c.baseNew ?? DEFAULT_SALARY_CONFIG.baseNew,
          sunPercent: c.sunPercent ?? DEFAULT_SALARY_CONFIG.sunPercent,
          satPercent: c.satPercent ?? DEFAULT_SALARY_CONFIG.satPercent,
          vblPercent: c.vblPercent ?? DEFAULT_SALARY_CONFIG.vblPercent,
          minijobLimit: c.limit ?? DEFAULT_SALARY_CONFIG.minijobLimit,
          annualLimit: c.annualLimit ?? DEFAULT_SALARY_CONFIG.annualLimit
        });
      }

      // Schichten wiederherstellen
      this.saveShifts(importedShifts);

      // Payout Overrides und erledigte Posten wiederherstellen
      if (backupJson.payoutOverrides && typeof backupJson.payoutOverrides === 'object') {
        localStorage.setItem(STORAGE_KEYS.PAYOUT_OVERRIDES, JSON.stringify(backupJson.payoutOverrides));
      }
      if (backupJson.resolvedClaims && typeof backupJson.resolvedClaims === 'object') {
        localStorage.setItem(STORAGE_KEYS.RESOLVED_CLAIMS, JSON.stringify(backupJson.resolvedClaims));
      }

      return {
        success: true,
        shiftCount: importedShifts.length,
        message: `Erfolgreich ${importedShifts.length} Schichten und Stammdaten wiederhergestellt!`
      };
    } catch (err: any) {
      return { success: false, shiftCount: 0, message: err?.message || 'Fehler beim Wiederherstellen des Backups' };
    }
  },

  getEmailTemplate(): { recipient: string; subject: string; body: string } {
    const recipient = localStorage.getItem('email_recipient') || '';
    const subject = localStorage.getItem('email_subject') || 'Stundenübersicht {MONAT} {JAHR}';
    const body = localStorage.getItem('email_body') ||
      'Sehr geehrte Damen und Herren,\n\nanbei sende ich Ihnen meine Stundenübersicht für den Monat {MONAT} {JAHR}.\n\nMit freundlichen Grüßen,\n{VORNAME} {NAME}';

    if (!localStorage.getItem('email_subject')) {
      localStorage.setItem('email_subject', subject);
    }
    if (!localStorage.getItem('email_body')) {
      localStorage.setItem('email_body', body);
    }

    return { recipient, subject, body };
  },

  saveEmailTemplate(template: { recipient: string; subject: string; body: string }): void {
    localStorage.setItem('email_recipient', template.recipient);
    localStorage.setItem('email_subject', template.subject);
    localStorage.setItem('email_body', template.body);
  },

  getEmailHistory(): Array<{ id: string; zielMonat: string; datumGesendet: string }> {
    try {
      const stored = localStorage.getItem('email_history');
      if (stored) return JSON.parse(stored);
      return [];
    } catch {
      return [];
    }
  },

  addEmailHistory(zielMonat: string): Array<{ id: string; zielMonat: string; datumGesendet: string }> {
    const list = this.getEmailHistory();
    const now = new Date();
    const dateFormatted = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()} um ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} Uhr`;
    list.unshift({
      id: `${Date.now()}`,
      zielMonat,
      datumGesendet: dateFormatted
    });
    if (list.length > 25) list.pop();
    localStorage.setItem('email_history', JSON.stringify(list));
    return list;
  },

  clearEmailHistory(): void {
    localStorage.removeItem('email_history');
  }
};
