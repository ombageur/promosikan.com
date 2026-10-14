import { z } from "zod";

/** Sub-skor dari AI (SPEC §9). Skor akhir selalu dihitung di sini, bukan oleh model. */
export const subScoresSchema = z.object({
  buyingIntent: z.number().int().min(0).max(100),
  productRelevance: z.number().int().min(0).max(100),
  urgency: z.number().int().min(0).max(100),
  problemClarity: z.number().int().min(0).max(100),
  conversationSuitability: z.number().int().min(0).max(100),
});

export type SubScores = z.infer<typeof subScoresSchema>;

export const SCORE_WEIGHTS = {
  buyingIntent: 0.3,
  productRelevance: 0.3,
  urgency: 0.15,
  problemClarity: 0.15,
  conversationSuitability: 0.1,
} as const satisfies Record<keyof SubScores, number>;

export type OpportunityBand = "high" | "medium" | "low" | "not_qualified";

export const BAND_LABELS: Record<OpportunityBand, string> = {
  high: "High Opportunity",
  medium: "Medium Opportunity",
  low: "Low Opportunity",
  not_qualified: "Not Qualified",
};

export function scoreBand(score: number): OpportunityBand {
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  if (score >= 40) return "low";
  return "not_qualified";
}

export function opportunityScore(raw: z.input<typeof subScoresSchema>) {
  const subScores = subScoresSchema.parse(raw);
  const weighted = (Object.keys(SCORE_WEIGHTS) as (keyof SubScores)[]).reduce(
    (sum, key) => sum + subScores[key] * SCORE_WEIGHTS[key],
    0,
  );
  const score = Math.round(weighted);
  return { score, band: scoreBand(score), subScores };
}
