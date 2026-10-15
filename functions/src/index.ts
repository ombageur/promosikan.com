import { defineSecret, defineString } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";
import { getFunctions } from "firebase-admin/functions";
import { onCall, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { analyzeConversationHandler } from "./ai/analyze";
import { claudeClient } from "./ai/llm";
import { analyzePostHandler } from "./discovery/analyzePost";
import { type Enqueue, scheduledMonitoringHandler, syncWorkspaceKeywordsHandler } from "./discovery/monitoring";
import { threadsApi } from "./threads/api";
import {
  disconnectThreadsHandler,
  refreshThreadsTokensHandler,
  startThreadsOAuthHandler,
  threadsDataDeletionHandler,
  threadsDeauthorizeHandler,
  threadsOAuthCallbackHandler,
} from "./threads/oauth";
import { generateReplyHandler, validateReplyHandler } from "./ai/reply";
import { db } from "./utils/admin";
import { callableOptions, requireAuth } from "./utils/context";
import { createDemoWorkspaceHandler } from "./workspace/createDemoWorkspace";
import { createWorkspaceHandler } from "./workspace/createWorkspace";
import { acceptInvitationHandler, inviteMemberHandler, revokeInvitationHandler } from "./workspace/invitations";
import { removeMemberHandler, transferOwnershipHandler, updateMemberRoleHandler } from "./workspace/members";

// Region final masih keputusan terbuka #5 (SPEC §26).
const REGION = "asia-southeast2";
setGlobalOptions({ region: REGION, maxInstances: 10 });

/** URL frontend untuk link undangan. Set lewat functions/.env.<project> (APP_URL=https://promosikan.com). */
const appUrl = defineString("APP_URL", { default: "http://localhost:5173" });

/** Claude API (SPEC §17). Key hanya di Secret Manager; model bisa diganti lewat functions/.env.<project>. */
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
const claudeModel = defineString("CLAUDE_MODEL", { default: "claude-opus-5-5" });
const aiOptions = { ...callableOptions, secrets: [anthropicApiKey], timeoutSeconds: 120, memory: "512MiB" as const };
const aiDeps = () => ({ db, llm: claudeClient(anthropicApiKey.value(), claudeModel.value()) });

/** Health check untuk memastikan deploy & emulator berjalan. Tidak mengakses data. */
export const health = onRequest((_req, res) => {
  res.json({ status: "ok", service: "promosikan-functions" });
});

export const createWorkspace = onCall(callableOptions, (req) => createWorkspaceHandler(db, requireAuth(req), req.data));
export const createDemoWorkspace = onCall(callableOptions, (req) => createDemoWorkspaceHandler(db, requireAuth(req)));
export const inviteMember = onCall(callableOptions, (req) =>
  inviteMemberHandler(db, requireAuth(req), req.data, { appUrl: appUrl.value() }),
);
export const acceptInvitation = onCall(callableOptions, (req) => acceptInvitationHandler(db, requireAuth(req), req.data));
export const revokeInvitation = onCall(callableOptions, (req) => revokeInvitationHandler(db, requireAuth(req), req.data));
export const updateMemberRole = onCall(callableOptions, (req) => updateMemberRoleHandler(db, requireAuth(req), req.data));
export const removeMember = onCall(callableOptions, (req) => removeMemberHandler(db, requireAuth(req), req.data));
export const transferOwnership = onCall(callableOptions, (req) => transferOwnershipHandler(db, requireAuth(req), req.data));

export const analyzeConversation = onCall(aiOptions, (req) => analyzeConversationHandler(aiDeps(), requireAuth(req), req.data));
export const generateReply = onCall(aiOptions, (req) => generateReplyHandler(aiDeps(), requireAuth(req), req.data));
export const validateReply = onCall(aiOptions, (req) => validateReplyHandler(aiDeps(), requireAuth(req), req.data));

// ---------- Threads (Fase 4) ----------
const threadsAppId = defineString("THREADS_APP_ID", { default: "" });
const threadsAppSecret = defineSecret("THREADS_APP_SECRET");
const tokenEncryptionKey = defineSecret("TOKEN_ENCRYPTION_KEY");
const threadsSecrets = [threadsAppSecret, tokenEncryptionKey];
const threadsDeps = () => ({
  db,
  api: threadsApi(),
  config: {
    appId: threadsAppId.value(),
    appSecret: threadsAppSecret.value(),
    encryptionKey: tokenEncryptionKey.value(),
    appUrl: appUrl.value(),
  },
});

/** Kirim ke task queue (Cloud Tasks) di region functions. */
const enqueue: Enqueue = async (queue, payload) => {
  await getFunctions().taskQueue(`locations/${REGION}/functions/${queue}`).enqueue(payload);
};

export const startThreadsOAuth = onCall({ ...callableOptions, secrets: threadsSecrets }, (req) =>
  startThreadsOAuthHandler(threadsDeps(), requireAuth(req), req.data),
);
export const disconnectThreads = onCall({ ...callableOptions, secrets: threadsSecrets }, (req) =>
  disconnectThreadsHandler(threadsDeps(), requireAuth(req), req.data),
);

/** Redirect OAuth (Hosting: /api/integrations/threads/callback → function ini). */
export const threadsOAuthCallback = onRequest({ secrets: threadsSecrets }, async (req, res) => {
  res.redirect(302, await threadsOAuthCallbackHandler(threadsDeps(), req.query as Record<string, unknown>));
});

/** Callback Meta saat pengguna mencabut akses aplikasi (Hosting: /api/integrations/threads/deauthorize). */
export const threadsDeauthorize = onRequest({ secrets: threadsSecrets }, async (req, res) => {
  if (req.method !== "POST") return void res.status(405).end();
  const result = await threadsDeauthorizeHandler(threadsDeps(), (req.body ?? {}) as Record<string, unknown>);
  res.status(result.status).json(result.body);
});

/** Callback Meta permintaan penghapusan data (Hosting: /api/integrations/threads/data-deletion). */
export const threadsDataDeletion = onRequest({ secrets: threadsSecrets }, async (req, res) => {
  if (req.method !== "POST") return void res.status(405).end();
  const result = await threadsDataDeletionHandler(threadsDeps(), (req.body ?? {}) as Record<string, unknown>);
  res.status(result.status).json(result.body);
});

export const refreshThreadsTokens = onSchedule({ schedule: "every day 03:00", timeZone: "Asia/Jakarta", secrets: threadsSecrets }, async () => {
  await refreshThreadsTokensHandler(threadsDeps());
});

export const scheduledSocialMonitoring = onSchedule({ schedule: "every 15 minutes", timeZone: "Asia/Jakarta" }, async () => {
  await scheduledMonitoringHandler({ db, enqueue });
});

export const syncWorkspaceKeywords = onTaskDispatched(
  {
    secrets: threadsSecrets,
    retryConfig: { maxAttempts: 3, minBackoffSeconds: 60 },
    rateLimits: { maxConcurrentDispatches: 5 },
    timeoutSeconds: 300,
  },
  async (req) => {
    await syncWorkspaceKeywordsHandler({ ...threadsDeps(), enqueue }, req.data as { workspaceId: string });
  },
);

export const analyzePost = onTaskDispatched(
  {
    secrets: [anthropicApiKey],
    retryConfig: { maxAttempts: 3, minBackoffSeconds: 30 },
    rateLimits: { maxConcurrentDispatches: 5 },
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (req) => {
    await analyzePostHandler(aiDeps(), req.data as { workspaceId: string; postId: string });
  },
);
