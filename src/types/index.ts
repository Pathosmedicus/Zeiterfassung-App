/**
 * Typ-Definitionen für die Zeiterfassung Radiologie PWA
 */

export interface ShiftEntry {
  datum: string;        // YYYY-MM-DD
  kommen: string;       // HH:MM (z.B. "07:30")
  gehen: string;        // HH:MM (z.B. "16:00")
  pauseMinuten: number; // Minuten (z.B. 30)
  nettoStunden: number; // Dezimal (z.B. 8.00)
  schichtTyp?: string;  // Name des Presets / Typs
  notiz?: string;       // Optionale Notiz
  nachtStunden?: number; // Explizite Nachtstunden (z.B. 3.17h)
  id?: string;          // Eindeutige ID für Smart-Merge
  updatedAt?: string;   // ISO-Zeitstempel der letzten Änderung
}

export interface UserProfile {
  name: string;
  vorname: string;
  personalnummer: string;
  abteilung: string;
  klinik: string;
}

export interface PresetShift {
  id: string;
  name: string;
  icon: string;
  kommen: string;
  gehen: string;
  pauseMinuten: number;
  description?: string;
}

export interface TariffPeriodInfo {
  name: string;
  hourlyWage: number;
  basePay5h: number;     // Feste Grundvergütung LA 200 (5.00h)
  sundayBonus: number;   // LA 362 (€/h)
  saturdayBonus: number; // LA 332 (€/h)
  nightBonus: number;    // LA 360 (€/h)
  vblPercent: number;    // 1.81 %
}

export interface SalaryConfig {
  baseOld: number;        // Bis 30.04.2026: 17.16 €
  baseMid: number;        // 01.05.2026 bis 31.07.2026: 17.64 €
  baseNew: number;        // Ab 01.08.2026: 18.90 €
  baseHours: number;      // 5.00 Std. Grundvertrag
  vblPercent: number;     // 1.81 %
  minijobLimit: number;   // 603 €
  annualLimit: number;    // 7236 €
  sunRateOld: number;     // 4.67 €
  sunRateNew: number;     // 4.80 €
  satRate: number;        // 0.64 €
  nightRate: number;      // 3.74 €
  cutoffYear?: number;
  cutoffMonth?: number;
  sunPercent?: number;
  satPercent?: number;
}

export interface MonthSalaryStats {
  activeBaseWage: number;
  tariffName: string;
  gesamtDezimal: number;
  anzahlDienste: number;
  sonntagStunden: number;
  samstagBonusStunden: number;
  nachtStunden: number;
  // LA 200 & LA 208 Aufteilung
  grundStunden: number;   // 5.00h
  mehrStunden: number;    // gesamtDezimal - 5.00h
  basisLohn: number;      // gesamtDezimal * activeBaseWage
  grundLohnLA200: number; // 5.00h * activeBaseWage (bzw. 85.80 / 88.21 / 94.51)
  mehrLohnLA208: number;  // mehrStunden * activeBaseWage
  sonntagLohn: number;    // sonntagStunden * sonntagBonus (LA 362)
  samstagLohn: number;    // samstagBonusStunden * samstagBonus (LA 332)
  nachtLohn: number;      // nachtStunden * nachtBonus (LA 360)
  gesamtGehalt: number;   // Brutto
  vblBrutto: number;      // LA 200 + LA 208 + LA 332
  vblAbzug: number;       // 1.81% auf vblBrutto
  erwartetesNetto: number; // Leistungswert des Monats
}

// 3-Stufen-Versatz Auszahlungsergebnis für einen Auszahlungsmonat
export interface CashflowMonthStats {
  auszahlungsMonat: string; // YYYY-MM
  laufenderMonatLA200: number; // 5.00h Grundvergütung (Monat M)
  vormonatMehrstundenLA208: number; // (Stunden(M-1) - 5h) * Lohn(M-1)
  vormonatStunden: number;
  vorVormonatSonntagLA362: number; // So-Zuschlag aus M-2
  vorVormonatSamstagLA332: number; // Sa-Zuschlag aus M-2
  vorVormonatNachtLA360: number; // Nacht-Zuschlag aus M-2
  sonderzahlungen: number;
  vblBrutto: number;
  vblAbzug: number;
  bankAuszahlungSoll: number; // Regulär fälliges Netto nach Versatz
}

