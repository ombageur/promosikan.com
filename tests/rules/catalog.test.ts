import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { DEFAULT_AUTOMATION_SETTINGS } from "../../shared/schemas/automation";
import { offeringSchema } from "../../shared/schemas/catalog";
import { can, type Permission, ROLES } from "../../shared/permissions";
import { asUser, createEnv, OUTSIDER, seed, WS1_MEMBERS } from "./setup";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createEnv();
});
beforeEach(async () => {
  await seed(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const stamp = { createdAt: Timestamp.now(), createdBy: "alice", updatedAt: Timestamp.now(), updatedBy: "alice" };
    await setDoc(doc(db, "workspaces/ws1/offerings/seo"), { ...offeringSchema.parse({ name: "SEO" }), ...stamp });
    await setDoc(doc(db, "workspaces/ws1/keywordGroups/g1"), { name: "SEO", offeringId: "seo", ...stamp });
    await setDoc(doc(db, "workspaces/ws1/keywords/k1"), { term: "jasa SEO", groupId: "g1", offeringId: "seo", isActive: true, ...stamp });
  });
});
afterAll(async () => {
  await env.cleanup();
});

const dbAs = (uid: string) => asUser(env, uid).firestore();
const created = (uid: string) => ({ createdAt: serverTimestamp(), createdBy: uid, updatedAt: serverTimestamp(), updatedBy: uid });
const updated = (uid: string) => ({ updatedAt: serverTimestamp(), updatedBy: uid });

async function expectMatrix(permission: Permission, attempt: (uid: string, role: string) => Promise<unknown>) {
  for (const role of ROLES) {
    const uid = WS1_MEMBERS[role];
    if (can(role, permission)) await assertSucceeds(attempt(uid, role));
    else await assertFails(attempt(uid, role));
  }
}

describe("offerings", () => {
  const valid = offeringSchema.parse({ name: "Google Ads", keywords: ["google ads"], landingPageUrl: "https://example.com" });

  it("semua anggota bisa membaca; orang luar tidak", async () => {
    await expectMatrix("workspace.read", (uid) => getDoc(doc(dbAs(uid), "workspaces/ws1/offerings/seo")));
    await assertFails(getDoc(doc(dbAs(OUTSIDER), "workspaces/ws1/offerings/seo")));
  });

  it("buat/ubah/hapus mengikuti matriks catalog.manage", async () => {
    await expectMatrix("catalog.manage", (uid, role) =>
      setDoc(doc(dbAs(uid), `workspaces/ws1/offerings/new-${role}`), { ...valid, ...created(uid) }),
    );
    await expectMatrix("catalog.manage", (uid) =>
      updateDoc(doc(dbAs(uid), "workspaces/ws1/offerings/seo"), { description: `oleh ${uid}`, ...updated(uid) }),
    );
    await assertFails(deleteDoc(doc(dbAs("sam"), "workspaces/ws1/offerings/seo")));
    await assertSucceeds(deleteDoc(doc(dbAs("mia"), "workspaces/ws1/offerings/seo")));
  });

  it("orang luar tidak bisa menulis katalog workspace lain", async () => {
    await assertFails(setDoc(doc(dbAs(OUTSIDER), "workspaces/ws1/offerings/x"), { ...valid, ...created(OUTSIDER) }));
  });

  it("menolak data tidak valid dan jejak penulis palsu", async () => {
    const db = dbAs("alice");
    const ref = (id: string) => doc(db, `workspaces/ws1/offerings/${id}`);
    await assertFails(setDoc(ref("a"), { ...valid, name: "X", ...created("alice") }));
    await assertFails(setDoc(ref("b"), { ...valid, type: "jasa", ...created("alice") }));
    await assertFails(setDoc(ref("c"), { ...valid, landingPageUrl: "javascript:alert(1)", ...created("alice") }));
    await assertFails(setDoc(ref("d"), { ...valid, keywords: Array.from({ length: 21 }, (_, i) => `k${i}`), ...created("alice") }));
    await assertFails(setDoc(ref("e"), { ...valid, score: 99, ...created("alice") }));
    await assertFails(setDoc(ref("f"), { ...valid, ...created("alice"), createdBy: "bob" }));
    await assertFails(updateDoc(ref("seo"), { createdBy: "alice2", ...updated("alice") }));
    await assertFails(updateDoc(ref("seo"), { description: "x", updatedAt: serverTimestamp(), updatedBy: "bob" }));
  });
});

describe("keywordGroups & keywords", () => {
  it("menulis mengikuti matriks catalog.manage", async () => {
    await expectMatrix("catalog.manage", (uid, role) =>
      setDoc(doc(dbAs(uid), `workspaces/ws1/keywordGroups/g-${role}`), { name: "Website", offeringId: null, ...created(uid) }),
    );
    await expectMatrix("catalog.manage", (uid, role) =>
      setDoc(doc(dbAs(uid), `workspaces/ws1/keywords/k-${role}`), {
        term: "cari jasa website",
        groupId: "g1",
        offeringId: null,
        isActive: true,
        ...created(uid),
      }),
    );
  });

  it("bisa menonaktifkan keyword; menolak term kosong dan field asing", async () => {
    const db = dbAs("mia");
    await assertSucceeds(updateDoc(doc(db, "workspaces/ws1/keywords/k1"), { isActive: false, ...updated("mia") }));
    await assertFails(updateDoc(doc(db, "workspaces/ws1/keywords/k1"), { term: "", ...updated("mia") }));
    await assertFails(updateDoc(doc(db, "workspaces/ws1/keywords/k1"), { hits: 100, ...updated("mia") }));
    await assertFails(updateDoc(doc(db, "workspaces/ws1/keywords/k1"), { isActive: "ya", ...updated("mia") }));
  });
});

describe("settings/automation", () => {
  const settings = (uid: string) => ({ ...DEFAULT_AUTOMATION_SETTINGS, ...updated(uid) });

  it("semua anggota bisa membaca; menulis mengikuti matriks automation.manage", async () => {
    await expectMatrix("automation.manage", (uid) => setDoc(doc(dbAs(uid), "workspaces/ws1/settings/automation"), settings(uid)));
    await expectMatrix("workspace.read", (uid) => getDoc(doc(dbAs(uid), "workspaces/ws1/settings/automation")));
  });

  it("approval manual tidak bisa dimatikan (tidak ada auto-reply)", async () => {
    await assertFails(
      setDoc(doc(dbAs("alice"), "workspaces/ws1/settings/automation"), { ...settings("alice"), manualApproval: false }),
    );
  });

  it("menolak nilai di luar batas dan dokumen settings lain", async () => {
    const ref = doc(dbAs("alice"), "workspaces/ws1/settings/automation");
    await assertFails(setDoc(ref, { ...settings("alice"), monitoringIntervalMinutes: 5 }));
    await assertFails(setDoc(ref, { ...settings("alice"), dailyReplyLimit: 1000 }));
    await assertFails(setDoc(ref, { ...settings("alice"), minOpportunityScore: 50.5 }));
    await assertFails(setDoc(ref, { ...settings("alice"), defaultReplyStyle: "agresif" }));
    await assertFails(setDoc(doc(dbAs("alice"), "workspaces/ws1/settings/billing"), { plan: "pro", ...updated("alice") }));
  });
});
