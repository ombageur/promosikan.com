import { createHmac, randomBytes } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { beforeEach, describe, expect, it } from "vitest";
import { PLAN_LIMITS } from "@shared/plans";
import { offeringSchema } from "@shared/schemas/catalog";
import { DEFAULT_AUTOMATION_SETTINGS } from "@shared/schemas/automation";
import type { LlmClient, LlmRequest, LlmResult } from "../ai/llm";
import { analyzePostHandler } from "../discovery/analyzePost";
import { DAILY_QUERY_BUDGET, type Enqueue, scheduledMonitoringHandler, syncThreadsNowHandler, syncWorkspaceKeywordsHandler } from "../discovery/monitoring";
import { db } from "../utils/admin";
import type { CallContext } from "../utils/context";
import { decryptSecret } from "../utils/crypto";
import { createDemoWorkspaceHandler } from "../workspace/createDemoWorkspace";
import { createWorkspaceHandler } from "../workspace/createWorkspace";
import { accountRef, secretRef, type ThreadsConfig } from "./account";
import { type ThreadsApi, ThreadsAuthError, type ThreadsPost, ThreadsRateLimitError } from "./api";
import {
  disconnectThreadsHandler,
  parseSignedRequest,
  refreshThreadsTokensHandler,
  startThreadsOAuthHandler,
  threadsDataDeletionHandler,
  threadsDeauthorizeHandler,
  threadsOAuthCallbackHandler,
} from "./oauth";

// Dijalankan di Firestore Emulator (npm run test:emulator). Threads API & Claude diganti tiruan.
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "demo-promosikan";
const user = (uid: string): CallContext => ({ uid, email: `${uid}@example.com`, emailVerified: true, displayName: uid });
const alice = user("alice");
const vic = user("vic");
const NOW = Date.UTC(2026, 9, 15, 3, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

const config: ThreadsConfig = {
  appId: "app-123",
  appSecret: "app-secret",
  encryptionKey: randomBytes(32).toString("base64"),
  appUrl: "https://promosikan.test",
};

class FakeThreads implements ThreadsApi {
  searches: string[] = [];
  results = new Map<string, ThreadsPost[]>();
  searchError: Error | null = null;
  refreshError: Error | null = null;
  exchangeError: Error | null = null;
  authorizeUrl({ appId, redirectUri, state }: { appId: string; redirectUri: string; state: string }) {
    return `https://threads.com/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=threads_basic,threads_keyword_search&response_type=code&state=${state}`;
  }
  async exchangeCode() {
    if (this.exchangeError) throw this.exchangeError;
    return { accessToken: "short-token", userId: "th-user-1" };
  }
  async exchangeLongLived() {
    return { accessToken: "LONG-SECRET-TOKEN", expiresInSeconds: 60 * 24 * 60 * 60 };
  }
  async refreshLongLived() {
    if (this.refreshError) throw this.refreshError;
    return { accessToken: "REFRESHED-TOKEN", expiresInSeconds: 60 * 24 * 60 * 60 };
  }
  async me() {
    return { id: "th-user-1", username: "publish.agency" };
  }
  async keywordSearch({ q }: { q: string }) {
    this.searches.push(q);
    if (this.searchError) throw this.searchError;
    return this.results.get(q) ?? [];
  }
}

class CountingLlm implements LlmClient {
  calls: LlmRequest[] = [];
  async complete(request: LlmRequest): Promise<LlmResult> {
    this.calls.push(request);
    return {
      kind: "ok",
      usage: { model: "claude-opus-5-5", inputTokens: 100, outputTokens: 50, cacheCreationTokens: 0, cacheReadTokens: 0 },
      json: {
        language: "id",
        isCommercialIntent: true,
        customerProblem: "Website sulit ditemukan",
        intent: "active_search",
        subScores: { buyingIntent: 90, productRelevance: 90, urgency: 70, problemClarity: 80, conversationSuitability: 90 },
        reasons: ["Mencari jasa SEO"],
        redFlags: [],
        matches: [{ offeringId: "seo", matchScore: 90, approach: "consultative", reason: "SEO" }],
      },
    };
  }
}

async function expectCode(promise: Promise<unknown>, code: HttpsError["code"]) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(HttpsError);
  expect((error as HttpsError).code).toBe(code);
}

let api: FakeThreads;
let workspaceId: string;
let queued: { queue: string; payload: Record<string, string> }[];
const enqueue: Enqueue = async (queue, payload) => {
  queued.push({ queue, payload });
};
const deps = (now = NOW) => ({ db, api, config, now: () => now });

async function connect() {
  const { url } = await startThreadsOAuthHandler(deps(), alice, { workspaceId });
  const state = new URL(url).searchParams.get("state")!;
  return threadsOAuthCallbackHandler(deps(), { code: "abc#_", state });
}

