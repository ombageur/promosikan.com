import { readFileSync } from "node:fs";
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadString } from "firebase/storage";
import { afterAll, beforeAll, describe, it } from "vitest";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-promosikan",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: readFileSync("storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
  });
});

afterAll(async () => {
  await env.cleanup();
});

describe("baseline Fase 0: semua akses client ditolak", () => {
  it("pengguna anonim tidak bisa membaca atau menulis Firestore", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "workspaces/ws1")));
    await assertFails(setDoc(doc(db, "workspaces/ws1"), { name: "x" }));
  });

  it("pengguna login pun tidak bisa membaca atau menulis Firestore", async () => {
    const db = env.authenticatedContext("alice", { email_verified: true }).firestore();
    await assertFails(getDoc(doc(db, "users/alice")));
    await assertFails(setDoc(doc(db, "workspaces/ws1/offerings/o1"), { name: "SEO" }));
  });

  it("Storage menolak upload", async () => {
    const storage = env.authenticatedContext("alice").storage();
    await assertFails(uploadString(ref(storage, "workspaces/ws1/logo/logo.png"), "x"));
  });
});
