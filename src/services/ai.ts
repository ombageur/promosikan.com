import type { AnalyzeConversationInput, GenerateReplyInput } from "@shared/schemas/ai";
import type { OpportunityBand } from "@shared/scoring";
import { callable } from "@/lib/firebase/callable";

type Quality = { passed: boolean; notes: string[] };

export const analyzeConversation = callable<
  AnalyzeConversationInput,
  { opportunityId: string; score: number; band: OpportunityBand; analysisStatus: "ok" | "refused"; matched: boolean }
>("analyzeConversation");

export const generateReply = callable<GenerateReplyInput, { draftId: string; text: string; quality: Quality }>("generateReply");

export const validateReply = callable<{ workspaceId: string; draftId: string }, { quality: Quality }>("validateReply");

export type AiUsage = { aiCalls: number; costUsd: number; inputTokens: number; outputTokens: number; cacheReadTokens: number };

/** Pemakaian AI bulan berjalan (UTC), dibaca Owner/Admin (rules: audit.read). */
export async function getAiUsage(workspaceId: string, now = new Date()): Promise<AiUsage> {
  const { doc, getDoc } = await import("firebase/firestore");
  const { db } = await import("@/lib/firebase/firestore");
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const snap = await getDoc(doc(db, "workspaces", workspaceId, "usage", month));
  const d = snap.data() ?? {};
  return {
    aiCalls: Number(d.aiCalls ?? 0),
    costUsd: Number(d.costUsd ?? 0),
    inputTokens: Number(d.inputTokens ?? 0),
    outputTokens: Number(d.outputTokens ?? 0),
    cacheReadTokens: Number(d.cacheReadTokens ?? 0),
  };
}