const post = (id: string, text: string, username = "pelanggan"): ThreadsPost => ({
  id,
  text,
  username,
  permalink: `https://www.threads.net/@${username}/post/${id}`,
  timestamp: new Date(NOW - 3600_000).toISOString(),
});

beforeEach(async () => {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: "DELETE" });
  api = new FakeThreads();
  queued = [];
  ({ workspaceId } = await createWorkspaceHandler(db, alice, { name: "Publish", businessName: "Publish Agency" }));
  const ws = db.collection("workspaces").doc(workspaceId);
  await ws.collection("members").doc("vic").set({ uid: "vic", role: "viewer", email: vic.email, displayName: "vic" });
  await ws.collection("offerings").doc("seo").set(offeringSchema.parse({ name: "SEO Management" }));
  await ws.collection("keywords").doc("k1").set({ term: "jasa seo", groupId: null, offeringId: "seo", isActive: true });
  await ws.collection("keywords").doc("k2").set({ term: "agency seo", groupId: null, offeringId: "seo", isActive: true });
  await ws.collection("keywords").doc("k3").set({ term: "nonaktif", groupId: null, offeringId: null, isActive: false });
  await ws.collection("settings").doc("automation").set({ ...DEFAULT_AUTOMATION_SETTINGS, monitoringEnabled: true });
});

describe("OAuth Threads", () => {
  it("start → callback: token tersimpan terenkripsi, akun terhubung, state sekali pakai", async () => {
    const { url } = await startThreadsOAuthHandler(deps(), alice, { workspaceId });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("scope")).toBe("threads_basic,threads_keyword_search");
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://promosikan.test/api/integrations/threads/callback");
    const state = parsed.searchParams.get("state")!;

    const redirect = await threadsOAuthCallbackHandler(deps(), { code: "abc#_", state });
    expect(redirect).toBe(`https://promosikan.test/w/${workspaceId}/integrations?threads=connected`);

    const account = await accountRef(db, workspaceId).get();
    expect(account.data()).toMatchObject({ status: "connected", username: "publish.agency", platformUserId: "th-user-1" });
    // Dokumen yang bisa dibaca client tidak memuat token dalam bentuk apa pun.
    expect(JSON.stringify(account.data())).not.toMatch(/TOKEN|token":/);
    const secret = await secretRef(db, workspaceId).get();
    expect(JSON.stringify(secret.data())).not.toContain("LONG-SECRET-TOKEN");
    expect(decryptSecret(secret.get("token"), config.encryptionKey)).toBe("LONG-SECRET-TOKEN");

    // State yang sama tidak bisa dipakai lagi.
    expect(await threadsOAuthCallbackHandler(deps(), { code: "abc", state })).toContain("threads=error&reason=state");
  });

  it("state kedaluwarsa, ditolak pengguna, atau penukaran gagal → kembali dengan status jelas", async () => {
    const start = async () => new URL((await startThreadsOAuthHandler(deps(), alice, { workspaceId })).url).searchParams.get("state")!;
    expect(await threadsOAuthCallbackHandler(deps(NOW + 11 * 60_000), { code: "x", state: await start() })).toContain("reason=state");
    expect(await threadsOAuthCallbackHandler(deps(), { error: "access_denied", state: await start() })).toContain("threads=denied");
    api.exchangeError = new Error("bad code");
    expect(await threadsOAuthCallbackHandler(deps(), { code: "x", state: await start() })).toContain("threads=error&reason=exchange");
    expect((await accountRef(db, workspaceId).get()).exists).toBe(false);
  });

  it("hanya Owner/Admin; workspace demo & server tanpa konfigurasi ditolak", async () => {
    await expectCode(startThreadsOAuthHandler(deps(), vic, { workspaceId }), "permission-denied");
    const demo = await createDemoWorkspaceHandler(db, alice);
    await expectCode(startThreadsOAuthHandler(deps(), alice, { workspaceId: demo.workspaceId }), "failed-precondition");
    await expectCode(startThreadsOAuthHandler({ ...deps(), config: { ...config, appSecret: "" } }, alice, { workspaceId }), "failed-precondition");
  });

  it("putuskan koneksi menghapus token dan akun", async () => {
    await connect();
    await expectCode(disconnectThreadsHandler(deps(), vic, { workspaceId }), "permission-denied");
    await disconnectThreadsHandler(deps(), alice, { workspaceId });
    expect((await secretRef(db, workspaceId).get()).exists).toBe(false);
    expect((await accountRef(db, workspaceId).get()).exists).toBe(false);
  });
});

