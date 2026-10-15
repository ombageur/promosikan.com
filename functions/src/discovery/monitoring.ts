import { FieldValue, type Firestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { automationSettingsSchema, DEFAULT_AUTOMATION_SETTINGS } from "@shared/schemas/automation";
import { accountRef, loadToken, setAccountStatus, type ThreadsDeps } from "../threads/account";
import { type ThreadsPost, ThreadsApiError, ThreadsAuthError, ThreadsRateLimitError } from "../threads/api";
import { RETENTION_DAYS } from "./analyzePost";

const MINUTE = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE;

/**
 * Kuota keyword search Threads: 2.200 query/pengguna/24 jam, dibagi dengan aplikasi lain milik akun
 * itu (docs/THREADS_API_NOTES.md §1). Promosikan.com memakai paling banyak 1.500/hari per akun.
 */
export const DAILY_QUERY_BUDGET = 1500;
export const MAX_KEYWORDS_PER_RUN = 100;
export const MIN_POST_CHARS = 15;
/** Batas bawah `since` dari dokumentasi keyword search. */
const SEARCH_EPOCH = 1688540400;

export type Enqueue = (queue: "syncWorkspaceKeywords" | "analyzePost", payload: Record<string, string>) => Promise<void>;

const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

async function intervalMinutes(db: Firestore, workspaceId: string) {
  const snap = await db.collection("workspaces").doc(workspaceId).collection("settings").doc("automation").get();
  const settings = snap.exists ? automationSettingsSchema.parse(snap.data() ?? {}) : DEFAULT_AUTOMATION_SETTINGS;
  return { enabled: settings.monitoringEnabled, minutes: settings.monitoringIntervalMinutes };
}

/**
 * Scheduler (tiap 15 menit): satu fan-out untuk semua workspace. Akun yang jatuh tempo diklaim
 * dengan menggeser `nextSyncAt` dulu, lalu dikirim ke task queue (tidak ada scheduler per workspace).
 */
export async function scheduledMonitoringHandler(deps: { db: Firestore; enqueue: Enqueue }, now = Date.now()) {
  const due = await deps.db
    .collectionGroup("socialAccounts")
    .where("status", "==", "connected")
    .where("nextSyncAt", "<=", Timestamp.fromMillis(now))
    .limit(100)
    .get();

  let enqueued = 0;
  for (const account of due.docs) {
    const workspace = account.ref.parent.parent;
    if (!workspace) continue;
    const ws = await workspace.get();
    const { enabled, minutes } = await intervalMinutes(deps.db, workspace.id);
    // Workspace demo tidak pernah memanggil Threads; monitoring nonaktif dicek lagi 1 jam kemudian.
    const skip = ws.get("isDemo") === true || !enabled;
    await account.ref.update({ nextSyncAt: Timestamp.fromMillis(now + (skip ? 60 : minutes) * MINUTE) });
    if (skip) continue;
    await deps.enqueue("syncWorkspaceKeywords", { workspaceId: workspace.id });
    enqueued++;
  }
  return { due: due.size, enqueued };
}

type Found = { post: ThreadsPost; keywords: Set<string> };

/**
 * Task: cari keyword aktif di Threads, simpan post baru (ID deterministik `threads_{id}`, `create()`),
 * lalu kirim analisis per post. Aman dijalankan ulang: post yang sudah ada tidak dianalisis lagi.
 */
export async function syncWorkspaceKeywordsHandler(deps: ThreadsDeps & { enqueue: Enqueue }, payload: { workspaceId: string }) {
  const now = deps.now?.() ?? Date.now();
  const { workspaceId } = payload;
  const ws = deps.db.collection("workspaces").doc(workspaceId);
  const [workspace, account] = await Promise.all([ws.get(), accountRef(deps.db, workspaceId).get()]);
  if (!account.exists || account.get("status") !== "connected" || workspace.get("isDemo") === true) {
    return { skipped: true };
  }

  const token = await loadToken(deps, workspaceId);
  if (!token) {
    await setAccountStatus(deps.db, workspaceId, "error", "Token tidak ditemukan. Hubungkan ulang akun.");
    return { skipped: true };
  }

  const keywordSnap = await ws.collection("keywords").where("isActive", "==", true).limit(MAX_KEYWORDS_PER_RUN).get();
  const quota = (account.get("quota") as { day?: string; queries?: number } | undefined) ?? {};
  let used = quota.day === utcDay(now) ? Number(quota.queries ?? 0) : 0;
  const lastSync = (account.get("lastSyncAt") as Timestamp | null)?.toMillis() ?? now - DAY_MS;
  const since = Math.max(SEARCH_EPOCH, Math.floor(lastSync / 1000) - 60);
  const ownUsername = String(account.get("username") ?? "").toLowerCase();

  const found = new Map<string, Found>();
  const errors: string[] = [];
  let queried = 0;
  let stopReason: string | null = null;

  for (const keyword of keywordSnap.docs) {
    if (used >= DAILY_QUERY_BUDGET) {
      stopReason = "budget";
      break;
    }
    const term = String(keyword.get("term"));
    try {
      used++;
      queried++;
      const posts = await deps.api.keywordSearch({ accessToken: token, q: term, since });
      for (const post of posts) {
        const entry = found.get(post.id) ?? { post, keywords: new Set<string>() };
        entry.keywords.add(term);
        found.set(post.id, entry);
      }
    } catch (error) {
      if (error instanceof ThreadsAuthError) {
        await setAccountStatus(deps.db, workspaceId, "expired", "Akses Threads tidak valid lagi. Hubungkan ulang akun.");
        return { skipped: true, reason: "auth" };
      }
      if (error instanceof ThreadsRateLimitError) {
        stopReason = "rate_limit";
        break;
      }
      errors.push(`${term}: ${error instanceof ThreadsApiError ? error.message : String(error)}`.slice(0, 200));
    }
  }

  // Prefilter murah sebelum AI (SPEC §8): teks terlalu pendek & post milik akun sendiri dibuang.
  const candidates = [...found.values()].filter(
    ({ post }) => (post.text ?? "").trim().length >= MIN_POST_CHARS && (post.username ?? "").toLowerCase() !== ownUsername,
  );

  let created = 0;
  for (const { post, keywords } of candidates) {
    const ref = ws.collection("socialPosts").doc(`threads_${post.id}`);
    try {
      await ref.create({
        platform: "threads",
        platformPostId: post.id,
        text: (post.text ?? "").slice(0, 2000),
        authorHandle: post.username ? `@${post.username}` : "",
        permalink: post.permalink ?? null,
        postedAt: post.timestamp ? new Date(post.timestamp).toISOString() : new Date(now).toISOString(),
        isReply: post.is_reply ?? false,
        matchedKeywords: [...keywords],
        analysisStatus: "pending",
        fetchedAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(now + RETENTION_DAYS.notQualified * DAY_MS),
      });
    } catch (error) {
      // ALREADY_EXISTS (gRPC 6): post sudah pernah disimpan → bukan post baru.
      if ((error as { code?: number }).code === 6) continue;
      throw error;
    }
    created++;
    await deps.enqueue("analyzePost", { workspaceId, postId: ref.id });
  }

  await accountRef(deps.db, workspaceId).update({
    lastSyncAt: Timestamp.fromMillis(now),
    quota: { day: utcDay(now), queries: used },
    lastError: stopReason === "rate_limit" ? "Batas Threads API tercapai; dilanjutkan pada jadwal berikutnya." : (errors[0] ?? null),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await ws.collection("monitoringRuns").add({
    startedAt: Timestamp.fromMillis(now),
    finishedAt: FieldValue.serverTimestamp(),
    keywordsQueried: queried,
    postsFound: found.size,
    postsNew: created,
    stopReason,
    errors: errors.slice(0, 10),
    quotaUsedToday: used,
    expiresAt: Timestamp.fromMillis(now + 30 * DAY_MS),
  });
  if (errors.length > 0) logger.warn("Sinkron Threads selesai dengan galat", { workspaceId, errors: errors.length });
  return { queried, found: found.size, created, stopReason };
}
