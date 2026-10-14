import { describe, expect, it } from "vitest";
import { opportunityScore, SCORE_WEIGHTS, scoreBand } from "./scoring";

const zero = { buyingIntent: 0, productRelevance: 0, urgency: 0, problemClarity: 0, conversationSuitability: 0 };

describe("opportunityScore", () => {
  it("menerapkan bobot sesuai SPEC §9", () => {
    expect(
      opportunityScore({ buyingIntent: 100, productRelevance: 80, urgency: 60, problemClarity: 40, conversationSuitability: 20 }),
    ).toMatchObject({ score: 71, band: "medium" });
  });

  it("total bobot adalah 100%", () => {
    const total = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1);
  });

  it("menolak sub-skor di luar 0–100 atau bukan bilangan bulat", () => {
    expect(() => opportunityScore({ ...zero, buyingIntent: 101 })).toThrow();
    expect(() => opportunityScore({ ...zero, urgency: -1 })).toThrow();
    expect(() => opportunityScore({ ...zero, urgency: 50.5 })).toThrow();
  });

  it("menghasilkan 0 dan 100 di ujung rentang", () => {
    expect(opportunityScore(zero).score).toBe(0);
    const max = { buyingIntent: 100, productRelevance: 100, urgency: 100, problemClarity: 100, conversationSuitability: 100 };
    expect(opportunityScore(max)).toMatchObject({ score: 100, band: "high" });
  });
});

describe("scoreBand", () => {
  it.each([
    [100, "high"], [80, "high"], [79, "medium"], [60, "medium"],
    [59, "low"], [40, "low"], [39, "not_qualified"], [0, "not_qualified"],
  ] as const)("skor %i → %s", (score, band) => {
    expect(scoreBand(score)).toBe(band);
  });
});
