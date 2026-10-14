import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { FieldValue, type Firestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { ROLE_LABELS } from "@shared/permissions";
import {
  acceptInvitationInput,
  INVITATION_TTL_DAYS,
  inviteMemberInput,
  MAX_INVITES_PER_DAY,
  revokeInvitationInput,
} from "@shared/schemas/workspace";
import { writeAudit } from "../utils/audit";
import { type CallContext, parseInput } from "../utils/context";
import { memberRef, requirePermission, workspaceRef } from "../utils/membership";

const DAY_MS = 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest();

function tokenMatches(token: string, storedHashHex: unknown): boolean {
  if (typeof storedHashHex !== "string") return false;
  const stored = Buffer.from(storedHashHex, "hex");
  const given = hashToken(token);
  return stored.length === given.length && timingSafeEqual(stored, given);
}

export async function inviteMemberHandler(db: Firestore, ctx: CallContext, data: unknown, options: { appUrl: string }) {
  const input = parseInput(inviteMemberInput, data);
  await requirePermission(db, input.workspaceId, ctx.uid, "members.manage");

  const invitations = db.collection("invitations");
  const since = Timestamp.fromMillis(Date.now() - DAY_MS);
  const recent = await invitations.where("workspaceId", "==", input.workspaceId).where("createdAt", ">=", since).count().get();
  if (recent.data().count >= MAX_INVITES_PER_DAY) {
    throw new HttpsError("resource-exhausted", "Batas undangan harian tercapai. Coba lagi besok.");
  }

  const existingMember = await workspaceRef(db, input.workspaceId).collection("members").where("email", "==", input.email).limit(1).get();
  if (!existingMember.empty) throw new HttpsError("already-exists", "Email ini sudah menjadi anggota workspace.");

  const token = randomBytes(32).toString("base64url");
  const invite = invitations.doc();
  const inviteUrl = `${options.appUrl.replace(/\/$/, "")}/invite/${invite.id}?token=${token}`;

  await db.runTransaction(async (tx) => {
    const workspace = await tx.get(workspaceRef(db, input.workspaceId));
    const pending = await tx.get(
      invitations.where("workspaceId", "==", input.workspaceId).where("email", "==", input.email).where("status", "==", "pending"),
    );
    const workspaceName = String(workspace.get("name") ?? "");

    // Undangan ulang ke email yang sama membatalkan undangan lama (hanya satu link aktif per email).
    for (const doc of pending.docs) tx.update(doc.ref, { status: "revoked", revokedAt: FieldValue.serverTimestamp() });

    tx.create(invite, {
      workspaceId: input.workspaceId,
      workspaceName,
      email: input.email,
      role: input.role,
      tokenHash: hashToken(token).toString("hex"),
      status: "pending",
      invitedBy: ctx.uid,
      invitedByName: ctx.displayName,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + INVITATION_TTL_DAYS * DAY_MS),
      acceptedBy: null,
      acceptedAt: null,
    });

    // Format koleksi Firebase Extension "Trigger Email". Tanpa extension, dokumen ini tidak diproses
    // dan admin tetap bisa membagikan link undangan secara manual dari UI.
    tx.create(db.collection("mail").doc(invite.id), {
      to: input.email,
      message: {
        subject: `Undangan bergabung ke ${workspaceName} di Promosikan.com`,
        text: [
          `${ctx.displayName} mengundang Anda bergabung ke workspace "${workspaceName}" sebagai ${ROLE_LABELS[input.role]}.`,
          "",
          `Terima undangan: ${inviteUrl}`,
          "",
          `Link berlaku ${INVITATION_TTL_DAYS} hari dan hanya bisa dipakai sekali.`,
        ].join("\n"),
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    writeAudit(db, tx, input.workspaceId, {
      action: "invitation.created",
      actorUid: ctx.uid,
      details: { email: input.email, role: input.role, inviteId: invite.id },
    });
  });

  return { inviteId: invite.id, inviteUrl, expiresInDays: INVITATION_TTL_DAYS };
}

export async function acceptInvitationHandler(db: Firestore, ctx: CallContext, data: unknown) {
  const input = parseInput(acceptInvitationInput, data);
  const inviteRef = db.collection("invitations").doc(input.inviteId);

  return db.runTransaction(async (tx) => {
    const invite = await tx.get(inviteRef);
    if (!invite.exists || !tokenMatches(input.token, invite.get("tokenHash"))) {
      throw new HttpsError("not-found", "Undangan tidak ditemukan atau link tidak valid.");
    }
    if (invite.get("status") !== "pending") {
      throw new HttpsError("failed-precondition", "Undangan ini sudah dipakai atau dibatalkan.");
    }
    const expiresAt = invite.get("expiresAt") as Timestamp;
    if (expiresAt.toMillis() <= Date.now()) {
      throw new HttpsError("deadline-exceeded", "Undangan sudah kedaluwarsa. Minta admin mengirim undangan baru.");
    }
    if (invite.get("email") !== ctx.email) {
      throw new HttpsError("permission-denied", "Undangan ini ditujukan untuk email lain. Masuk dengan email yang diundang.");
    }

    const workspaceId = String(invite.get("workspaceId"));
    const workspace = await tx.get(workspaceRef(db, workspaceId));
    if (!workspace.exists) throw new HttpsError("not-found", "Workspace sudah tidak tersedia.");
    const member = memberRef(db, workspaceId, ctx.uid);
    const existing = await tx.get(member);

    if (!existing.exists) {
      tx.create(member, {
        uid: ctx.uid,
        role: invite.get("role"),
        email: ctx.email,
        displayName: ctx.displayName,
        invitedBy: invite.get("invitedBy"),
        joinedAt: FieldValue.serverTimestamp(),
      });
    }
    tx.update(inviteRef, { status: "accepted", acceptedBy: ctx.uid, acceptedAt: FieldValue.serverTimestamp() });
    tx.set(db.collection("users").doc(ctx.uid), { lastWorkspaceId: workspaceId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    writeAudit(db, tx, workspaceId, {
      action: "invitation.accepted",
      actorUid: ctx.uid,
      details: { inviteId: inviteRef.id, role: String(invite.get("role")), alreadyMember: existing.exists },
    });

    return { workspaceId, alreadyMember: existing.exists };
  });
}

export async function revokeInvitationHandler(db: Firestore, ctx: CallContext, data: unknown) {
  const input = parseInput(revokeInvitationInput, data);
  await requirePermission(db, input.workspaceId, ctx.uid, "members.manage");
  const inviteRef = db.collection("invitations").doc(input.inviteId);

  await db.runTransaction(async (tx) => {
    const invite = await tx.get(inviteRef);
    if (!invite.exists || invite.get("workspaceId") !== input.workspaceId) {
      throw new HttpsError("not-found", "Undangan tidak ditemukan.");
    }
    if (invite.get("status") !== "pending") throw new HttpsError("failed-precondition", "Undangan ini sudah tidak aktif.");
    tx.update(inviteRef, { status: "revoked", revokedAt: FieldValue.serverTimestamp() });
    writeAudit(db, tx, input.workspaceId, {
      action: "invitation.revoked",
      actorUid: ctx.uid,
      details: { inviteId: inviteRef.id, email: String(invite.get("email")) },
    });
  });

  return { ok: true };
}
