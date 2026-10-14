import { type DocumentSnapshot, FieldValue, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { canChangeRole, canLeave, canRemoveMember, isRole, type Role } from "@shared/permissions";
import { removeMemberInput, transferOwnershipInput, updateMemberRoleInput } from "@shared/schemas/workspace";
import { writeAudit } from "../utils/audit";
import { type CallContext, parseInput } from "../utils/context";
import { memberRef, requireMember, requirePermission, workspaceRef } from "../utils/membership";

function roleOf(snap: DocumentSnapshot): Role {
  const role: unknown = snap.get("role");
  if (!snap.exists || !isRole(role)) throw new HttpsError("not-found", "Anggota tidak ditemukan di workspace ini.");
  return role;
}

export async function updateMemberRoleHandler(db: Firestore, ctx: CallContext, data: unknown) {
  const input = parseInput(updateMemberRoleInput, data);
  if (input.uid === ctx.uid) throw new HttpsError("failed-precondition", "Anda tidak bisa mengubah role Anda sendiri.");

  await db.runTransaction(async (tx) => {
    const actorRole = await requireMember(db, input.workspaceId, ctx.uid, tx);
    const target = memberRef(db, input.workspaceId, input.uid);
    const current = roleOf(await tx.get(target));
    if (!canChangeRole(actorRole, current, input.role)) {
      throw new HttpsError("permission-denied", "Role Anda tidak diizinkan mengubah role anggota ini.");
    }
    if (current === input.role) return;
    tx.update(target, { role: input.role, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(db, tx, input.workspaceId, {
      action: "member.role_changed",
      actorUid: ctx.uid,
      targetUid: input.uid,
      details: { from: current, to: input.role },
    });
  });

  return { ok: true };
}

export async function removeMemberHandler(db: Firestore, ctx: CallContext, data: unknown) {
  const input = parseInput(removeMemberInput, data);
  const leaving = input.uid === ctx.uid;

  await db.runTransaction(async (tx) => {
    const actorRole = await requireMember(db, input.workspaceId, ctx.uid, tx);
    const target = memberRef(db, input.workspaceId, input.uid);
    const targetRole = leaving ? actorRole : roleOf(await tx.get(target));

    if (leaving && !canLeave(actorRole)) {
      throw new HttpsError("failed-precondition", "Owner harus mentransfer ownership sebelum keluar dari workspace.");
    }
    if (!leaving && !canRemoveMember(actorRole, targetRole)) {
      throw new HttpsError("permission-denied", "Role Anda tidak diizinkan mengeluarkan anggota ini.");
    }

    tx.delete(target);
    writeAudit(db, tx, input.workspaceId, {
      action: leaving ? "member.left" : "member.removed",
      actorUid: ctx.uid,
      targetUid: input.uid,
      details: { role: targetRole },
    });
  });

  return { ok: true };
}

export async function transferOwnershipHandler(db: Firestore, ctx: CallContext, data: unknown) {
  const input = parseInput(transferOwnershipInput, data);
  if (input.newOwnerUid === ctx.uid) throw new HttpsError("failed-precondition", "Anda sudah menjadi owner.");

  await db.runTransaction(async (tx) => {
    await requirePermission(db, input.workspaceId, ctx.uid, "ownership.transfer", tx);
    const target = memberRef(db, input.workspaceId, input.newOwnerUid);
    const previousRole = roleOf(await tx.get(target));

    tx.update(target, { role: "owner", updatedAt: FieldValue.serverTimestamp() });
    tx.update(memberRef(db, input.workspaceId, ctx.uid), { role: "admin", updatedAt: FieldValue.serverTimestamp() });
    tx.update(workspaceRef(db, input.workspaceId), { ownerId: input.newOwnerUid, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(db, tx, input.workspaceId, {
      action: "ownership.transferred",
      actorUid: ctx.uid,
      targetUid: input.newOwnerUid,
      details: { previousRole },
    });
  });

  return { ok: true };
}
