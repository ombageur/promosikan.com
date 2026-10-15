import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError } from "firebase-functions/v2/https";
import { analysisStrictSchema } from "@shared/schemas/ai";
import { type AiDeps, buildOpportunityFields, refusedOpportunityFields } from "../ai/analyze";
import { loadAiContext, narrowCatalog } from "../ai/context";
import { ANALYZE_PROMPT_VERSION, buildAnalyzeRequest } from "../ai/prompts/analyze";
import { runAi } from "../ai/run";
import { reserveAiCall, SYSTEM_UID } from "../ai/usage";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Retensi (SPEC §14): post tidak memenuhi syarat 30 hari, lainnya 180 hari (TTL Firestore pada `expiresAt`). */
export const RETENTION_DAYS = { notQualified: 30, other: 180 } as const;

export type AnalyzePostPayload = { workspaceId: string; postId: string };

/**
 * Task queue: analisis satu post hasil monitoring. Idempoten — ID peluang = ID post, sehingga
 * pengiriman ulang task (retry Cloud Tasks) tidak membuat analisis/biaya ganda.
 */
export async function analyzePostHandler(deps: AiDeps, payload: AnalyzePostPayload, now = Date.now()) {
  const ws = deps.db.collection("workspaces").doc(payload.workspaceId);
  const postRef = ws.collection("socialPosts").doc(payload.postId);
  const oppRef = ws.collection("opportunities").doc(payload.postId);

  const [post, existing] = await Promise.all([postRef.get(), oppRef.get()]);
  if (!post.exists) return { skipped: "missing" as const };
  if (existing.exists || post.get("analysisStatus") === "done") {
    if (post.get("analysisStatus") !== "done") await postRef.update({ analysisStatus: "done" });
    return { skipped: "duplicate" as const };
  }

  const aiContext = await loadAiContext(deps.db, payload.workspaceId);
  try {
    await reserveAiCall(deps.db, payload.workspaceId, SYSTEM_UID, aiContext.plan, new Date(now));
  } catch (error) {
    if (error instanceof HttpsError && error.code === "resource-exhausted") {
      await postRef.update({ analysisStatus: "quota_exceeded" });
      return { skipped: "quota" as const };
    }
    throw error;
  }

  const text = String(post.get("text") ?? "");
  const catalog = narrowCatalog(aiContext.catalog, text);
  let outcome;
  try {
    outcome = await runAi(
      deps,
      { workspaceId: payload.workspaceId, route: "analyze", promptVersion: ANALYZE_PROMPT_VERSION },
      buildAnalyzeRequest({ profile: aiContext.profile, catalog, text }),
      analysisStrictSchema,
    );
  } catch (error) {
    // Output tidak valid tidak akan membaik dengan retry; gangguan sementara (unavailable) di-retry task queue.
    if (error instanceof HttpsError && error.code === "internal") {
      await postRef.update({ analysisStatus: "failed" });
      logger.warn("Analisis post gagal", { ...payload });
      return { skipped: "failed" as const };
    }
    throw error;
  }

  const fields = outcome.kind === "ok" ? buildOpportunityFields(outcome.data, catalog, aiContext.settings.minMatchScore) : refusedOpportunityFields();
  const retention = fields.band === "not_qualified" ? RETENTION_DAYS.notQualified : RETENTION_DAYS.other;
  const expiresAt = Timestamp.fromMillis(now + retention * DAY_MS);
  const keywords = (post.get("matchedKeywords") as string[] | undefined) ?? [];

  await deps.db.runTransaction(async (tx) => {
    if ((await tx.get(oppRef)).exists) return;
    tx.create(oppRef, {
      post: {
        id: post.id,
        platform: "threads",
        authorName: String(post.get("authorHandle") ?? ""),
        authorHandle: String(post.get("authorHandle") ?? ""),
        text,
        postedAt: String(post.get("postedAt") ?? new Date(now).toISOString()),
        matchedKeyword: keywords[0] ?? "",
        permalink: post.get("permalink") ?? null,
      },
      ...fields,
      status: "new",
      source: "monitoring",
      promptVersion: ANALYZE_PROMPT_VERSION,
      model: outcome.model,
      createdBy: SYSTEM_UID,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
    });
    tx.update(postRef, { analysisStatus: "done", expiresAt });
  });
  return { opportunityId: oppRef.id, band: fields.band };
}