export interface MonthPayoutOverride {
  yearMonth: string;          // YYYY-MM
  bankIst?: number;           // Tatsächlich erhaltene Überweisung (€)
  sonderzahlungBetrag?: number;
  sonderzahlungText?: string;
  isResolved?: boolean;       // Vom Mitarbeiter als beglichen markiert
  resolvedDate?: string;      // Datum der Erledigung
  notiz?: string;             // Eigene Notiz
  updatedAt?: string;
}

export interface OpenClaimItem {
  id: string;
  yearMonth?: string;
  titel: string;
  zeitraum: string;
  betragNetto: number;
  kategorie: 'anomalie_2025' | 'nachforderung_2026' | 'dynamisch';
  isResolved: boolean;
  resolvedDate?: string;
  kurzBeschreibung: string;
  details: string[];
  updatedAt?: string;
}

export interface ClinicPayrollRecord {
  yearMonth: string;          // YYYY-MM
  label: string;              // z.B. "Aug 2025"
  gesamtStunden: number;
  sonntagStunden: number;
  samstagStunden: number;
  nachtStunden?: number;
  abgerechnetSonntag?: number;
  abgerechnetSamstag?: number;
  bankIst: number;            // Tatsächliche Bank-Überweisung
  bankSollRegulaer: number;   // Regulär erwartete Bank-Überweisung
  differenz: number;          // bankIst - bankSollRegulaer
  status: 'ok' | 'anomaly' | 'claim' | 'forecast';
  statusBadge: string;
  sonderzahlungText?: string;
  sonderzahlungBetrag?: number;
  hrNotiz: string;
  offenerAnspruch?: number;
  isResolved?: boolean;
  resolvedDate?: string;
}

export interface DeletedShiftItem {
  datum: string;
  deletedAt: string;
}

export interface ResolvedClaimStatus {
  isResolved: boolean;
  resolvedDate?: string;
  updatedAt?: string;
  reopenedAt?: string;
}

export type TabType = 'stundenzettel' | 'tabelle' | 'jahresradar' | 'email' | 'export' | 'settings';

export interface EmailTemplate {
  recipient: string;
  subject: string;
  body: string;
}

export interface EmailHistoryItem {
  id: string;
  zielMonat: string;
  datumGesendet: string;
}

export interface CloudBackupItem {
  timestamp: string;
  shiftCount: number;
  note?: string;
  shifts: ShiftEntry[];
  profile: Partial<UserProfile>;
  userProfile?: Partial<UserProfile>;
  salaryConfig?: Partial<SalaryConfig>;
  presets?: PresetShift[];
  resolvedClaims?: Record<string, ResolvedClaimStatus>;
  payoutOverrides?: Record<string, MonthPayoutOverride>;
  deletedShifts?: Record<string, DeletedShiftItem>;
}

export interface CloudUserData {
  email?: string;
  uid?: string;
  shifts: ShiftEntry[];
  profile: Partial<UserProfile>;
  userProfile?: Partial<UserProfile>;
  presets?: PresetShift[];
  resolvedClaims?: Record<string, ResolvedClaimStatus>;
  payoutOverrides?: Record<string, MonthPayoutOverride>;
  salaryConfig?: Partial<SalaryConfig>;
  backupHistory?: CloudBackupItem[];
  deletedShifts?: Record<string, DeletedShiftItem>;
  lastUpdated?: any;
  lastDevice?: string;
}

export interface AppBackup {
  version: string;
  timestamp: string;
  userProfile: UserProfile;
  salaryConfig: SalaryConfig;
  presets: PresetShift[];
  shifts: ShiftEntry[];
  payoutOverrides?: Record<string, MonthPayoutOverride>;
  resolvedClaims?: Record<string, ResolvedClaimStatus>;
  ma_name?: string;
  ma_vorname?: string;
  ma_personalnummer?: string;
  lohn_config_v2?: any;
  meine_arbeitszeiten?: ShiftEntry[];
}

export interface AppUserSession {
  id: string; // E-Mail, Google UID oder lokale ID
  name: string;
  email?: string;
  authProvider: 'google' | 'pin';
  isOwner?: boolean;
  isOnboarded?: boolean;
  avatarUrl?: string;
  lastLogin: string;
}

export interface SyncPackage {
  version: string;
  timestamp: string;
  userId: string;
  userProfile: UserProfile;
  salaryConfig: SalaryConfig;
  presets: PresetShift[];
  shifts: ShiftEntry[];
  payoutOverrides: Record<string, MonthPayoutOverride>;
  resolvedClaims: Record<string, ResolvedClaimStatus>;
}
