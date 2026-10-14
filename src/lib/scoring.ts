import { z } from "zod";

export const scoreInputsSchema = z.object({
  buyingIntent: z.number().int().min(0).max(100),
  relevance: z.number().int().min(0).max(100),
  urgency: z.number().int().min(0).max(100),
  problemClarity: z.number().int().min(0).max(100),
  suitability: z.number().int().min(0).max(100),
});

export function opportunityScore(raw: z.input<typeof scoreInputsSchema>) {
  const values = scoreInputsSchema.parse(raw);
  const score = Math.round(values.buyingIntent * 0.3 + values.relevance * 0.3 + values.urgency * 0.15 + values.problemClarity * 0.15 + values.suitability * 0.1);
  const band = score >= 80 ? "High Opportunity" : score >= 60 ? "Medium Opportunity" : score >= 40 ? "Low Opportunity" : "Not Qualified";
  return { score, band, breakdown: values };
}
