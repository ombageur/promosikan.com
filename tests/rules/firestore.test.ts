import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { can, type Permission, ROLES } from "../../shared/permissions";
import { asUser, baseWorkspace, createEnv, INVITEE_EMAIL, OUTSIDER, seed, WS1_MEMBERS } from "./setup";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createEnv();
});
beforeEach(async () => {
  await seed(env);
});
afterAll(async () => {
  await env.cleanup();
});

const dbAs = (uid: string, opts?: Parameters<typeof asUser>[2]) => asUser(env, uid, opts).firestore();

/** Menjalankan `attempt` untuk setiap role ws1 dan memastikan hasilnya sesuai matriks shared/permissions.ts. */
async function expectMatrix(permission: Permission, attempt: (uid: string) => Promise<unknown>) {
  for (const role of ROLES) {
    const uid = WS1_MEMBERS[role];
    if (can(role, permission)) await assertSucceeds(attempt(uid));
    else await assertFails(attempt(uid));
  }
}

describe("users/{uid}", () => {
  it("pengguna bisa membuat dan membaca profilnya sendiri (meski email belum terverifikasi)", async () => {
    const db = dbAs("newuser", { verified: false });
    await assertSucceeds(
      setDoc(doc(db, "users/newuser"), {
        displayName: "Baru",
        email: "newuser@example.com",
        photoURL: null,
        lastWorkspaceId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(getDoc(doc(db, "users/newuser")));
  });

  it("tidak bisa membaca atau menulis profil orang lain", async () => {
    const db = dbAs("bob");
    await assertFails(getDoc(doc(db, "users/alice")));
    await assertFails(updateDoc(doc(db, "users/alice"), { displayName: "x", updatedAt: serverTimestamp() }));
  });

  it("menolak field tambahan dan email yang tidak sesuai token", async () => {
    const db = dbAs("alice");
    await assertFails(updateDoc(doc(db, "users/alice"), { role: "owner", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, "users/alice"), { email: "palsu@example.com", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db, "users/alice"), { lastWorkspaceId: "ws1", updatedAt: serverTimestamp() }));
  });
});

describe("workspaces/{wid}", () => {
  it("semua role anggota bisa membaca workspace (workspace.read)", async () => {
    await expectMatrix("workspace.read", (uid) => getDoc(doc(dbAs(uid), "workspaces/ws1")));
  });

  it("orang luar dan pengguna belum terverifikasi tidak bisa membaca", async () => {
    await assertFails(getDoc(doc(dbAs(OUTSIDER), "workspaces/ws1")));
    await assertFails(getDoc(doc(dbAs("alice", { verified: false }), "workspaces/ws1")));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "workspaces/ws1")));
  });

  it("update profil mengikuti matriks workspace.update", async () => {
    await expectMatrix("workspace.update", (uid) =>
      updateDoc(doc(dbAs(uid), "workspaces/ws1"), { description: `oleh ${uid}`, updatedAt: serverTimestamp() }),
    );
  });

  it("owner pun tidak bisa mengubah field yang dikelola backend", async () => {
    const ref = doc(dbAs("alice"), "workspaces/ws1");
    for (const field of ["ownerId", "plan", "isDemo", "createdAt"]) {
      await assertFails(updateDoc(ref, { [field]: "x", updatedAt: serverTimestamp() }));
    }
  });

  it("menolak profil tidak valid dan logoPath milik workspace lain", async () => {
    const ref = doc(dbAs("alice"), "workspaces/ws1");
    await assertFails(updateDoc(ref, { name: "A", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { description: "x".repeat(1001), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { preferredLanguage: "fr", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { logoPath: "workspaces/ws2/logo/a.png", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { logoPath: "workspaces/ws1/logo/a.png", updatedAt: serverTimestamp() }));
  });

  it("orang luar tidak bisa mengubah workspace lain", async () => {
    await assertFails(updateDoc(doc(dbAs(OUTSIDER), "workspaces/ws1"), { description: "x", updatedAt: serverTimestamp() }));
  });

  it("client tidak bisa membuat atau menghapus workspace", async () => {
    await assertFails(setDoc(doc(dbAs("alice"), "workspaces/baru"), { ...baseWorkspace, ownerId: "alice" }));
    await assertFails(deleteDoc(doc(dbAs("alice"), "workspaces/ws1")));
  });
});

describe("workspaces/{wid}/members", () => {
  it("anggota bisa membaca daftar anggota; orang luar tidak", async () => {
    await expectMatrix("workspace.read", (uid) => getDocs(collection(dbAs(uid), "workspaces/ws1/members")));
    await assertFails(getDocs(collection(dbAs(OUTSIDER), "workspaces/ws1/members")));
  });

  it("tidak ada role yang bisa menulis keanggotaan langsung (termasuk menaikkan role sendiri)", async () => {
    for (const uid of Object.values(WS1_MEMBERS)) {
      await assertFails(updateDoc(doc(dbAs(uid), `workspaces/ws1/members/${uid}`), { role: "owner" }));
    }
    await assertFails(setDoc(doc(dbAs(OUTSIDER), `workspaces/ws1/members/${OUTSIDER}`), { uid: OUTSIDER, role: "viewer" }));
  });

  it("collection group: pengguna hanya bisa mendaftar keanggotaannya sendiri", async () => {
    const db = dbAs("alice");
    await assertSucceeds(getDocs(query(collectionGroup(db, "members"), where("uid", "==", "alice"))));
    await assertFails(getDocs(query(collectionGroup(db, "members"), where("uid", "==", "bob"))));
    await assertFails(getDocs(collectionGroup(db, "members")));
  });
});

describe("workspaces/{wid}/auditLogs", () => {
  it("baca mengikuti matriks audit.read", async () => {
    await expectMatrix("audit.read", (uid) => getDocs(collection(dbAs(uid), "workspaces/ws1/auditLogs")));
  });

  it("tidak bisa ditulis, diubah, atau dihapus client", async () => {
    const db = dbAs("alice");
    await assertFails(setDoc(doc(db, "workspaces/ws1/auditLogs/x"), { action: "palsu" }));
    await assertFails(updateDoc(doc(db, "workspaces/ws1/auditLogs/log1"), { action: "palsu" }));
    await assertFails(deleteDoc(doc(db, "workspaces/ws1/auditLogs/log1")));
  });
});

describe("invitations", () => {
  it("penerima undangan (email cocok) bisa membaca undangannya", async () => {
    await assertSucceeds(getDoc(doc(dbAs("newbie", { email: INVITEE_EMAIL }), "invitations/inv1")));
    await assertSucceeds(getDoc(doc(dbAs("newbie", { email: "NewBie@Example.com" }), "invitations/inv1")));
  });

  it("baca oleh anggota workspace mengikuti matriks members.manage", async () => {
    await expectMatrix("members.manage", (uid) => getDoc(doc(dbAs(uid), "invitations/inv1")));
  });

  it("orang lain dan penerima belum terverifikasi tidak bisa membaca", async () => {
    await assertFails(getDoc(doc(dbAs(OUTSIDER), "invitations/inv1")));
    await assertFails(getDoc(doc(dbAs("newbie", { email: INVITEE_EMAIL, verified: false }), "invitations/inv1")));
  });

  it("client tidak bisa membuat atau mengubah undangan", async () => {
    await assertFails(setDoc(doc(dbAs("alice"), "invitations/baru"), { workspaceId: "ws1", email: "x@example.com" }));
    await assertFails(updateDoc(doc(dbAs("newbie", { email: INVITEE_EMAIL }), "invitations/inv1"), { status: "accepted" }));
  });
});

describe("koleksi lain", () => {
  it("mail dan path tak dikenal ditolak", async () => {
    const db = dbAs("alice");
    await assertFails(getDoc(doc(db, "mail/m1")));
    await assertFails(setDoc(doc(db, "mail/m1"), { to: "x@example.com" }));
    await assertFails(getDoc(doc(db, "random/x")));
    await assertFails(setDoc(doc(db, "workspaces/ws1/offerings/o1"), { name: "SEO" }));
  });
});
