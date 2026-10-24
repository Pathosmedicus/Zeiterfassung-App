// Antigravity Secrets-Guard: Sichere Konfiguration
// In Produktiv- oder Container-Umgebungen können diese Werte per Umgebungsvariablen injiziert werden.
window.__APP_CONFIG__ = window.__APP_CONFIG__ || {
    firebase: {
        apiKey: window.ENV_FIREBASE_API_KEY || "",
        authDomain: window.ENV_FIREBASE_AUTH_DOMAIN || "",
        projectId: window.ENV_FIREBASE_PROJECT_ID || "",
        storageBucket: window.ENV_FIREBASE_STORAGE_BUCKET || "",
        messagingSenderId: window.ENV_FIREBASE_MESSAGING_SENDER_ID || "",
        appId: window.ENV_FIREBASE_APP_ID || ""
    }
};
