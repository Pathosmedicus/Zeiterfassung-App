export interface VersionRelease {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

export const APP_VERSION = 'v3.3.0';
export const APP_BUILD_DATE = '27. Oktober 2026';
export const APP_NAME = 'Zeiterfassung Radiologie';

export const APP_CHANGELOG: VersionRelease[] = [
  {
    version: 'v3.3.0',
    date: '27.10.2026',
    title: 'Stundenzettel-Direktmodus & Zentrierter A4-Export',
    highlights: [
      'Versionsnummer-Badge & Update-Verfolgung zur sofortigen Cache-Prüfung',
      'Tab „Stundenzettel“ ersetzt „Erfassen“ mit direkter Inline-Bearbeitung je Tabellenzeile',
      'Offizieller Stundenzettel PDF-Export perfekt auf DIN A4 vertikal & horizontal zentriert',
      'Reiner, sicherer Google-Login mit strikter Multi-User Isolation',
      'Eigene spezialisierte Tabs für „Statistik“ und „Abrechnungsabgleich“'
    ]
  },
  {
    version: 'v3.2.0',
    date: '26.10.2026',
    title: 'Gmail-Cloud Multi-User & Auto-Sync',
    highlights: [
      'Strikt isolierter Speicherbereich je Google-Konto (0 Bytes Fremddaten)',
      'Zuverlässiger Snapshot-Sync ohne Geisterschichten oder unerwünschte Altlasten',
      'Automatischer Cloud-Abgleich beim Starten der Web-App'
    ]
  },
  {
    version: 'v3.1.0',
    date: '25.10.2026',
    title: 'Modernes Cyber-Dark Design & Gehalts-Radar',
    highlights: [
      'Neues Glassmorphism-Design mit Dark Mode',
      '7.230 € Jahres-Radar & automatische Steuer-/Zuschlagsberechnung',
      'PWA-Unterstützung für Mobilgeräte und Tablets'
    ]
  }
];
