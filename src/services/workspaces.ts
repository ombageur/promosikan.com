import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { isRole } from "@shared/permissions";
import type {
  CreateWorkspaceInput,
  InviteMemberInput,
  WorkspaceProfile,
} from "@shared/schemas/workspace";
import type { AssignableRole } from "@shared/permissions";
import { db } from "@/lib/firebase/firestore";
import { storage } from "@/lib/firebase/storage";
import { callable } from "@/lib/firebase/callable";
import type { Invitation, Member, Workspace, WorkspaceSummary } from "@/types/workspace";

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_WORKSPACES_LISTED = 50;
const MAX_MEMBERS_LISTED = 200;

export const workspaceDoc = (workspaceId: string) => doc(db, "workspaces", workspaceId);
export const memberDoc = (workspaceId: string, uid: string) => doc(db, "workspaces", workspaceId, "members", uid);

export function toWorkspace(id: string, data: Record<string, unknown>): Workspace {
  return { id, ...(data as Omit<Workspace, "id">) };
}

/** Semua workspace tempat pengguna menjadi anggota (collection group `members`). */
export async function listMyWorkspaces(uid: string): Promise<WorkspaceSummary[]> {
  const memberships = await getDocs(
    query(collectionGroup(db, "members"), where("uid", "==", uid), limit(MAX_WORKSPACES_LISTED)),
  );
  const summaries = await Promise.all(
    memberships.docs.map(async (membership) => {
      const workspaceRef = membership.ref.parent.parent;
      const role: unknown = membership.get("role");
      if (!workspaceRef || !isRole(role)) return null;
      const snap = await getDoc(workspaceRef);
      if (!snap.exists()) return null;
      return { id: snap.id, name: String(snap.get("name") ?? ""), logoUrl: snap.get("logoUrl") ?? null, role };
    }),
  );
  return summaries.filter((s): s is WorkspaceSummary => s !== null).sort((a, b) => a.name.localeCompare(b.name, "id"));
}

export async function updateWorkspaceProfile(workspaceId: string, profile: WorkspaceProfile) {
  await updateDoc(workspaceDoc(workspaceId), { ...profile, updatedAt: serverTimestamp() });
}

export async function uploadWorkspaceLogo(workspace: Workspace, file: File) {
  if (!LOGO_TYPES.includes(file.type)) throw new Error("Logo harus berupa PNG, JPG, atau WebP.");
  if (file.size >= MAX_LOGO_BYTES) throw new Error("Ukuran logo maksimal 2 MB.");
  const extension = file.type.split("/")[1] ?? "png";
  const path = `workspaces/${workspace.id}/logo/logo-${Date.now()}.${extension}`;
  const objectRef = ref(storage, path);
  await uploadBytes(objectRef, file, { contentType: file.type, cacheControl: "public, max-age=31536000" });
  const url = await getDownloadURL(objectRef);
  await updateDoc(workspaceDoc(workspace.id), { logoPath: path, logoUrl: url, updatedAt: serverTimestamp() });
  if (workspace.logoPath) await deleteObject(ref(storage, workspace.logoPath)).catch(() => undefined);
}

export async function removeWorkspaceLogo(workspace: Workspace) {
  await updateDoc(workspaceDoc(workspace.id), { logoPath: null, logoUrl: null, updatedAt: serverTimestamp() });
  if (workspace.logoPath) await deleteObject(ref(storage, workspace.logoPath)).catch(() => undefined);
}

export async function listMembers(workspaceId: string): Promise<Member[]> {
  const snap = await getDocs(query(collection(db, "workspaces", workspaceId, "members"), limit(MAX_MEMBERS_LISTED)));
  return snap.docs.map((d) => d.data() as Member);
}

export async function listPendingInvitations(workspaceId: string): Promise<Invitation[]> {
  const snap = await getDocs(
    query(
      collection(db, "invitations"),
      where("workspaceId", "==", workspaceId),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc"),
      limit(100),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Invitation, "id">) }));
}

export async function getInvitation(inviteId: string): Promise<Invitation | null> {
  const snap = await getDoc(doc(db, "invitations", inviteId));
  return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Invitation, "id">) } : null;
}

// ---------- Cloud Functions ----------
type Ok = { ok: true };

export const createWorkspace = callable<CreateWorkspaceInput, { workspaceId: string }>("createWorkspace");
export const inviteMember = callable<InviteMemberInput, { inviteId: string; inviteUrl: string; expiresInDays: number }>(
  "inviteMember",
);
export const acceptInvitation = callable<{ inviteId: string; token: string }, { workspaceId: string; alreadyMember: boolean }>(
  "acceptInvitation",
);
export const revokeInvitation = callable<{ workspaceId: string; inviteId: string }, Ok>("revokeInvitation");
export const updateMemberRole = callable<{ workspaceId: string; uid: string; role: AssignableRole }, Ok>("updateMemberRole");
export const removeMember = callable<{ workspaceId: string; uid: string }, Ok>("removeMember");
export const transferOwnership = callable<{ workspaceId: string; newOwnerUid: string }, Ok>("transferOwnership");
