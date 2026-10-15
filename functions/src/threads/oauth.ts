import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { writeAudit } from "../utils/audit";
import { decryptSecret } from "../utils/crypto";
import { type CallContext, parseInput } from "../utils/context";
import { requirePermission, workspaceRef } from "../utils/membership";
import {
  accountRef,
  assertConfigured,
  redirectUri,
  saveToken,
  secretRef,
  setAccountStatus,
  type ThreadsDeps,
} from "./account";
import { THREADS_SCOPES, ThreadsAuthError } from "./api";

const STATE_TTL_MS = 10 * 60 * 1000;
const workspaceInput = z.object({ workspaceId: z.string().min(1).max(128) });

async function requireRealWorkspace(deps: ThreadsDeps, workspaceId: string) {
  const ws = await workspaceRef(deps.db, workspaceId).get();
  if (ws.get("isDemo") === true) {
    throw new HttpsError("failed-precondition", "Workspace demo tidak dapat terhubung ke platform sosial.");
  }
}

/** Langkah 1: buat `state` anti-CSRF sekali pakai, kembalikan URL otorisasi Threads. */
export async function startThreadsOAuthHandler(deps: ThreadsDeps, ctx: CallContext, data: unknown) {
  const { workspaceId } = parseInput(workspaceInput, data);
  await requirePermission(deps.db, workspaceId, ctx.uid, "integrations.manage");
  await requireRealWorkspace(deps, workspaceId);
  assertConfigured(deps.config);

  const now = deps.now?.() ?? Date.now();
  const state = randomBytes(24).toString("base64url");
  await deps.db.collection("oauthStates").doc(state).create({
    workspaceId,
    uid: ctx.uid,
    platform: "threads",
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(now + STATE_TTL_MS),
  });
  return { url: deps.api.authorizeUrl({ appId: deps.config.appId, redirectUri: redirectUri(deps.config), state }) };
}

/**
 * Langkah 2: Threads mengarahkan kembali dengan `code` & `state`. Mengembalikan URL tujuan redirect
 * di aplikasi. Token tidak pernah dikirim ke browser maupun dicatat di log.
 */
export async function threadsOAuthCallbackHandler(deps: ThreadsDeps, query: Record<string, unknown>): Promise<string> {
  const appUrl = deps.config.appUrl.replace(/\/$/, "");
  const state = typeof query.state === "string" ? query.state : "";
  if (!state) return `${appUrl}/app?threads=error&reason=state`;

  // State dipakai sekali: dihapus apa pun hasilnya.
  const stateRef = deps.db.collection("oauthStates").doc(state);
  const stateDoc = await deps.db.runTransaction(async (tx) => {
    const snap = await tx.get(stateRef);
    if (snap.exists) tx.delete(stateRef);
    return snap;
  });
  const now = deps.now?.() ?? Date.now();
  if (!stateDoc.exists || (stateDoc.get("expiresAt") as Timestamp).toMillis() < now) {
    return `${appUrl}/app?threads=error&reason=state`;
  }
  const workspaceId = String(stateDoc.get("workspaceId"));
  const uid = String(stateDoc.get("uid"));
  const back = (params: string) => `${appUrl}/w/${workspaceId}/integrations?${params}`;

  if (typeof query.error === "string" || typeof query.code !== "string") return back("threads=denied");

  try {
    // Pemanggil awal harus masih berhak mengelola integrasi.
    await requirePermission(deps.db, workspaceId, uid, "integrations.manage");
    await requireRealWorkspace(deps, workspaceId);
    assertConfigured(deps.config);

    const short = await deps.api.exchangeCode({
      appId: deps.config.appId,
      appSecret: deps.config.appSecret,
      redirectUri: redirectUri(deps.config),
      code: query.code,
    });
    const long = await deps.api.exchangeLongLived({ appSecret: deps.config.appSecret, accessToken: short.accessToken });
    const profile = await deps.api.me(long.accessToken);
    const tokenExpiresAt = await saveToken(deps, workspaceId, long, profile.id);

    await accountRef(deps.db, workspaceId).set({
      platform: "threads",
      platformUserId: profile.id,
      username: profile.username,
      status: "connected",
      scopesRequested: [...THREADS_SCOPES],
      connectedBy: uid,
      connectedAt: FieldValue.serverTimestamp(),
      tokenExpiresAt,
      lastSyncAt: null,
      nextSyncAt: Timestamp.fromMillis(now),
      lastError: null,
      quota: { day: "", queries: 0 },
      updatedAt: FieldValue.serverTimestamp(),
    });
    await deps.db.runTransaction(async (tx) => {
      writeAudit(deps.db, tx, workspaceId, { action: "integration.connected", actorUid: uid, details: { platform: "threads", username: profile.username } });
    });
    return back("threads=connected");
  } catch (error) {
    logger.error("OAuth Threads gagal", { workspaceId, error: error instanceof Error ? error.message : String(error) });
    return back(`threads=error&reason=${error instanceof HttpsError ? error.code : "exchange"}`);
  }
}

