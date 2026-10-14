import { describe, expect, it } from "vitest";
import { opportunityScore } from "./scoring";

describe("opportunityScore", () => {
  it("uses the specified weighted criteria", () => {
    expect(opportunityScore({ buyingIntent: 100, relevance: 80, urgency: 60, problemClarity: 40, suitability: 20 })).toMatchObject({ score: 71, band: "Medium Opportunity" });
  });
  it("keeps scores between 0 and 100", () => {
    expect(() => opportunityScore({ buyingIntent: 101, relevance: 0, urgency: 0, problemClarity: 0, suitability: 0 })).toThrow();
  });
});
