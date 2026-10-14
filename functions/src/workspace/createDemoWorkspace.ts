import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { DEMO_AUTOMATION, DEMO_KEYWORD_GROUPS, DEMO_OFFERINGS, DEMO_PROFILE } from "@shared/demo/publishAgency";
import { writeAudit } from "../utils/audit";
import type { CallContext } from "../utils/context";
import { memberRef } from "../utils/membership";

/**
 * Workspace demo berisi katalog & keyword Publish Agency (SPEC §21).
 * Satu per pengguna; tidak dihitung dalam batas workspace. `isDemo` membuat server
 * menolak semua integrasi & publikasi untuk workspace ini (mulai Fase 4).
 */
export async function createDemoWorkspaceHandler(db: Firestore, ctx: CallContext) {
  const existing = await db
    .collection("workspaces")
    .where("ownerId", "==", ctx.uid)
    .where("isDemo", "==", true)
    .limit(1)
    .get();
  const found = existing.docs[0];
  if (found) return { workspaceId: found.id, existing: true };

  const workspace = db.collection("workspaces").doc();
  const now = FieldValue.serverTimestamp();
  const stamp = { createdAt: now, createdBy: ctx.uid, updatedAt: now, updatedBy: ctx.uid };

  await db.runTransaction(async (tx) => {
    tx.create(workspace, {
      ...DEMO_PROFILE,
      logoPath: null,
      logoUrl: null,
      ownerId: ctx.uid,
      plan: "free",
      isDemo: true,
      createdAt: now,
      updatedAt: now,
    });
    tx.create(memberRef(db, workspace.id, ctx.uid), {
      uid: ctx.uid,
      role: "owner",
      email: ctx.email,
      displayName: ctx.displayName,
      invitedBy: null,
      joinedAt: now,
    });

    for (const { id, ...offering } of DEMO_OFFERINGS) {
      tx.create(workspace.collection("offerings").doc(id), { ...offering, ...stamp });
    }
    for (const { id, terms, ...group } of DEMO_KEYWORD_GROUPS) {
      tx.create(workspace.collection("keywordGroups").doc(id), { ...group, ...stamp });
      for (const term of terms) {
        tx.create(workspace.collection("keywords").doc(), {
          term,
          groupId: id,
          offeringId: group.offeringId,
          isActive: true,
          ...stamp,
        });
      }
    }
    tx.create(workspace.collection("settings").doc("automation"), { ...DEMO_AUTOMATION, updatedAt: now, updatedBy: ctx.uid });

    tx.set(db.collection("users").doc(ctx.uid), { lastWorkspaceId: workspace.id, updatedAt: now }, { merge: true });
    writeAudit(db, tx, workspace.id, { action: "workspace.created", actorUid: ctx.uid, details: { demo: true } });
  });

  return { workspaceId: workspace.id, existing: false };
}
