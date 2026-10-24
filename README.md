# ⏱️ Zeiterfassung Radiologie v3.1 (Progressive Web App)

> Moderne, hochattraktive und datenschutzfreundliche **Progressive Web App (PWA)** zur präzisen Erfassung von Arbeitszeiten, Schichtdiensten und automatischer Gehalts- sowie Zuschlagsberechnung für radiologisches Fachpersonal der **Mühlenkreiskliniken (Klinikum Minden, TVöD-K EG 03, 5,00 Std./Monat Grundvertrag, Minijob PGS 6500)**.

---

## 🌟 Kernfunktionen (Features in v3.1)

- **⚡ Reale TVöD-K EG 03 Tarifstufen & Abrechnungsregeln:**
  * **01.08.2025 – 30.04.2026 (EG 03 Stufe 1):** 17,16 € / h • Grundvergütung 5h (LA 200): **85,80 €** • So-Zuschlag (LA 362): **4,67 € / h** (steuer- & VBL-frei) • Sa 13–21h (LA 332): **0,64 € / h** (VBL-pflichtig) • Nacht (LA 360): **3,74 € / h** (steuer- & VBL-frei)
  * **01.05.2026 – 31.07.2026 (Tariferhöhung Stufe 1):** 17,64 € / h • Grundvergütung 5h (LA 200): **88,21 €** • So-Zuschlag (LA 362): **4,80 € / h** (April-Nachzahlung: 4,67 €) • Sa (LA 332): **0,64 € / h**
  * **Ab 01.08.2026 (Stufenaufstieg Stufe 2):** 18,90 € / h • Grundvergütung 5h (LA 200): **94,51 €** • So-Zuschlag (LA 362): **4,80 € / h** • Sa (LA 332): **0,64 € / h**
  * **VBL-Arbeitnehmeranteil (ZVA):** Exakt **1,81 %** Abzug auf das VBL-Brutto (LA 200 + LA 208 Mehrstunden + LA 332 Samstagszuschlag + Sonderzahlungen). 0,00 € Steuern, 0,00 € Sozialversicherung.

- **🔄 Drei-Stufen-Versatzlogik (Cashflow vs. Leistungswert):**
  * Trennung zwischen **erarbeitetem Leistungswert** (Netto der im Monat geleisteten Arbeit) und **tatsächlicher Bank-Auszahlung** (Überweisung auf das Bankkonto):
    1. **Laufender Monat (M):** Feste Grundvergütung 5,00 Std. (LA 200)
    2. **Rückrechnung Vormonat (M-1):** Aushilfsstunden `(Gesamtstunden - 5,00h) * Stundenlohn(M-1)` als LA 208
    3. **Zeitzuschläge aus Vor-Vormonat (M-2):** Sonntags- (LA 362), Samstags- (LA 332) und Nachtstunden (LA 360) aus Monat M-2

- **🚨 Box "Offene Nachforderungen an die Personalabteilung" & Vergleichstabelle:**
  * **Offener Anspruch 2025:** 38,25h So + 3,92h Sa = **181,14 €** netto ausstehend (Sep–Dez 2025).
  * **Offene Nachforderung September 2026:** Gravierender HR-Abrechnungsfehler (SV-Tage 0, Grundlohn & Zuschlag abgezogen, 17,64 € statt 18,90 €) = **317,98 €** Netto-Nachforderungsanspruch!
  * **Gesamte offene Forderung:** **499,12 € Netto** mit 1-Klick-Kopierfunktion für das vorbereitete Klärungsschreiben an die Personalabteilung.
  * Interaktive Vergleichstabelle über alle 15 Monate (2025 & 2026) mit Aufklapp-Details zu Soll- und Ist-Überweisungen.

- **⏱️ Schnelle Schichterfassung (Tab 1: Erfassen):**
  * Vorkonfigurierte Klinikdienste der Mühlenkreiskliniken Minden:
    * ☀️ **Frühdienst**: `07:30 – 16:00` (30 Min Pause = 8,0 h)
    * 🌙 **Spätdienst**: `13:30 – 22:00` (30 Min Pause = 8,0 h)
    * ⚡ **Kurzdienst**: `08:00 – 14:00` (0 Min Pause = 6,0 h)
    * 🦉 **Nachtdienst**: `20:00 – 08:00` (60 Min Pause = 11,0 h, automatische Mitternachtserkennung)
    * 📞 **Rufbereitschaft**: `16:00 – 20:00` (4,0 h)
  * Automatische Erkennung von Nachtschichten über Mitternacht.
  * Live-Netto-Arbeitszeitvorschau in Echtzeit.
  * Interaktiver Monatskalender mit Tagesstatus und Schicht-Stunden-Badges.

- **📊 Offizielle Monatsübersicht (Tab 2: Tabelle & KPIs):**
  * Vollständige Monatstabelle aller Kalendertage (1. bis 31.).
  * Farbige Kennzeichnung von Wochenenden und Feiertagen.
  * **Inline-Editing**: Direkte Zeitanpassung mit sofortiger Live-Neuberechnung.
  * **Minijob-Tracker**: Überwachung der monatlichen 603 € Grenze mit dynamischem Fortschrittsbalken und Reststunden-Anzeige.
  * Säulendiagramme mit smarten Zahlen (Stunden & Netto-Ampel).

