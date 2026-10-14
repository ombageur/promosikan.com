import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/auth";

const continueUrl = (path: string) => ({ url: `${window.location.origin}${path}` });

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(auth, provider);
}

export async function registerWithEmail(name: string, email: string, password: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: name });
  await sendEmailVerification(credential.user, continueUrl("/app"));
  return credential;
}

export async function resendVerificationEmail(user: User) {
  await sendEmailVerification(user, continueUrl("/app"));
}

export async function sendPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email, continueUrl("/login"));
}

/**
 * Muat ulang status verifikasi email. Token ID harus di-refresh agar klaim
 * `email_verified` terbaru terbaca oleh Security Rules dan Cloud Functions.
 */
export async function refreshVerification(user: User): Promise<boolean> {
  await user.reload();
  if (user.emailVerified) await user.getIdToken(true);
  return user.emailVerified;
}

export async function signOut() {
  await firebaseSignOut(auth);
}
