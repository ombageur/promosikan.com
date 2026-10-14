import { useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { WorkspaceContext } from "@/contexts/workspace-context";
import { listMyWorkspaces } from "@/services/workspaces";
import { useCurrentUser } from "./useAuth";

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace harus dipakai di dalam <WorkspaceProvider>");
  return context;
}

export const myWorkspacesKey = (uid: string) => ["my-workspaces", uid] as const;

export function useMyWorkspaces() {
  const user = useCurrentUser();
  return useQuery({ queryKey: myWorkspacesKey(user.uid), queryFn: () => listMyWorkspaces(user.uid) });
}
