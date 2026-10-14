import { analysisModelSchema, replyModelSchema, validationModelSchema } from "@shared/schemas/ai";
import type { LlmClient, LlmRequest, LlmResult, LlmUsage } from "./llm";

/**
 * AI tiruan deterministik untuk Emulator Suite (pengembangan lokal & smoke test UI tanpa API key).
 * Hanya aktif bila FUNCTIONS_EMULATOR=true DAN AI_FAKE=true — tidak pernah di produksi.
 */
export function isFakeAiEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.FUNCTIONS_EMULATOR === "true" && env.AI_FAKE === "true";
}

const usage: LlmUsage = { model: "fake-emulator", inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 };

function analyze(request: LlmRequest): LlmResult {
  const post = request.user.toLowerCase();
  const catalog = request.system.at(-1)?.text ?? "";
  // Cocokkan ID katalog "[id] Nama" yang namanya atau keyword-nya muncul di post.
  const matches = [...catalog.matchAll(/## \[([^\]]+)\] ([^\n(]+)[\s\S]*?(?=\n## \[|$)/g)]
    .filter(([block]) =>
      block
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .some((w) => w.length > 3 && post.includes(w)),
    )
    .slice(0, 3)
    .map(([, id], i) => ({ offeringId: id!, matchScore: 90 - i * 10, approach: "consultative", reason: "Kata kunci post cocok dengan katalog (AI tiruan)." }));
  const json = {
    language: "id",
    isCommercialIntent: matches.length > 0,
    customerProblem: "Butuh bantuan sesuai isi post (AI tiruan)",
    intent: matches.length > 0 ? "active_search" : "general_discussion",
    subScores: {
      buyingIntent: matches.length > 0 ? 85 : 20,
      productRelevance: matches[0]?.matchScore ?? 10,
      urgency: 60,
      problemClarity: 70,
      conversationSuitability: 80,
    },
    reasons: ["Hasil AI tiruan untuk emulator — bukan analisis sungguhan."],
    redFlags: [],
    matches,
  };
  return { kind: "ok", json, usage };
}

export function fakeLlm(): LlmClient {
  return {
    async complete(request) {
      if (request.schema === analysisModelSchema) return analyze(request);
      if (request.schema === replyModelSchema) {
        const shorter = request.user.includes("Persingkat");
        return {
          kind: "ok",
          json: { text: shorter ? "Boleh cerita sedikit kebutuhannya, Kak?" : "Halo Kak! Boleh tahu bisnisnya bergerak di bidang apa? Dari situ kami bisa sarankan langkah awal yang paling pas. (draft AI tiruan)" },
          usage,
        };
      }
      if (request.schema === validationModelSchema) return { kind: "ok", json: { passed: true, issues: [] }, usage };
      throw new Error("fakeLlm: skema tidak dikenal");
    },
  };
}
