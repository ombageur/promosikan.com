import type { User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/firestore";
import type { UserProfile } from "@/types/workspace";

const userRef = (uid: string) => doc(db, "users", uid);

/** Buat atau sinkronkan dokumen users/{uid} dari data Firebase Auth. */
export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const ref = userRef(user.uid);
  const snap = await getDoc(ref);
  const fromAuth = {
    displayName: user.displayName ?? "",
    email: user.email ?? "",
    photoURL: user.photoURL ?? null,
  };

  if (!snap.exists()) {
    await setDoc(ref, { ...fromAuth, lastWorkspaceId: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return { ...fromAuth, lastWorkspaceId: null };
  }

  const current = snap.data() as UserProfile;
  const changed = (Object.keys(fromAuth) as (keyof typeof fromAuth)[]).some((key) => current[key] !== fromAuth[key]);
  if (changed) await updateDoc(ref, { ...fromAuth, updatedAt: serverTimestamp() });
  return { ...current, ...fromAuth };
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function setLastWorkspace(uid: string, workspaceId: string) {
  await updateDoc(userRef(uid), { lastWorkspaceId: workspaceId, updatedAt: serverTimestamp() });
}
