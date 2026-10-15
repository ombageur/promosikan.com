import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";

export type AuditAction =
  | "workspace.created"
  | "invitation.created"
  | "invitation.accepted"
  | "invitation.revoked"
  | "member.role_changed"
  | "member.removed"
  | "member.left"
  | "ownership.transferred"
  | "integration.connected"
  | "integration.disconnected";

export type AuditEntry = {
  action: AuditAction;
  actorUid: string;
  targetUid?: string;
  details?: Record<string, string | number | boolean | null>;
};

/** Audit log hanya ditulis backend dan tidak bisa diubah client (firestore.rules). */
export function writeAudit(db: Firestore, tx: Transaction, workspaceId: string, entry: AuditEntry) {
  const ref = db.collection("workspaces").doc(workspaceId).collection("auditLogs").doc();
  tx.create(ref, { ...entry, targetUid: entry.targetUid ?? null, details: entry.details ?? {}, createdAt: FieldValue.serverTimestamp() });
}
