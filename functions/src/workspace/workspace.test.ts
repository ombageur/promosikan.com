import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { beforeEach, describe, expect, it } from "vitest";
import type { Role } from "@shared/permissions";
import { MAX_OWNED_WORKSPACES } from "@shared/schemas/workspace";
import { db } from "../utils/admin";
import { type CallContext, requireAuth } from "../utils/context";
import { createWorkspaceHandler } from "./createWorkspace";
import { acceptInvitationHandler, inviteMemberHandler, revokeInvitationHandler } from "./invitations";
import { removeMemberHandler, transferOwnershipHandler, updateMemberRoleHandler } from "./members";

// Dijalankan di Firestore Emulator lewat `npm run test:emulator`.
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "demo-promosikan";
const APP = { appUrl: "http://localhost:5173" };

const user = (uid: string): CallContext => ({ uid, email: `${uid}@example.com`, emailVerified: true, displayName: uid });
const alice = user("alice"); // owner
const bob = user("bob"); // admin
const vic = user("vic"); // viewer
const eve = user("eve"); // orang luar

async function expectCode(promise: Promise<unknown>, code: HttpsError["code"]) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error, `diharapkan HttpsError ${code}`).toBeInstanceOf(HttpsError);
  expect((error as HttpsError).code).toBe(code);
}

async function clearFirestore() {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host) throw new Error("FIRESTORE_EMULATOR_HOST tidak di-set; jalankan lewat `npm run test:emulator`.");
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: "DELETE" });
}

async function addMember(workspaceId: string, ctx: CallContext, role: Role) {
  await db.doc(`workspaces/${workspaceId}/members/${ctx.uid}`).set({ uid: ctx.uid, role, email: ctx.email, displayName: ctx.uid });
}

async function roleIn(workspaceId: string, uid: string) {
  return (await db.doc(`workspaces/${workspaceId}/members/${uid}`).get()).get("role") as Role | undefined;
}

async function auditActions(workspaceId: string) {
  const logs = await db.collection(`workspaces/${workspaceId}/auditLogs`).get();
  return logs.docs.map((d) => d.get("action") as string);
}

/** Workspace dengan alice (owner), bob (admin), vic (viewer). */
async function setupWorkspace() {
  const { workspaceId } = await createWorkspaceHandler(db, alice, { name: "Publish Agency", businessName: "PT Publish" });
  await addMember(workspaceId, bob, "admin");
  await addMember(workspaceId, vic, "viewer");
  return workspaceId;
}

const tokenFrom = (url: string) => new URL(url).searchParams.get("token") ?? "";

beforeEach(clearFirestore);

describe("requireAuth", () => {
  it("menolak pemanggil tanpa login", () => {
    expect(() => requireAuth({ auth: undefined })).toThrowError(expect.objectContaining({ code: "unauthenticated" }));
  });

  it("menolak email yang belum terverifikasi", () => {
    const auth = { uid: "u", token: { email: "u@example.com", email_verified: false }, rawToken: "" };
    expect(() => requireAuth({ auth } as never)).toThrowError(expect.objectContaining({ code: "failed-precondition" }));
  });

  it("mengembalikan konteks dengan email huruf kecil", () => {
    const auth = { uid: "u", token: { email: "U@Example.com", email_verified: true }, rawToken: "" };
    expect(requireAuth({ auth } as never)).toMatchObject({ uid: "u", email: "u@example.com" });
  });
});

describe("createWorkspace", () => {
  it("membuat workspace, owner, audit log, dan lastWorkspaceId", async () => {
    const { workspaceId } = await createWorkspaceHandler(db, alice, { name: "Publish Agency", businessName: "PT Publish" });
    const ws = await db.doc(`workspaces/${workspaceId}`).get();
    expect(ws.data()).toMatchObject({ name: "Publish Agency", ownerId: "alice", plan: "free", isDemo: false, preferredLanguage: "id" });
    expect(await roleIn(workspaceId, "alice")).toBe("owner");
    expect(await auditActions(workspaceId)).toEqual(["workspace.created"]);
    expect((await db.doc("users/alice").get()).get("lastWorkspaceId")).toBe(workspaceId);
  });

  it("menolak input tidak valid", async () => {
    await expectCode(createWorkspaceHandler(db, alice, { name: "A", businessName: "PT" }), "invalid-argument");
    await expectCode(createWorkspaceHandler(db, alice, null), "invalid-argument");
  });

  it(`membatasi ${MAX_OWNED_WORKSPACES} workspace per owner`, async () => {
    for (let i = 0; i < MAX_OWNED_WORKSPACES; i++) {
      await createWorkspaceHandler(db, alice, { name: `WS ${i}`, businessName: "PT Publish" });
    }
    await expectCode(createWorkspaceHandler(db, alice, { name: "Lebih", businessName: "PT Publish" }), "resource-exhausted");
  });
});

