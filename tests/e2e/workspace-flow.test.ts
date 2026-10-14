import { deleteApp, type FirebaseApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, serverTimestamp, updateDoc } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { afterAll, describe, expect, it } from "vitest";

// Alur nyata lewat Auth/Functions/Firestore Emulator: client SDK → callable → Admin SDK → Security Rules.
const PROJECT_ID = "demo-promosikan";
const REGION = "asia-southeast2";
const apps: FirebaseApp[] = [];
const run = Date.now().toString(36);

async function markEmailVerified(uid: string) {
  const res = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
    body: JSON.stringify({ localId: uid, emailVerified: true }),
  });
  if (!res.ok) throw new Error(`Gagal verifikasi email: ${res.status}`);
}

/** Satu "browser" terpisah per pengguna. */
async function signUp(name: string, { verified = true } = {}) {
  const app = initializeApp({ apiKey: "demo-api-key", projectId: PROJECT_ID, appId: "demo" }, `${name}-${run}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const functions = getFunctions(app, REGION);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);

  const email = `${name}-${run}@example.com`;
  const { user } = await createUserWithEmailAndPassword(auth, email, "rahasia-123");
  if (verified) {
    await markEmailVerified(user.uid);
    await user.reload();
    await user.getIdToken(true);
  }
  const call = <I, O>(fn: string) => async (input: I) => (await httpsCallable<I, O>(functions, fn)(input)).data;
  return { user, email, db, call };
}

async function codeOf(promise: Promise<unknown>) {
  return promise.then(
    () => "ok",
    (e: { code?: string }) => e.code ?? String(e),
  );
}

afterAll(async () => {
  await Promise.all(apps.map((app) => deleteApp(app)));
});

describe("alur workspace end-to-end", () => {
  it("daftar → buat workspace → undang → terima → akses sesuai role", async () => {
    const unverified = await signUp("unverified", { verified: false });
    expect(await codeOf(unverified.call("createWorkspace")({ name: "Coba", businessName: "PT Coba" }))).toBe(
      "functions/failed-precondition",
    );

    const owner = await signUp("owner");
    const { workspaceId } = await owner.call<object, { workspaceId: string }>("createWorkspace")({
      name: "Publish Agency",
      businessName: "PT Publish Agency",
    });
    const ws = await getDoc(doc(owner.db, "workspaces", workspaceId));
    expect(ws.get("ownerId")).toBe(owner.user.uid);

    const sales = await signUp("sales");
    const outsider = await signUp("outsider");

    const invite = await owner.call<object, { inviteId: string; inviteUrl: string }>("inviteMember")({
      workspaceId,
      email: sales.email,
      role: "sales",
    });
    const token = new URL(invite.inviteUrl).searchParams.get("token");

    // Penerima bisa membaca undangannya; orang lain tidak.
    expect((await getDoc(doc(sales.db, "invitations", invite.inviteId))).get("role")).toBe("sales");
    expect(await codeOf(getDoc(doc(outsider.db, "invitations", invite.inviteId)))).toBe("permission-denied");

    // Undangan tidak bisa dipakai email lain.
    expect(await codeOf(outsider.call("acceptInvitation")({ inviteId: invite.inviteId, token }))).toBe(
      "functions/permission-denied",
    );
    await sales.call("acceptInvitation")({ inviteId: invite.inviteId, token });

    // Sales bisa membaca workspace tetapi tidak bisa mengubah profil atau mengundang.
    expect((await getDoc(doc(sales.db, "workspaces", workspaceId))).get("name")).toBe("Publish Agency");
    expect(
      await codeOf(updateDoc(doc(sales.db, "workspaces", workspaceId), { description: "x", updatedAt: serverTimestamp() })),
    ).toBe("permission-denied");
    expect(
      await codeOf(sales.call("inviteMember")({ workspaceId, email: "lain@example.com", role: "viewer" })),
    ).toBe("functions/permission-denied");

    // Owner bisa mengubah profil; orang luar tidak bisa membaca workspace.
    await updateDoc(doc(owner.db, "workspaces", workspaceId), { description: "Agency digital", updatedAt: serverTimestamp() });
    expect(await codeOf(getDoc(doc(outsider.db, "workspaces", workspaceId)))).toBe("permission-denied");

    // Setelah dikeluarkan, akses sales langsung hilang.
    await owner.call("removeMember")({ workspaceId, uid: sales.user.uid });
    expect(await codeOf(getDoc(doc(sales.db, "workspaces", workspaceId)))).toBe("permission-denied");
  });
});
