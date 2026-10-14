import { describe, expect, it } from "vitest";
import { automationSettingsSchema, DEFAULT_AUTOMATION_SETTINGS } from "./automation";
import { keywordSchema, offeringSchema, splitList } from "./catalog";

describe("offeringSchema", () => {
  it("mengisi default dan membersihkan daftar", () => {
    const parsed = offeringSchema.parse({ name: "  SEO Management ", keywords: ["SEO", " seo ", "SEO", ""] });
    expect(parsed).toMatchObject({ name: "SEO Management", type: "service", isActive: true, landingPageUrl: "" });
    expect(parsed.keywords).toEqual(["SEO", "seo"]);
  });

  it("menolak nama terlalu pendek, URL non-http, dan daftar terlalu panjang", () => {
    expect(offeringSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(offeringSchema.safeParse({ name: "SEO", landingPageUrl: "javascript:alert(1)" }).success).toBe(false);
    const keywords = Array.from({ length: 21 }, (_, i) => `kw${i}`);
    expect(offeringSchema.safeParse({ name: "SEO", keywords }).success).toBe(false);
  });
});

describe("keywordSchema", () => {
  it("default aktif tanpa grup/offering", () => {
    expect(keywordSchema.parse({ term: "butuh jasa SEO" })).toEqual({
      term: "butuh jasa SEO",
      groupId: null,
      offeringId: null,
      isActive: true,
    });
  });
});

describe("automationSettingsSchema", () => {
  it("default aman: monitoring mati, approval manual wajib", () => {
    expect(DEFAULT_AUTOMATION_SETTINGS).toMatchObject({ monitoringEnabled: false, manualApproval: true, dailyReplyLimit: 20 });
  });

  it("approval manual tidak bisa dimatikan dan interval harus dari daftar", () => {
    expect(automationSettingsSchema.safeParse({ manualApproval: false }).success).toBe(false);
    expect(automationSettingsSchema.safeParse({ monitoringIntervalMinutes: 5 }).success).toBe(false);
  });
});

describe("splitList", () => {
  it("memecah baris baru dan koma", () => {
    expect(splitList("a, b\n c,,\n")).toEqual(["a", "b", "c"]);
  });
});
