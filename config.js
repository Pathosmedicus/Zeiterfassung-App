// Antigravity Secrets-Guard: Sichere Konfiguration für Zeiterfassung PWA
// Ermöglicht Firebase Auth Initialisierung auf GitHub Pages (osmedicus.github.io)
window.__APP_CONFIG__ = window.__APP_CONFIG__ || {
    firebase: {
        apiKey: window.ENV_FIREBASE_API_KEY || "AIzaSyAkqcW0nGb0bNgZZoV6mfdF-HAylwjeYtw",
        authDomain: window.ENV_FIREBASE_AUTH_DOMAIN || "zeiterfassung-app-56bfa.firebaseapp.com",
        projectId: window.ENV_FIREBASE_PROJECT_ID || "zeiterfassung-app-56bfa",
        storageBucket: window.ENV_FIREBASE_STORAGE_BUCKET || "zeiterfassung-app-56bfa.firebasestorage.app",
        messagingSenderId: window.ENV_FIREBASE_MESSAGING_SENDER_ID || "48863732219",
        appId: window.ENV_FIREBASE_APP_ID || "1:48863732219:web:7202f1e35ffd4600e76b5e"
    }
};
