import { FirebaseError } from "firebase/app";
import { httpsCallable } from "firebase/functions";
import { functions } from "./functions";

/** Pemanggil Cloud Function bertipe. Validasi input tetap dilakukan ulang di server. */
export function callable<Input, Output>(name: string) {
  const fn = httpsCallable<Input, Output>(functions, name);
  return async (input: Input): Promise<Output> => (await fn(input)).data;
}

const AUTH_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Email atau kata sandi salah.",
  "auth/invalid-email": "Format email tidak valid.",
  "auth/user-disabled": "Akun ini dinonaktifkan.",
  "auth/email-already-in-use": "Email ini sudah terdaftar. Silakan masuk.",
  "auth/weak-password": "Kata sandi terlalu lemah.",
  "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.",
  "auth/popup-closed-by-user": "Jendela login ditutup sebelum selesai.",
  "auth/cancelled-popup-request": "Login dibatalkan.",
  "auth/popup-blocked": "Popup diblokir browser. Izinkan popup lalu coba lagi.",
  "auth/network-request-failed": "Koneksi bermasalah. Periksa internet Anda.",
  "auth/account-exists-with-different-credential": "Email ini terdaftar dengan metode login lain.",
  "auth/requires-recent-login": "Silakan masuk ulang untuk melanjutkan.",
};

/** Pesan error yang aman ditampilkan ke pengguna (Bahasa Indonesia). */
export function errorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    if (error.code in AUTH_MESSAGES) return AUTH_MESSAGES[error.code] ?? error.message;
    // Error dari Cloud Functions (HttpsError) sudah berbahasa Indonesia.
    if (error.code.startsWith("functions/")) {
      if (error.code === "functions/internal" || error.code === "functions/unavailable") {
        return "Server sedang bermasalah. Coba lagi beberapa saat lagi.";
      }
      return error.message;
    }
    if (error.code === "permission-denied") return "Anda tidak memiliki akses untuk aksi ini.";
    if (error.code === "unavailable") return "Tidak dapat terhubung ke server. Periksa koneksi Anda.";
  }
  return "Terjadi kesalahan. Coba lagi.";
}
