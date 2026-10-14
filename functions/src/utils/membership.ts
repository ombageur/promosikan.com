import type { Firestore, Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { can, isRole, type Permission, type Role } from "@shared/permissions";

export const workspaceRef = (db: Firestore, workspaceId: string) => db.collection("workspaces").doc(workspaceId);
export const memberRef = (db: Firestore, workspaceId: string, uid: string) =>
  workspaceRef(db, workspaceId).collection("members").doc(uid);

/** Role pemanggil di workspace, atau error permission-denied jika bukan anggota. */
export async function requireMember(db: Firestore, workspaceId: string, uid: string, tx?: Transaction): Promise<Role> {
  const ref = memberRef(db, workspaceId, uid);
  const snap = tx ? await tx.get(ref) : await ref.get();
  const role: unknown = snap.get("role");
  // Pesan sama untuk "workspace tidak ada" dan "bukan anggota" agar keberadaan workspace tidak bocor.
  if (!snap.exists || !isRole(role)) throw new HttpsError("permission-denied", "Anda tidak memiliki akses ke workspace ini.");
  return role;
}

export async function requirePermission(
  db: Firestore,
  workspaceId: string,
  uid: string,
  permission: Permission,
  tx?: Transaction,
): Promise<Role> {
  const role = await requireMember(db, workspaceId, uid, tx);
  if (!can(role, permission)) throw new HttpsError("permission-denied", "Role Anda tidak diizinkan melakukan aksi ini.");
  return role;
}
