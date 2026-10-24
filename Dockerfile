# Multi-Stage Dockerfile für Zeiterfassung Radiologie PWA v3.0

# 1. Build Stage
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 2. Production Stage
FROM nginx:alpine

LABEL maintainer="Zeiterfassung Radiologie PWA"
LABEL description="Schlanker Webserver für die Zeiterfassungs-PWA"

# Entferne Nginx Standarddateien
RUN rm -rf /usr/share/nginx/html/*

# Kopiere das gebaute dist-Verzeichnis
COPY --from=builder /app/dist /usr/share/nginx/html

# Eigener Nginx Virtual Host mit Gzip, SPA-Fallback und Security-Headern
RUN printf 'server {\n\
    listen 80;\n\
    server_name localhost;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    \n\
    gzip on;\n\
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;\n\
    \n\
    add_header X-Frame-Options "SAMEORIGIN";\n\
    add_header X-Content-Type-Options "nosniff";\n\
    add_header X-XSS-Protection "1; mode=block";\n\
    \n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
