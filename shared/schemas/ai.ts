import { z } from "zod";
import { REPLY_STYLES } from "./automation";
import { INTENTS } from "../types/intelligence";

/**
 * Kontrak output Claude (SPEC §9–§11). Skema "model" dikirim sebagai structured output
 * (bentuk saja); skema "strict" memvalidasi ulang rentang & aturan bisnis sebelum disimpan.
 */
const score = z.number().int().min(0).max(100);

export const analysisModelSchema = z.object({
  language: z.string().describe("Kode bahasa post, mis. id atau en"),
  isCommercialIntent: z.boolean(),
  customerProblem: z.string().describe("Masalah pelanggan, ringkas, Bahasa Indonesia"),
  intent: z.enum(INTENTS),
  subScores: z.object({
    buyingIntent: z.number().int(),
    productRelevance: z.number().int(),
    urgency: z.number().int(),
    problemClarity: z.number().int(),
    conversationSuitability: z.number().int(),
  }),
  reasons: z.array(z.string()).describe("Alasan singkat per sub-skor, Bahasa Indonesia"),
  redFlags: z.array(z.string()).describe("Topik sensitif yang membuat post tidak pantas ditawari jasa"),
  matches: z
    .array(
      z.object({
        offeringId: z.string().describe("ID persis dari katalog"),
        matchScore: z.number().int(),
        approach: z.enum(REPLY_STYLES),
        reason: z.string(),
      }),
    )
    .describe("Maksimal 3 kandidat; kosong jika tidak ada yang relevan"),
});

export const analysisStrictSchema = analysisModelSchema.extend({
  customerProblem: z.string().trim().min(1).max(300),
  subScores: z.object({
    buyingIntent: score,
    productRelevance: score,
    urgency: score,
    problemClarity: score,
    conversationSuitability: score,
  }),
  reasons: z.array(z.string().trim().min(1).max(300)).min(1).max(8),
  redFlags: z.array(z.string().trim().min(1).max(200)).max(5),
  matches: z
    .array(
      z.object({
        offeringId: z.string().min(1).max(128),
        matchScore: score,
        approach: z.enum(REPLY_STYLES),
        reason: z.string().trim().min(1).max(300),
      }),
    )
    .max(5),
});
export type AnalysisOutput = z.infer<typeof analysisStrictSchema>;

export const REPLY_MAX_CHARS = 300;

export const replyModelSchema = z.object({
  text: z.string().describe(`Teks balasan siap kirim, maksimal ${REPLY_MAX_CHARS} karakter`),
});
export const replyStrictSchema = z.object({ text: z.string().trim().min(1).max(REPLY_MAX_CHARS) });

export const validationModelSchema = z.object({
  passed: z.boolean(),
  issues: z.array(z.string()).describe("Masalah yang ditemukan, Bahasa Indonesia; kosong jika lolos"),
});
export const validationStrictSchema = z.object({
  passed: z.boolean(),
  issues: z.array(z.string().trim().min(1).max(300)).max(8),
});
export type ValidationOutput = z.infer<typeof validationStrictSchema>;

// ---------- Input callable ----------
const workspaceId = z.string().min(1).max(128);

export const POST_MAX_CHARS = 2000;

export const analyzeConversationInput = z.object({
  workspaceId,
  text: z.string().trim().min(10, "Teks terlalu pendek untuk dianalisis").max(POST_MAX_CHARS, `Maksimal ${POST_MAX_CHARS} karakter`),
  authorHandle: z.string().trim().max(100).default(""),
  permalink: z.union([z.url({ protocol: /^https?$/ }), z.literal("")]).default(""),
});
export type AnalyzeConversationInput = z.input<typeof analyzeConversationInput>;

export const REPLY_ADJUSTMENTS = ["shorter", "regenerate"] as const;

export const generateReplyInput = z.object({
  workspaceId,
  opportunityId: z.string().min(1).max(128),
  style: z.enum(REPLY_STYLES).optional(),
  adjustment: z.enum(REPLY_ADJUSTMENTS).optional(),
});
export type GenerateReplyInput = z.input<typeof generateReplyInput>;

export const validateReplyInput = z.object({ workspaceId, draftId: z.string().min(1).max(128) });
