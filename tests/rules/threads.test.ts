import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { ROLES } from "../../shared/permissions";
import { asUser, createEnv, OUTSIDER, seed, WS1_MEMBERS } from "./setup";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createEnv();
});
beforeEach(async () => {
  await seed(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "workspaces/ws1/socialAccounts/threads"), { platform: "threads", status: "connected", username: "publish" });
    await setDoc(doc(db, "workspaces/ws1/socialPosts/threads_1"), { text: "Butuh jasa SEO", analysisStatus: "done" });
    await setDoc(doc(db, "workspaces/ws1/monitoringRuns/r1"), { postsNew: 1 });
    await setDoc(doc(db, "integrationSecrets/ws1_threads"), { token: { data: "x" }, workspaceId: "ws1" });
    await setDoc(doc(db, "oauthStates/s1"), { workspaceId: "ws1", uid: "alice", expiresAt: Timestamp.now() });
  });
});
afterAll(async () => {
  await env.cleanup();
});

const dbAs = (uid: string) => asUser(env, uid).firestore();

describe("integrasi sosial", () => {
  it("semua anggota bisa membaca status akun, post, dan riwayat sinkron; orang luar tidak", async () => {
    for (const role of ROLES) {
      const db = dbAs(WS1_MEMBERS[role]);
      await assertSucceeds(getDoc(doc(db, "workspaces/ws1/socialAccounts/threads")));
      await assertSucceeds(getDoc(doc(db, "workspaces/ws1/socialPosts/threads_1")));
      await assertSucceeds(getDoc(doc(db, "workspaces/ws1/monitoringRuns/r1")));
    }
    await assertFails(getDoc(doc(dbAs(OUTSIDER), "workspaces/ws1/socialAccounts/threads")));
  });

  it("owner pun tidak bisa menulis akun/post atau memalsukan status koneksi", async () => {
    const db = dbAs("alice");
    await assertFails(updateDoc(doc(db, "workspaces/ws1/socialAccounts/threads"), { status: "connected", username: "palsu" }));
    await assertFails(setDoc(doc(db, "workspaces/ws1/socialPosts/threads_9"), { text: "palsu" }));
    await assertFails(setDoc(doc(db, "workspaces/ws1/monitoringRuns/r2"), { postsNew: 99 }));
  });

  it("token, state OAuth, dan catatan penghapusan data tidak bisa dibaca siapa pun dari client", async () => {
    const db = dbAs("alice");
    await assertFails(getDoc(doc(db, "integrationSecrets/ws1_threads")));
    await assertFails(getDoc(doc(db, "oauthStates/s1")));
    await assertFails(setDoc(doc(db, "oauthStates/s2"), { workspaceId: "ws1" }));
    await assertFails(getDoc(doc(db, "dataDeletionRequests/abc")));
  });
});
