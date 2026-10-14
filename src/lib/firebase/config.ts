import type { FirebaseOptions } from "firebase/app";

/** Project ID yang dipakai Emulator Suite (`--project demo-promosikan`). Prefix `demo-` = tanpa akses cloud. */
export const EMULATOR_PROJECT_ID = "demo-promosikan";

export const useEmulators = import.meta.env.VITE_USE_EMULATORS === "true";

function readEnvConfig(): FirebaseOptions {
  const env = import.meta.env;
  const config: FirebaseOptions = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Konfigurasi Firebase belum lengkap: ${missing.join(", ")}. Lihat .env.example.`);
  }
  return config;
}

/** Konfigurasi web Firebase bersifat publik; keamanan ditegakkan oleh Security Rules dan App Check. */
export const firebaseConfig: FirebaseOptions = useEmulators
  ? {
      apiKey: "demo-api-key",
      authDomain: `${EMULATOR_PROJECT_ID}.firebaseapp.com`,
      projectId: EMULATOR_PROJECT_ID,
      storageBucket: `${EMULATOR_PROJECT_ID}.appspot.com`,
      appId: "demo-app",
    }
  : readEnvConfig();
