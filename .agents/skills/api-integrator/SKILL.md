---
name: api-integrator
description: Testet API-Endpunkte über das Terminal (curl/Fetch), analysiert Rückgabewerte und generiert saubere Datenmodelle (JSON/TypeScript) für den Code.
---

# API Integrator Skill

Dieser Skill unterstützt beim Anbinden, Testen und Integrieren externer oder interner APIs und REST-Dienste.

## Arbeitsablauf:

1. **Endpunkt analysieren & testen:**
   - Teste den API-Aufruf über das Terminal (z. B. via `curl` oder Node.js-Skript).
   - Prüfe HTTP-Statuscodes (200 OK, 401 Unauthorized, 404 Not Found etc.).

2. **Rückgabewerte (Payloads) inspizieren:**
   - Analysiere die JSON-Struktur der Server-Antwort.
   - Identifiziere erforderliche vs. optionale Felder und Datentypen (String, Number, Boolean, Arrays, verschachtelte Objekte).

3. **Modelle & Typen generieren:**
   - Erstelle passende TypeScript-Interfaces, TypeScript-Typen oder JavaScript-Validierungsfunktionen (z. B. mit Zod).

4. **Fehlerbehandlung (Error Handling) integrieren:**
   - Baue saubere `try...catch`-Blöcke, Timeout-Behandlung und verständliche Fehlermeldungen für den Nutzer ein.
