import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

export type Effort = "low" | "medium" | "high";

export type LlmUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
};

export type LlmRequest = {
  /** Blok system berurutan; `cache: true` menaruh breakpoint prompt caching di blok itu. */
  system: { text: string; cache?: boolean }[];
  user: string;
  /** Skema bentuk output (structured output). Validasi rentang tetap dilakukan pemanggil. */
  schema: z.ZodType;
  effort: Effort;
  maxTokens?: number;
};

export type LlmResult =
  | { kind: "ok"; json: unknown; usage: LlmUsage }
  | { kind: "refused"; category: string | null; usage: LlmUsage }
  | { kind: "incomplete"; reason: string; usage: LlmUsage };

/** Gangguan sementara (rate limit, 5xx, jaringan) — aman dicoba lagi nanti. */
export class LlmUnavailableError extends Error {}
/** Kesalahan konfigurasi/permintaan (API key, request tidak valid) — jangan di-retry. */
export class LlmConfigError extends Error {}

/** Antarmuka yang dipakai seluruh logika AI, sehingga tes bisa memakai klien tiruan. */
export interface LlmClient {
  complete(request: LlmRequest): Promise<LlmResult>;
}

// Server-side fallback: jika model menolak karena classifier, API mencoba model lain yang
// direkomendasikan Anthropic untuk kategori itu (SPEC §17).
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export function claudeClient(apiKey: string, model: string): LlmClient {
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });

  return {
    async complete(request) {
      let response: Anthropic.Beta.BetaMessage;
      try {
        response = await client.beta.messages.create({
          model,
          max_tokens: request.maxTokens ?? 16000,
          betas: [FALLBACK_BETA],
          fallbacks: "default",
          system: request.system.map((block) => ({
            type: "text" as const,
            text: block.text,
            ...(block.cache ? { cache_control: { type: "ephemeral" as const } } : {}),
          })),
          messages: [{ role: "user", content: request.user }],
          output_config: { effort: request.effort, format: zodOutputFormat(request.schema) },
        });
      } catch (error) {
        if (
          error instanceof Anthropic.RateLimitError ||
          error instanceof Anthropic.InternalServerError ||
          error instanceof Anthropic.APIConnectionError
        ) {
          throw new LlmUnavailableError(error.message);
        }
        if (error instanceof Anthropic.APIError) throw new LlmConfigError(`${error.status ?? ""} ${error.message}`.trim());
        throw error;
      }

      const usage: LlmUsage = {
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      };

      if (response.stop_reason === "refusal") {
        return { kind: "refused", category: response.stop_details?.category ?? null, usage };
      }
      if (response.stop_reason !== "end_turn") {
        return { kind: "incomplete", reason: response.stop_reason ?? "unknown", usage };
      }

      const text = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
      try {
        return { kind: "ok", json: JSON.parse(text), usage };
      } catch {
        return { kind: "incomplete", reason: "invalid_json", usage };
      }
    },
  };
}
