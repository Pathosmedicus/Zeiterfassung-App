---
name: docker-containerizer
description: Erstellt optimierte Dockerfiles und docker-compose.yml-Konfigurationen und testet Container-Builds im integrierten Terminal.
---

# Docker Containerizer Skill

Dieser Skill paketiert Anwendungen in standardisierte, reproduzierbare Docker-Container, damit sie auf jedem System identisch laufen.

## Arbeitsablauf:

1. **Projektumgebung analysieren:**
   - Ermittle die Programmiersprache, Runtime-Version (z. B. Node.js 20, Python 3.11) und Einstiegsdatei.
   - Prüfe erforderliche System-Ports (z. B. 3000, 8080).

2. **Dockerfile erstellen:**
   - Verwende schlanke, offizielle Basis-Images (z. B. `node:alpine` oder `python:slim`).
   - Nutze Multi-Stage-Builds, um die finale Image-Größe minimal zu halten.
   - Installiere Abhängigkeiten getrennt vom Quellcode für optimales Docker-Layer-Caching.

3. **Dateien bereinigen (.dockerignore):**
   - Schließe `node_modules`, `.git`, `.env` und temporäre Dateien zwingend über `.dockerignore` aus.

4. **Multi-Container (docker-compose.yml):**
   - Falls zusätzliche Dienste (z. B. Datenbank, Cache) benötigt werden, erstelle eine passende `docker-compose.yml` mit vernetzten Services und persistenten Volumes.

5. **Build-Test im Terminal:**
   - Führe `docker build` im Terminal aus, um sicherzustellen, dass das Image fehlerfrei baut.