- **📤 Offizieller Export & PDF (Tab 3: Export & PDF):**
  - **1:1 Formular-Treue**: Exakte Nachbildung des offiziellen Stundenzettels der Mühlenkreiskliniken Minden.
  - **Natives Vektor-PDF (jsPDF)**: Gestochen scharfes A4-PDF ohne Bildverwischung.
  - **Excel-Export (.xlsx)**: Formatierte ExcelJS-Arbeitsmappe mit grün hinterlegten Arbeitszeiten (`#92D050`) und roten Pausenfeldern (`#EF4444`).
  - **Jahres-Gehaltsabgleich**: Excel-Auswertung aller 12 Monate mit Lohn, Zuschlägen und VBL.
  - **Browser-Druckansicht**: Optimiertes A4-Portrait-Layout für `window.print()`.
  - **E-Mail-Bereitstellung**: Direkte Vorbereitung für die Personalabteilung mit dynamischen Platzhaltern.

- **⚙️ Stammdaten & Konfiguration (Tab 4: Einstellungen):**
  - Hinterlegte Stammdaten:
    * **Name**: Max Mustermann
    * **Personalnummer**: 123456
    * **Abteilung**: Radiologie & Nuklearmedizin
  - Tarifkonforme Lohnstufen:
    * Basislohn bis Juli 2026: **17,16 € / h**
    * Basislohn ab August 2026: **18,90 € / h**
    * Sonntags- & Feiertagszuschlag: **27,21 %** (Gaußscher Feiertags-Algorithmus inkl. NRW)
    * Samstagszuschlag 13:00–21:00 Uhr: **3,73 %**
    * VBL-Zusatzversorgungsabzug: **1,87 %**
  - Presets-Manager: Eigene Schichten mit Symbolen und Zeiten anlegen.
  - **Vollständiges JSON-Backup**: Export und Import aller Daten mit 1-Klick-Wiederherstellung.

- **📱 iOS-App-Feeling & PWA:**
  - Installierbar auf iPhone, iPad, Android und Desktop als eigenständige App.
  - Vollständiger **Dark Mode & Light Mode** mit sofortiger Umschaltung im Sticky Header.
  - Feste Bottom-Tab-Bar im mobilen iOS-Design.
  - 100 % offline-fähig über Service Worker (`vite-plugin-pwa`) und LocalStorage.

---

## 🚀 Schnellstart

### Entwicklungsserver starten:
```powershell
npm run dev
# Die App läuft unter: http://localhost:3000
```

### Produktions-Build erstellen:
```powershell
npm run build
```

### Über Docker starten:
```powershell
docker compose up -d --build
# Erreichbar unter: http://localhost:8080
```

---

## 📂 Neue Projektstruktur

```
zeiterfassung/
├── src/
│   ├── components/
│   │   ├── Header.tsx           # Sticky Header mit Monat & Live-Zähler
│   │   ├── BottomNav.tsx        # Feste App-Tab-Bar (iOS Style)
│   │   ├── Toast.tsx            # Toast-Meldungen mit Undo
│   │   ├── Erfassen/
│   │   │   ├── QuickEntry.tsx   # Schnelleingabe & Klinik-Presets
│   │   │   └── MiniCalendar.tsx # Interaktiver Monatskalender
│   │   ├── Tabelle/
│   │   │   ├── MonthTable.tsx   # Monatstabelle mit Inline-Editing
│   │   │   └── KpiCards.tsx     # KPI-Karten & Minijob-Tracker
│   │   ├── Export/
│   │   │   ├── SheetPreview.tsx # 1:1 Papier-Druckvorschau
│   │   │   └── ExportActions.tsx# Vektor-PDF, Excel & E-Mail
│   │   └── Settings/
│   │       ├── Stammdaten.tsx   # Profil & Personalnummer
│   │       ├── PresetsConfig.tsx# Schicht-Vorlagen Editor
│   │       ├── SalaryConfig.tsx # Lohn- & Zuschlagsregeln
│   │       └── BackupManager.tsx# JSON Backup Export/Import
│   ├── services/
│   │   ├── storageService.ts    # Persistenz & Backup-Engine
│   │   ├── salaryEngine.ts      # Netto- & Gehaltsberechnung
│   │   ├── holidayEngine.ts     # Gaußsche Feiertagsberechnung (NRW)
│   │   ├── pdfService.ts        # Gestochen scharfes Vektor-PDF (jsPDF)
│   │   └── excelService.ts      # Formatierter ExcelJS-Export
│   ├── types/
│   │   └── index.ts             # TypeScript Typdefinitionen
│   ├── App.tsx                  # Reaktive Hauptanwendung
│   ├── main.tsx                 # React DOM Entry
│   └── index.css                # Tailwind & Druck-CSS
├── public/
│   ├── favicon.svg              # Medizinisches PWA Icon
│   └── manifest.json            # PWA Web-App Manifest
├── index.html                   # Vite PWA Shell
├── index.legacy.html            # Sicherheits-Backup der alten Version
├── vite.config.ts               # Vite & PWA Konfiguration
├── tailwind.config.js           # Design System & Farben
└── Dockerfile                   # Multi-Stage Node+Nginx Image
```
