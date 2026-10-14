import { describe, expect, it } from "vitest";
import { DEMO_OFFERINGS } from "@shared/demo/publishAgency";
import { offeringSchema } from "@shared/schemas/catalog";
import { opportunityScore, scoreBand } from "@shared/scoring";
import { demoIntelligence, emptyIntelligence, memoryCatalog } from "./memorySources";

describe("memoryCatalog (demo publik)", () => {
  it("berisi katalog Publish Agency dan mendukung CRUD lokal", async () => {
    const catalog = memoryCatalog();
    expect((await catalog.listOfferings()).map((o) => o.name)).toContain("SEO Management");

    const id = await catalog.saveOffering(null, offeringSchema.parse({ name: "Email Marketing" }));
    expect((await catalog.listOfferings()).some((o) => o.id === id)).toBe(true);
    await catalog.deleteOffering(id);
    expect((await catalog.listOfferings()).length).toBe(DEMO_OFFERINGS.length);
  });

  it("menghapus grup mengosongkan grup pada keyword, bukan menghapus keyword", async () => {
    const catalog = memoryCatalog();
    const before = (await catalog.listKeywords()).filter((k) => k.groupId === "g-seo").length;
    expect(before).toBeGreaterThan(0);
    await catalog.deleteKeywordGroup("g-seo");
    const keywords = await catalog.listKeywords();
    expect(keywords.filter((k) => k.groupId === "g-seo")).toHaveLength(0);
    expect(keywords.filter((k) => k.groupId === null)).toHaveLength(before);
  });

  it("setiap instance terpisah (tidak ada state global antar-sesi)", async () => {
    const a = memoryCatalog();
    await a.deleteOffering("seo");
    expect((await memoryCatalog().listOfferings()).some((o) => o.id === "seo")).toBe(true);
  });
});

describe("demoIntelligence", () => {
  it("skor peluang konsisten dengan shared/scoring (tidak dikarang)", async () => {
    for (const opp of await demoIntelligence().listOpportunities()) {
      expect(opp.score).toBe(opportunityScore(opp.subScores).score);
      expect(opp.band).toBe(scoreBand(opp.score));
    }
  });

  it("post demo tidak punya tautan asli dan draft tidak bisa dipublikasikan", async () => {
    const intel = demoIntelligence();
    expect((await intel.listOpportunities()).every((o) => o.post.permalink === null)).toBe(true);
    expect((await intel.listReplyDrafts()).every((d) => !d.publishable)).toBe(true);
  });

  it("percakapan sensitif tidak dicocokkan dan tidak diberi draft", async () => {
    const intel = demoIntelligence();
    const flagged = (await intel.listOpportunities()).filter((o) => o.redFlags.length > 0);
    expect(flagged.length).toBeGreaterThan(0);
    const drafts = await intel.listReplyDrafts();
    for (const opp of flagged) {
      expect(opp.matches).toHaveLength(0);
      expect(drafts.some((d) => d.opportunityId === opp.id)).toBe(false);
    }
  });

  it("menghasilkan 30 hari statistik yang stabil", async () => {
    const now = Date.UTC(2026, 9, 15);
    const a = await demoIntelligence(now).listDailyStats();
    const b = await demoIntelligence(now).listDailyStats();
    expect(a).toHaveLength(30);
    expect(a).toEqual(b);
  });
});

describe("emptyIntelligence", () => {
  it("tidak menyediakan data apa pun untuk workspace nyata", async () => {
    const intel = emptyIntelligence();
    expect(intel.available).toBe(false);
    expect(await intel.listOpportunities()).toEqual([]);
    await expect(intel.updateLead("x", { status: "lost" })).rejects.toThrow();
  });
});
