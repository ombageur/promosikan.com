import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { createWorkspaceInput, MAX_OWNED_WORKSPACES, workspaceProfileSchema } from "@shared/schemas/workspace";
import { writeAudit } from "../utils/audit";
import { type CallContext, parseInput } from "../utils/context";
import { memberRef } from "../utils/membership";

export async function createWorkspaceHandler(db: Firestore, ctx: CallContext, data: unknown) {
  const input = parseInput(createWorkspaceInput, data);

  // Workspace demo tidak dihitung (lihat createDemoWorkspace).
  const owned = await db.collection("workspaces").where("ownerId", "==", ctx.uid).where("isDemo", "==", false).count().get();
  if (owned.data().count >= MAX_OWNED_WORKSPACES) {
    throw new HttpsError("resource-exhausted", `Maksimal ${MAX_OWNED_WORKSPACES} workspace per pengguna.`);
  }

  const workspace = db.collection("workspaces").doc();
  const profile = workspaceProfileSchema.parse(input);

  await db.runTransaction(async (tx) => {
    tx.create(workspace, {
      ...profile,
      logoPath: null,
      logoUrl: null,
      ownerId: ctx.uid,
      plan: "free",
      isDemo: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.create(memberRef(db, workspace.id, ctx.uid), {
      uid: ctx.uid,
      role: "owner",
      email: ctx.email,
      displayName: ctx.displayName,
      invitedBy: null,
      joinedAt: FieldValue.serverTimestamp(),
    });
    tx.set(
      db.collection("users").doc(ctx.uid),
      { lastWorkspaceId: workspace.id, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    writeAudit(db, tx, workspace.id, { action: "workspace.created", actorUid: ctx.uid, details: { name: profile.name } });
  });

  return { workspaceId: workspace.id };
}
