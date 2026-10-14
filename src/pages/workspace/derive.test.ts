import { describe, expect, it } from "vitest";
import { buildDemoIntelligence } from "@shared/demo/publishAgency";
import { funnel, sumStats, topKeywords, topOfferings } from "./derive";

const demo = buildDemoIntelligence(Date.UTC(2026, 9, 15));

describe("derive", () => {
  it("menjumlahkan statistik harian", () => {
    const totals = sumStats(demo.dailyStats);
    expect(totals.discovered).toBe(demo.dailyStats.reduce((n, d) => n + d.discovered, 0));
    expect(sumStats([])).toMatchObject({ discovered: 0, converted: 0 });
  });

  it("funnel tidak pernah naik dari tahap ke tahap", () => {
    const stages = funnel(sumStats(demo.dailyStats)).map((s) => s.value);
    for (let i = 1; i < stages.length; i++) expect(stages[i]).toBeLessThanOrEqual(stages[i - 1] ?? 0);
  });

  it("peringkat keyword & offering terurut menurun dan mengabaikan peluang tanpa match", () => {
    const keywords = topKeywords(demo.opportunities);
    expect(keywords[0]?.value).toBeGreaterThanOrEqual(keywords.at(-1)?.value ?? 0);
    const offerings = topOfferings(demo.opportunities);
    const matched = demo.opportunities.filter((o) => o.matches.length > 0).length;
    expect(offerings.reduce((n, o) => n + o.value, 0)).toBe(matched);
  });
});
