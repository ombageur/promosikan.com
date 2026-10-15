import { FieldValue, type Firestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { decryptSecret, type Encrypted, encryptSecret } from "../utils/crypto";
import type { ThreadsApi } from "./api";

export type ThreadsConfig = {
  appId: string;
  appSecret: string;
  encryptionKey: string;
  /** URL frontend, mis. https://promosikan.com — redirect OAuth = `${appUrl}/oauth/threads/callback`. */
  appUrl: string;
};

export type ThreadsDeps = { db: Firestore; api: ThreadsApi; config: ThreadsConfig; now?: () => number };

export type AccountStatus = "connected" | "expired" | "revoked" | "error";

export const redirectUri = (config: ThreadsConfig) => `${config.appUrl.replace(/\/$/, "")}/oauth/threads/callback`;

/** Satu akun Threads per workspace. Dokumen ini dibaca client — tidak pernah berisi token. */
export const accountRef = (db: Firestore, workspaceId: string) =>
  db.collection("workspaces").doc(workspaceId).collection("socialAccounts").doc("threads");

/** Token terenkripsi di koleksi yang ditolak penuh oleh rules. */
export const secretRef = (db: Firestore, workspaceId: string) => db.collection("integrationSecrets").doc(`${workspaceId}_threads`);

export function assertConfigured(config: ThreadsConfig) {
  if (!config.appId || !config.appSecret || !config.encryptionKey) {
    throw new HttpsError("failed-precondition", "Integrasi Threads belum dikonfigurasi di server (App ID/secret).");
  }
}

export async function saveToken(
  deps: ThreadsDeps,
  workspaceId: string,
  token: { accessToken: string; expiresInSeconds: number },
  platformUserId: string,
) {
  const now = deps.now?.() ?? Date.now();
  const encrypted = encryptSecret(token.accessToken, deps.config.encryptionKey);
  const expiresAt = Timestamp.fromMillis(now + token.expiresInSeconds * 1000);
  await secretRef(deps.db, workspaceId).set({
    workspaceId,
    platform: "threads",
    platformUserId,
    token: encrypted,
    tokenExpiresAt: expiresAt,
    refreshedAt: Timestamp.fromMillis(now),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return expiresAt;
}

export async function loadToken(deps: ThreadsDeps, workspaceId: string): Promise<string | null> {
  const snap = await secretRef(deps.db, workspaceId).get();
  const token = snap.get("token") as Encrypted | undefined;
  return token ? decryptSecret(token, deps.config.encryptionKey) : null;
}

/** Ubah status akun (mis. token dicabut) — monitoring berhenti untuk status selain `connected`. */
export async function setAccountStatus(db: Firestore, workspaceId: string, status: AccountStatus, lastError: string | null) {
  await accountRef(db, workspaceId).set({ status, lastError, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}