describe("refresh token", () => {
  it("me-refresh token tua yang mendekati kedaluwarsa; token dicabut → status expired", async () => {
    await connect();
    const in45Days = NOW + 45 * DAY;
    expect(await refreshThreadsTokensHandler(deps(in45Days))).toEqual({ refreshed: 1, expired: 0 });
    expect(decryptSecret((await secretRef(db, workspaceId).get()).get("token"), config.encryptionKey)).toBe("REFRESHED-TOKEN");

    api.refreshError = new ThreadsAuthError("Error validating access token");
    expect(await refreshThreadsTokensHandler(deps(in45Days + 40 * DAY))).toEqual({ refreshed: 0, expired: 1 });
    expect((await accountRef(db, workspaceId).get()).get("status")).toBe("expired");
  });
});

describe("monitoring (DoD Fase 4)", () => {
  beforeEach(async () => {
    await connect();
    api.results.set("jasa seo", [post("1", "Butuh jasa SEO untuk toko online saya, ada rekomendasi?"), post("2", "pendek")]);
    api.results.set("agency seo", [post("1", "Butuh jasa SEO untuk toko online saya, ada rekomendasi?"), post("3", "Post milik sendiri tentang SEO kami", "publish.agency")]);
  });

  it("sinkron dua kali tidak membuat post atau antrean analisis ganda", async () => {
    const first = await syncWorkspaceKeywordsHandler({ ...deps(), enqueue }, { workspaceId });
    const second = await syncWorkspaceKeywordsHandler({ ...deps(NOW + 3600_000), enqueue }, { workspaceId });

    expect(first).toMatchObject({ queried: 2, created: 1, ownPostsSkipped: 1 });
    expect(second).toMatchObject({ queried: 2, created: 0 });
    const posts = await db.collection(`workspaces/${workspaceId}/socialPosts`).get();
    expect(posts.docs.map((d) => d.id)).toEqual(["threads_1"]); // pendek & milik sendiri dibuang
    expect(posts.docs[0]!.get("matchedKeywords")).toEqual(["jasa seo", "agency seo"]);
    expect(queued).toEqual([{ queue: "analyzePost", payload: { workspaceId, postId: "threads_1" } }]);
    expect(api.searches).not.toContain("nonaktif");
    expect((await db.collection(`workspaces/${workspaceId}/monitoringRuns`).get()).size).toBe(2);
  });

  it("analisis post idempoten: task terkirim dua kali → satu peluang, satu panggilan AI", async () => {
    await syncWorkspaceKeywordsHandler({ ...deps(), enqueue }, { workspaceId });
    const llm = new CountingLlm();
    const payload = { workspaceId, postId: "threads_1" };
    const first = await analyzePostHandler({ db, llm }, payload, NOW);
    const again = await analyzePostHandler({ db, llm }, payload, NOW);

    expect(first).toMatchObject({ opportunityId: "threads_1", band: "high" });
    expect(again).toEqual({ skipped: "duplicate" });
    expect(llm.calls).toHaveLength(1);
    const opp = await db.doc(`workspaces/${workspaceId}/opportunities/threads_1`).get();
    expect(opp.get("post")).toMatchObject({ platform: "threads", authorHandle: "@pelanggan", matchedKeyword: "jasa seo" });
    expect(opp.get("post.permalink")).toContain("threads.net");
    const stored = await db.doc(`workspaces/${workspaceId}/socialPosts/threads_1`).get();
    expect(stored.get("analysisStatus")).toBe("done");
    expect((stored.get("expiresAt") as Timestamp).toMillis()).toBe(NOW + 180 * DAY);
  });

  it("kuota AI habis → post ditandai, Claude tidak dipanggil", async () => {
    await syncWorkspaceKeywordsHandler({ ...deps(), enqueue }, { workspaceId });
    const month = new Date(NOW).toISOString().slice(0, 7);
    await db.doc(`workspaces/${workspaceId}/usage/${month}`).set({ aiCalls: PLAN_LIMITS.free.aiCallsPerMonth });
    const llm = new CountingLlm();
    expect(await analyzePostHandler({ db, llm }, { workspaceId, postId: "threads_1" }, NOW)).toEqual({ skipped: "quota" });
    expect(llm.calls).toHaveLength(0);
  });

  it("token dicabut di tengah sinkron → status expired, monitoring berhenti", async () => {
    api.searchError = new ThreadsAuthError("Session has been invalidated");
    expect(await syncWorkspaceKeywordsHandler({ ...deps(), enqueue }, { workspaceId })).toMatchObject({ skipped: true, reason: "auth" });
    expect((await accountRef(db, workspaceId).get()).get("status")).toBe("expired");
    await accountRef(db, workspaceId).update({ nextSyncAt: Timestamp.fromMillis(NOW) });
    expect(await scheduledMonitoringHandler({ db, enqueue }, NOW)).toEqual({ due: 0, enqueued: 0 });
  });

  it("rate limit & anggaran kuota harian menghentikan pencarian", async () => {
    api.searchError = new ThreadsRateLimitError("Application request limit reached");
    expect(await syncWorkspaceKeywordsHandler({ ...deps(), enqueue }, { workspaceId })).toMatchObject({ queried: 1, stopReason: "rate_limit" });

    api.searchError = null;
    api.searches = [];
    await accountRef(db, workspaceId).update({ quota: { day: new Date(NOW).toISOString().slice(0, 10), queries: DAILY_QUERY_BUDGET } });
    expect(await syncWorkspaceKeywordsHandler({ ...deps(), enqueue }, { workspaceId })).toMatchObject({ queried: 0, stopReason: "budget" });
    expect(api.searches).toHaveLength(0);
  });

  it("scheduler: hanya akun terhubung yang jatuh tempo & monitoring aktif yang dikirim ke antrean", async () => {
    expect(await scheduledMonitoringHandler({ db, enqueue }, NOW)).toEqual({ due: 1, enqueued: 1 });
    expect(queued).toEqual([{ queue: "syncWorkspaceKeywords", payload: { workspaceId } }]);
    // Sudah diklaim: tidak dikirim lagi sampai interval berikutnya.
    expect(await scheduledMonitoringHandler({ db, enqueue }, NOW + 60_000)).toEqual({ due: 0, enqueued: 0 });

    await db.doc(`workspaces/${workspaceId}/settings/automation`).update({ monitoringEnabled: false });
    expect(await scheduledMonitoringHandler({ db, enqueue }, NOW + 2 * 3600_000)).toEqual({ due: 1, enqueued: 0 });
    // Monitoring nonaktif dicek lagi di putaran berikutnya (15 menit), bukan 1 jam.
    const next = (await accountRef(db, workspaceId).get()).get("nextSyncAt") as Timestamp;
    expect(next.toMillis()).toBe(NOW + 2 * 3600_000 + 15 * 60_000);
  });
});