describe("undangan anggota", () => {
  it("admin mengundang; token tidak disimpan mentah; email masuk antrean", async () => {
    const workspaceId = await setupWorkspace();
    const result = await inviteMemberHandler(db, bob, { workspaceId, email: "Baru@Example.com", role: "sales" }, APP);
    const token = tokenFrom(result.inviteUrl);
    expect(result.inviteUrl).toContain(`/invite/${result.inviteId}?token=`);

    const invite = await db.doc(`invitations/${result.inviteId}`).get();
    expect(invite.data()).toMatchObject({ workspaceId, email: "baru@example.com", role: "sales", status: "pending" });
    expect(JSON.stringify(invite.data())).not.toContain(token);
    expect((await db.doc(`mail/${result.inviteId}`).get()).get("to")).toBe("baru@example.com");
    expect(await auditActions(workspaceId)).toContain("invitation.created");
  });

  it("viewer dan orang luar tidak bisa mengundang", async () => {
    const workspaceId = await setupWorkspace();
    await expectCode(inviteMemberHandler(db, vic, { workspaceId, email: "x@example.com", role: "viewer" }, APP), "permission-denied");
    await expectCode(inviteMemberHandler(db, eve, { workspaceId, email: "x@example.com", role: "viewer" }, APP), "permission-denied");
  });

  it("tidak bisa mengundang sebagai owner atau mengundang anggota yang sudah ada", async () => {
    const workspaceId = await setupWorkspace();
    await expectCode(inviteMemberHandler(db, alice, { workspaceId, email: "x@example.com", role: "owner" }, APP), "invalid-argument");
    await expectCode(inviteMemberHandler(db, alice, { workspaceId, email: vic.email, role: "sales" }, APP), "already-exists");
  });

  it("undangan ulang ke email yang sama membatalkan link lama", async () => {
    const workspaceId = await setupWorkspace();
    const first = await inviteMemberHandler(db, alice, { workspaceId, email: "baru@example.com", role: "viewer" }, APP);
    await inviteMemberHandler(db, alice, { workspaceId, email: "baru@example.com", role: "sales" }, APP);
    expect((await db.doc(`invitations/${first.inviteId}`).get()).get("status")).toBe("revoked");
    await expectCode(
      acceptInvitationHandler(db, user("baru"), { inviteId: first.inviteId, token: tokenFrom(first.inviteUrl) }),
      "failed-precondition",
    );
  });

  it("penerima yang benar bergabung dengan role undangan, dan link hanya bisa dipakai sekali", async () => {
    const workspaceId = await setupWorkspace();
    const invite = await inviteMemberHandler(db, alice, { workspaceId, email: "baru@example.com", role: "marketing" }, APP);
    const input = { inviteId: invite.inviteId, token: tokenFrom(invite.inviteUrl) };

    await expect(acceptInvitationHandler(db, user("baru"), input)).resolves.toEqual({ workspaceId, alreadyMember: false });
    expect(await roleIn(workspaceId, "baru")).toBe("marketing");
    expect(await auditActions(workspaceId)).toContain("invitation.accepted");

    await expectCode(acceptInvitationHandler(db, user("baru"), input), "failed-precondition");
  });

  it("menolak token salah, email berbeda, kedaluwarsa, dan undangan yang dibatalkan", async () => {
    const workspaceId = await setupWorkspace();
    const invite = await inviteMemberHandler(db, alice, { workspaceId, email: "baru@example.com", role: "viewer" }, APP);
    const token = tokenFrom(invite.inviteUrl);

    await expectCode(acceptInvitationHandler(db, user("baru"), { inviteId: invite.inviteId, token: "x".repeat(43) }), "not-found");
    await expectCode(acceptInvitationHandler(db, eve, { inviteId: invite.inviteId, token }), "permission-denied");

    await db.doc(`invitations/${invite.inviteId}`).update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
    await expectCode(acceptInvitationHandler(db, user("baru"), { inviteId: invite.inviteId, token }), "deadline-exceeded");

    const second = await inviteMemberHandler(db, alice, { workspaceId, email: "lain@example.com", role: "viewer" }, APP);
    await revokeInvitationHandler(db, bob, { workspaceId, inviteId: second.inviteId });
    await expectCode(
      acceptInvitationHandler(db, user("lain"), { inviteId: second.inviteId, token: tokenFrom(second.inviteUrl) }),
      "failed-precondition",
    );
    expect(await roleIn(workspaceId, "baru")).toBeUndefined();
  });

  it("revoke hanya oleh pengelola workspace yang sama", async () => {
    const workspaceId = await setupWorkspace();
    const invite = await inviteMemberHandler(db, alice, { workspaceId, email: "baru@example.com", role: "viewer" }, APP);
    await expectCode(revokeInvitationHandler(db, vic, { workspaceId, inviteId: invite.inviteId }), "permission-denied");

    const { workspaceId: other } = await createWorkspaceHandler(db, eve, { name: "Lain", businessName: "PT Lain" });
    await expectCode(revokeInvitationHandler(db, eve, { workspaceId: other, inviteId: invite.inviteId }), "not-found");
  });
});

