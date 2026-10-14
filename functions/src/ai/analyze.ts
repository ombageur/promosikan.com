import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { type AnalysisOutput, analysisStrictSchema, analyzeConversationInput } from "@shared/schemas/ai";
import { opportunityScore } from "@shared/scoring";
import type { OfferingMatch } from "@shared/types/intelligence";
import { type CallContext, parseInput } from "../utils/context";
import { requirePermission } from "../utils/membership";
import { loadAiContext, narrowCatalog } from "./context";
import type { LlmClient } from "./llm";
import type { CatalogItem } from "./prompts/common";
import { ANALYZE_PROMPT_VERSION, buildAnalyzeRequest } from "./prompts/analyze";
import { runAi } from "./run";
import { reserveAiCall } from "./usage";

export type AiDeps = { db: Firestore; llm: LlmClient };

const MAX_MATCHES = 3;

/**
 * Ubah output AI menjadi data peluang yang aman disimpan:
 * - skor akhir dihitung di kode (shared/scoring), bukan oleh model;
 * - match dengan ID di luar katalog dibuang (anti-halusinasi);
 * - match di bawah ambang workspace dibuang (tidak memaksakan pencocokan);
 * - red flag → tidak ada match (tidak ditawari jasa).
 */
export function buildOpportunityFields(analysis: AnalysisOutput, catalog: CatalogItem[], minMatchScore: number) {
  const byId = new Map(catalog.map((o) => [o.id, o]));
  const seen = new Set<string>();
  const matches: OfferingMatch[] =
    analysis.redFlags.length > 0
      ? []
      : analysis.matches
          .filter((m) => byId.has(m.offeringId) && m.matchScore >= minMatchScore && !seen.has(m.offeringId) && seen.add(m.offeringId))
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, MAX_MATCHES)
          .map((m) => ({ ...m, offeringName: byId.get(m.offeringId)!.name }));

  const { score, band } = opportunityScore(analysis.subScores);
  return {
    intent: analysis.intent,
    customerProblem: analysis.customerProblem,
    subScores: analysis.subScores,
    score,
    band,
    reasons: analysis.reasons,
    redFlags: analysis.redFlags,
    matches,
    analysisStatus: "ok" as const,
  };
}

/** Peluang untuk post yang ditolak AI: tidak dinilai, ditandai untuk review manual. */
export function refusedOpportunityFields() {
  const subScores = { buyingIntent: 0, productRelevance: 0, urgency: 0, problemClarity: 0, conversationSuitability: 0 };
  const { score, band } = opportunityScore(subScores);
  return {
    intent: "general_discussion" as const,
    customerProblem: "Tidak dapat dianalisis otomatis",
    subScores,
    score,
    band,
    reasons: ["AI menolak menganalisis post ini. Tinjau secara manual."],
    redFlags: ["Ditolak oleh AI — perlu review manual"],
    matches: [],
    analysisStatus: "refused" as const,
  };
}

/** Analisis Manual (SPEC §8): pengguna menempelkan teks post, hasilnya disimpan sebagai peluang. */
export async function analyzeConversationHandler(deps: AiDeps, ctx: CallContext, data: unknown) {
  const input = parseInput(analyzeConversationInput, data);
  await requirePermission(deps.db, input.workspaceId, ctx.uid, "ai.use");
  const aiContext = await loadAiContext(deps.db, input.workspaceId);
  await reserveAiCall(deps.db, input.workspaceId, ctx.uid, aiContext.plan);

  const catalog = narrowCatalog(aiContext.catalog, input.text);
  const outcome = await runAi(
    deps,
    { workspaceId: input.workspaceId, route: "analyze", promptVersion: ANALYZE_PROMPT_VERSION },
    buildAnalyzeRequest({ profile: aiContext.profile, catalog, text: input.text }),
    analysisStrictSchema,
  );

  const fields =
    outcome.kind === "ok" ? buildOpportunityFields(outcome.data, catalog, aiContext.settings.minMatchScore) : refusedOpportunityFields();

  const ref = deps.db.collection("workspaces").doc(input.workspaceId).collection("opportunities").doc();
  await ref.create({
    post: {
      id: `manual_${ref.id}`,
      platform: "manual",
      authorName: input.authorHandle || "Input manual",
      authorHandle: input.authorHandle,
      text: input.text,
      postedAt: new Date().toISOString(),
      matchedKeyword: "",
      permalink: input.permalink || null,
    },
    ...fields,
    status: "new",
    source: "manual",
    promptVersion: ANALYZE_PROMPT_VERSION,
    model: outcome.model,
    createdBy: ctx.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { opportunityId: ref.id, score: fields.score, band: fields.band, analysisStatus: fields.analysisStatus, matched: fields.matches.length > 0 };
}
