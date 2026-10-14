import { createContext } from "react";
import type { Permission, Role } from "@shared/permissions";
import type { Workspace } from "@/types/workspace";

export type WorkspaceState = {
  workspace: Workspace;
  role: Role;
  can: (permission: Permission) => boolean;
};

export const WorkspaceContext = createContext<WorkspaceState | null>(null);
