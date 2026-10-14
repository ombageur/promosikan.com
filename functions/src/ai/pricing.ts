import type { LlmUsage } from "./llm";

/** USD per 1 juta token (input, output, cache write 5 menit, cache read). Perbarui saat harga berubah. */
const PRICES: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
};

/**
 * Estimasi biaya (USD). Model yang tidak dikenal (mis. hasil fallback baru) dihitung
 * dengan harga Opus 5.5 dan ditandai `estimated: false` agar terlihat di laporan.
 */
export function estimateCostUsd(usage: LlmUsage): { usd: number; known: boolean } {
  const known = usage.model in PRICES;
  const p = PRICES[usage.model] ?? PRICES["claude-opus-5-5"]!;
  const usd =
    (usage.inputTokens * p.input +
      usage.outputTokens * p.output +
      usage.cacheCreationTokens * p.cacheWrite +
      usage.cacheReadTokens * p.cacheRead) /
    1_000_000;
  return { usd, known };
}
