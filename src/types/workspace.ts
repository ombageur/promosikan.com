import type { Timestamp } from "firebase/firestore";
import type { AssignableRole, Role } from "@shared/permissions";
import type { WorkspaceProfile } from "@shared/schemas/workspace";

export type UserProfile = {
  displayName: string;
  email: string;
  photoURL: string | null;
  lastWorkspaceId: string | null;
};

export type Workspace = WorkspaceProfile & {
  id: string;
  ownerId: string;
  plan: string;
  isDemo: boolean;
  logoPath: string | null;
  logoUrl: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type Member = {
  uid: string;
  role: Role;
  email: string;
  displayName: string;
  invitedBy: string | null;
  joinedAt?: Timestamp;
};

export type InvitationStatus = "pending" | "accepted" | "revoked";

export type Invitation = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  role: AssignableRole;
  status: InvitationStatus;
  invitedBy: string;
  invitedByName: string;
  createdAt?: Timestamp;
  expiresAt: Timestamp;
};

/** Ringkasan workspace untuk workspace switcher. */
export type WorkspaceSummary = {
  id: string;
  name: string;
  logoUrl: string | null;
  role: Role;
};