describe("callback Meta (signed_request)", () => {
  const sign = (payload: object, secret = config.appSecret) => {
    const body = Buffer.from(JSON.stringify({ algorithm: "HMAC-SHA256", ...payload })).toString("base64url");
    return `${createHmac("sha256", secret).update(body).digest("base64url")}.${body}`;
  };

  it("memverifikasi tanda tangan", () => {
    expect(parseSignedRequest(sign({ user_id: "th-user-1" }), config.appSecret)).toEqual({ user_id: "th-user-1" });
    expect(parseSignedRequest(sign({ user_id: "th-user-1" }, "salah"), config.appSecret)).toBeNull();
    expect(parseSignedRequest("bukan-format", config.appSecret)).toBeNull();
  });

  it("deauthorize mencabut token; penghapusan data mengembalikan URL & kode konfirmasi", async () => {
    await connect();
    expect((await threadsDeauthorizeHandler(deps(), { signed_request: "x.y" })).status).toBe(400);
    expect((await threadsDeauthorizeHandler(deps(), { signed_request: sign({ user_id: "th-user-1" }) })).status).toBe(200);
    expect((await secretRef(db, workspaceId).get()).exists).toBe(false);
    expect((await accountRef(db, workspaceId).get()).get("status")).toBe("revoked");

    const deletion = await threadsDataDeletionHandler(deps(), { signed_request: sign({ user_id: "th-user-1" }) });
    expect(deletion.status).toBe(200);
    const body = deletion.body as { url: string; confirmation_code: string };
    expect(body.url).toContain(`deletion=${body.confirmation_code}`);
    expect((await db.doc(`dataDeletionRequests/${body.confirmation_code}`).get()).get("status")).toBe("completed");
  });
});

describe("sinkron manual", () => {
  it("Owner/Admin bisa memicu sinkron; dibatasi sekali per 5 menit", async () => {
    await connect();
    await expectCode(syncThreadsNowHandler({ db, enqueue, now: () => NOW }, vic, { workspaceId }), "permission-denied");
    expect(await syncThreadsNowHandler({ db, enqueue, now: () => NOW }, alice, { workspaceId })).toEqual({ queued: true });
    expect(queued).toEqual([{ queue: "syncWorkspaceKeywords", payload: { workspaceId } }]);
    await expectCode(syncThreadsNowHandler({ db, enqueue, now: () => NOW + 60_000 }, alice, { workspaceId }), "resource-exhausted");
    expect(await syncThreadsNowHandler({ db, enqueue, now: () => NOW + 6 * 60_000 }, alice, { workspaceId })).toEqual({ queued: true });
  });

  it("ditolak untuk akun belum terhubung/kedaluwarsa dan workspace demo", async () => {
    await expectCode(syncThreadsNowHandler({ db, enqueue }, alice, { workspaceId }), "failed-precondition");
    await connect();
    await accountRef(db, workspaceId).update({ status: "expired" });
    await expectCode(syncThreadsNowHandler({ db, enqueue }, alice, { workspaceId }), "failed-precondition");
    expect(queued).toEqual([]);
  });
});
