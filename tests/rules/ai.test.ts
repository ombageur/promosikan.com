import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
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
    const now = Timestamp.now();
    await setDoc(doc(db, "workspaces/ws1/opportunities/o1"), { score: 90, band: "high", status: "new", matches: [], createdAt: now });
    await setDoc(doc(db, "workspaces/ws1/replyDrafts/draft_o1"), {
      opportunityId: "o1",
      text: "Halo!",
      style: "consultative",
      status: "draft",
      quality: { passed: true, notes: [], checkedAt: now },
      publishable: false,
      updatedAt: now,
      updatedBy: "alice",
    });
    await setDoc(doc(db, "workspaces/ws1/replyDrafts/draft_sent"), { opportunityId: "o2", text: "Terkirim", status: "sent", updatedAt: now });
    await setDoc(doc(db, "workspaces/ws1/usage/2026-10"), { aiCalls: 3, costUsd: 0.05 });
  });
});
afterAll(async () => {
  await env.cleanup();
});

const dbAs = (uid: string) => asUser(env, uid).firestore();
const stamp = (uid: string) => ({ updatedAt: serverTimestamp(), updatedBy: uid });

async function expectMatrix(permission: Permission, attempt: (uid: string) => Promise<unknown>) {
  for (const role of ROLES) {
    const uid = WS1_MEMBERS[role];
    if (can(role, permission)) await assertSucceeds(attempt(uid));
    else await assertFails(attempt(uid));
  }
}

describe("opportunities", () => {
  it("anggota bisa membaca; orang luar tidak", async () => {
    await expectMatrix("workspace.read", (uid) => getDoc(doc(dbAs(uid), "workspaces/ws1/opportunities/o1")));
    await assertFails(getDoc(doc(dbAs(OUTSIDER), "workspaces/ws1/opportunities/o1")));
  });

  it("status bisa diubah sesuai matriks reply.edit", async () => {
    await expectMatrix("reply.edit", (uid) =>
      updateDoc(doc(dbAs(uid), "workspaces/ws1/opportunities/o1"), { status: "saved", ...stamp(uid) }),
    );
  });

  it("skor, match, dan hasil AI tidak bisa ditulis client", async () => {
    const ref = doc(dbAs("alice"), "workspaces/ws1/opportunities/o1");
    await assertFails(updateDoc(ref, { score: 100, ...stamp("alice") }));
    await assertFails(updateDoc(ref, { matches: [{ offeringId: "x" }], ...stamp("alice") }));
    await assertFails(updateDoc(ref, { status: "converted", ...stamp("alice") }));
    await assertFails(setDoc(doc(dbAs("alice"), "workspaces/ws1/opportunities/baru"), { score: 99 }));
  });
});

describe("replyDrafts", () => {
  it("teks & status draft bisa disunting sesuai matriks reply.edit", async () => {
    await expectMatrix("reply.edit", (uid) =>
      updateDoc(doc(dbAs(uid), "workspaces/ws1/replyDrafts/draft_o1"), { text: `Disunting ${uid}`, ...stamp(uid) }),
    );
  });

  it("client tidak bisa menandai lolos kualitas, mengubah status publikasi, atau membuat draft", async () => {
    const ref = doc(dbAs("mia"), "workspaces/ws1/replyDrafts/draft_o1");
    await assertFails(updateDoc(ref, { quality: { passed: true, notes: [] }, ...stamp("mia") }));
    await assertFails(updateDoc(ref, { status: "approved", ...stamp("mia") }));
    await assertFails(updateDoc(ref, { status: "sent", ...stamp("mia") }));
    await assertFails(updateDoc(ref, { publishable: true, ...stamp("mia") }));
    await assertFails(updateDoc(ref, { text: "x".repeat(301), ...stamp("mia") }));
    await assertFails(setDoc(doc(dbAs("mia"), "workspaces/ws1/replyDrafts/baru"), { text: "Halo", status: "draft" }));
  });

  it("draft yang sudah terkirim tidak bisa disunting", async () => {
    await assertFails(updateDoc(doc(dbAs("alice"), "workspaces/ws1/replyDrafts/draft_sent"), { text: "Ubah", ...stamp("alice") }));
  });
});

describe("usage", () => {
  it("dibaca sesuai audit.read dan tidak bisa ditulis client", async () => {
    await expectMatrix("audit.read", (uid) => getDoc(doc(dbAs(uid), "workspaces/ws1/usage/2026-10")));
    await assertFails(updateDoc(doc(dbAs("alice"), "workspaces/ws1/usage/2026-10"), { aiCalls: 0 }));
  });
});