describe("ubah role", () => {
  it("admin bisa mengubah role non-owner", async () => {
    const workspaceId = await setupWorkspace();
    await updateMemberRoleHandler(db, bob, { workspaceId, uid: "vic", role: "sales" });
    expect(await roleIn(workspaceId, "vic")).toBe("sales");
    expect(await auditActions(workspaceId)).toContain("member.role_changed");
  });

  it("admin tidak bisa mengubah owner; tidak ada yang bisa menjadikan owner atau mengubah role sendiri", async () => {
    const workspaceId = await setupWorkspace();
    await expectCode(updateMemberRoleHandler(db, bob, { workspaceId, uid: "alice", role: "viewer" }), "permission-denied");
    await expectCode(updateMemberRoleHandler(db, alice, { workspaceId, uid: "bob", role: "owner" }), "invalid-argument");
    await expectCode(updateMemberRoleHandler(db, bob, { workspaceId, uid: "bob", role: "viewer" }), "failed-precondition");
    expect(await roleIn(workspaceId, "alice")).toBe("owner");
  });

  it("viewer dan orang luar tidak bisa mengubah role", async () => {
    const workspaceId = await setupWorkspace();
    await expectCode(updateMemberRoleHandler(db, vic, { workspaceId, uid: "bob", role: "viewer" }), "permission-denied");
    await expectCode(updateMemberRoleHandler(db, eve, { workspaceId, uid: "vic", role: "admin" }), "permission-denied");
  });
});

describe("keluarkan anggota & keluar", () => {
  it("admin bisa mengeluarkan anggota non-owner", async () => {
    const workspaceId = await setupWorkspace();
    await removeMemberHandler(db, bob, { workspaceId, uid: "vic" });
    expect(await roleIn(workspaceId, "vic")).toBeUndefined();
    expect(await auditActions(workspaceId)).toContain("member.removed");
  });

  it("admin tidak bisa mengeluarkan owner; viewer tidak bisa mengeluarkan siapa pun", async () => {
    const workspaceId = await setupWorkspace();
    await expectCode(removeMemberHandler(db, bob, { workspaceId, uid: "alice" }), "permission-denied");
    await expectCode(removeMemberHandler(db, vic, { workspaceId, uid: "bob" }), "permission-denied");
  });

  it("anggota bisa keluar sendiri, owner tidak", async () => {
    const workspaceId = await setupWorkspace();
    await removeMemberHandler(db, vic, { workspaceId, uid: "vic" });
    expect(await roleIn(workspaceId, "vic")).toBeUndefined();
    expect(await auditActions(workspaceId)).toContain("member.left");
    await expectCode(removeMemberHandler(db, alice, { workspaceId, uid: "alice" }), "failed-precondition");
  });
});

describe("transfer ownership", () => {
  it("owner menyerahkan ownership; owner lama menjadi admin", async () => {
    const workspaceId = await setupWorkspace();
    await transferOwnershipHandler(db, alice, { workspaceId, newOwnerUid: "bob" });
    expect(await roleIn(workspaceId, "bob")).toBe("owner");
    expect(await roleIn(workspaceId, "alice")).toBe("admin");
    expect((await db.doc(`workspaces/${workspaceId}`).get()).get("ownerId")).toBe("bob");
    expect(await auditActions(workspaceId)).toContain("ownership.transferred");
  });

  it("hanya owner yang bisa transfer, dan target harus anggota", async () => {
    const workspaceId = await setupWorkspace();
    await expectCode(transferOwnershipHandler(db, bob, { workspaceId, newOwnerUid: "vic" }), "permission-denied");
    await expectCode(transferOwnershipHandler(db, alice, { workspaceId, newOwnerUid: "eve" }), "not-found");
    expect(await roleIn(workspaceId, "alice")).toBe("owner");
  });
});
