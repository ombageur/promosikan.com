import { createContext } from "react";
import type { Permission, Role } from "@shared/permissions";
import type { DataSource } from "@/services/data/types";
import type { Workspace } from "@/types/workspace";

export type WorkspaceState = {
  workspace: Workspace;
  role: Role;
  can: (permission: Permission) => boolean;
  /** Prefix URL halaman workspace: `/w/:id` atau `/demo`. */
  basePath: string;
  /** Demo publik tanpa login: tidak ada akses Firestore sama sekali. */
  isPublicDemo: boolean;
  data: DataSource;
};

export const WorkspaceContext = createContext<WorkspaceState | null>(null);