/** Putuskan koneksi: hapus token & data akun; monitoring berhenti. */
export async function disconnectThreadsHandler(deps: ThreadsDeps, ctx: CallContext, data: unknown) {
  const { workspaceId } = parseInput(workspaceInput, data);
  await requirePermission(deps.db, workspaceId, ctx.uid, "integrations.manage");
  await deps.db.runTransaction(async (tx) => {
    tx.delete(secretRef(deps.db, workspaceId));
    tx.delete(accountRef(deps.db, workspaceId));
    writeAudit(deps.db, tx, workspaceId, { action: "integration.disconnected", actorUid: ctx.uid, details: { platform: "threads" } });
  });
  return { ok: true };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Harian: refresh token long-lived yang berumur ≥ 24 jam dan akan kedaluwarsa < 30 hari.
 * Token yang gagal (dicabut/kedaluwarsa) → status akun `expired`, monitoring berhenti.
 */
export async function refreshThreadsTokensHandler(deps: ThreadsDeps) {
  const now = deps.now?.() ?? Date.now();
  const due = await deps.db
    .collection("integrationSecrets")
    .where("platform", "==", "threads")
    .where("tokenExpiresAt", "<", Timestamp.fromMillis(now + 30 * DAY_MS))
    .limit(200)
    .get();

  let refreshed = 0;
  let expired = 0;
  for (const doc of due.docs) {
    const workspaceId = String(doc.get("workspaceId"));
    const refreshedAt = (doc.get("refreshedAt") as Timestamp | undefined)?.toMillis() ?? 0;
    const expiresAt = (doc.get("tokenExpiresAt") as Timestamp).toMillis();
    if (expiresAt <= now) {
      await setAccountStatus(deps.db, workspaceId, "expired", "Token Threads kedaluwarsa. Hubungkan ulang akun.");
      expired++;
      continue;
    }
    if (now - refreshedAt < DAY_MS) continue;
    try {
      const current = decryptSecret(doc.get("token"), deps.config.encryptionKey);
      const next = await deps.api.refreshLongLived(current);
      const tokenExpiresAt = await saveToken(deps, workspaceId, next, String(doc.get("platformUserId")));
      await accountRef(deps.db, workspaceId).set({ tokenExpiresAt, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      refreshed++;
    } catch (error) {
      if (error instanceof ThreadsAuthError) {
        await setAccountStatus(deps.db, workspaceId, "expired", "Akses Threads tidak valid lagi. Hubungkan ulang akun.");
        expired++;
      } else {
        logger.warn("Refresh token Threads gagal sementara", { workspaceId, error: (error as Error).message });
      }
    }
  }
  return { refreshed, expired };
}

// ---------- Callback Meta (deauthorize & penghapusan data) ----------

/**
 * Format `signed_request` standar Meta: base64url(HMAC-SHA256(payload, appSecret)) + "." + base64url(JSON).
 * ⚠️ Verifikasi field untuk aplikasi Threads di App Dashboard (docs/THREADS_API_NOTES.md §5).
 */
export function parseSignedRequest(signedRequest: string, appSecret: string): { user_id?: string } | null {
  const [sig, payload] = signedRequest.split(".", 2);
  if (!sig || !payload) return null;
  const expected = createHmac("sha256", appSecret).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { algorithm?: string; user_id?: string | number };
    if (data.algorithm && data.algorithm.toUpperCase() !== "HMAC-SHA256") return null;
    return { user_id: data.user_id === undefined ? undefined : String(data.user_id) };
  } catch {
    return null;
  }
}

/** Cabut semua koneksi milik pengguna Threads ini: hapus token, tandai akun `revoked`. */
async function revokeByPlatformUser(deps: ThreadsDeps, platformUserId: string, reason: string) {
  const accounts = await deps.db
    .collectionGroup("socialAccounts")
    .where("platformUserId", "==", platformUserId)
    .limit(50)
    .get();
  for (const account of accounts.docs) {
    const workspaceId = account.ref.parent.parent?.id;
    if (!workspaceId) continue;
    await secretRef(deps.db, workspaceId).delete();
    await setAccountStatus(deps.db, workspaceId, "revoked", reason);
  }
  return accounts.size;
}

export async function threadsDeauthorizeHandler(deps: ThreadsDeps, body: Record<string, unknown>) {
  const parsed = typeof body.signed_request === "string" ? parseSignedRequest(body.signed_request, deps.config.appSecret) : null;
  if (!parsed?.user_id) return { status: 400 as const, body: { error: "invalid signed_request" } };
  await revokeByPlatformUser(deps, parsed.user_id, "Akses aplikasi dicabut dari pengaturan Threads.");
  return { status: 200 as const, body: { ok: true } };
}

/** Wajib mengembalikan URL status + kode konfirmasi (kebutuhan callback penghapusan data Meta). */
export async function threadsDataDeletionHandler(deps: ThreadsDeps, body: Record<string, unknown>) {
  const parsed = typeof body.signed_request === "string" ? parseSignedRequest(body.signed_request, deps.config.appSecret) : null;
  if (!parsed?.user_id) return { status: 400 as const, body: { error: "invalid signed_request" } };
  const accounts = await revokeByPlatformUser(deps, parsed.user_id, "Data dihapus atas permintaan pengguna Threads.");
  const code = randomBytes(8).toString("hex");
  await deps.db.collection("dataDeletionRequests").doc(code).create({
    platform: "threads",
    platformUserId: parsed.user_id,
    accountsAffected: accounts,
    status: "completed",
    createdAt: FieldValue.serverTimestamp(),
  });
  const appUrl = deps.config.appUrl.replace(/\/$/, "");
  return { status: 200 as const, body: { url: `${appUrl}/privacy?deletion=${code}#hapus-data`, confirmation_code: code } };
}
