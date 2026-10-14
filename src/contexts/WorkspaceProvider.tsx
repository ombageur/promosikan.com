import { onSnapshot } from "firebase/firestore";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { can as roleCan, isRole, type Role } from "@shared/permissions";
import { useCurrentUser } from "@/hooks/useAuth";
import { firestoreCatalog } from "@/services/data/firestoreCatalog";
import { firestoreIntelligence } from "@/services/data/firestoreIntelligence";
import { demoIntelligence } from "@/services/data/memorySources";
import type { DataSource } from "@/services/data/types";
import { setLastWorkspace } from "@/services/users";
import { memberDoc, toWorkspace, workspaceDoc } from "@/services/workspaces";
import type { Workspace } from "@/types/workspace";
import { WorkspaceContext, type WorkspaceState } from "./workspace-context";

type Status = "loading" | "ready" | "forbidden" | "error";

type Props = {
  workspaceId: string;
  children: ReactNode;
  /** Ditampilkan saat memuat / tanpa akses / error. */
  fallback: (status: Exclude<Status, "ready">) => ReactNode;
};

type Snapshot = { key: string; workspace?: Workspace; role?: Role; status: Status };

/**
 * Memuat workspace aktif dan role pengguna secara realtime, sehingga perubahan role
 * atau pengeluaran dari workspace langsung berlaku tanpa reload.
 */
export function WorkspaceProvider({ workspaceId, children, fallback }: Props) {
  const user = useCurrentUser();
  const key = `${workspaceId}:${user.uid}`;
  const [snapshot, setSnapshot] = useState<Snapshot>({ key, status: "loading" });

  useEffect(() => {
    // Snapshot milik workspace/user sebelumnya dibuang agar data tidak tercampur saat berpindah workspace.
    const merge = (patch: Partial<Snapshot>) =>
      setSnapshot((prev) => {
        const base: Snapshot = prev.key === key ? prev : { key, status: "loading" };
        const next = { ...base, ...patch };
        if (!patch.status) next.status = next.workspace && next.role ? "ready" : "loading";
        return next;
      });
    const fail = (error: { code?: string }) => merge({ status: error.code === "permission-denied" ? "forbidden" : "error" });

    const unsubMember = onSnapshot(
      memberDoc(workspaceId, user.uid),
      (snap) => {
        const role: unknown = snap.get("role");
        merge(snap.exists() && isRole(role) ? { role } : { role: undefined, status: "forbidden" });
      },
      fail,
    );
    const unsubWorkspace = onSnapshot(
      workspaceDoc(workspaceId),
      (snap) =>
        merge(snap.exists() ? { workspace: toWorkspace(snap.id, snap.data()) } : { workspace: undefined, status: "forbidden" }),
      fail,
    );
    return () => {
      unsubMember();
      unsubWorkspace();
    };
  }, [workspaceId, user.uid, key]);

  const ready = snapshot.key === key && snapshot.status === "ready";

  useEffect(() => {
    if (ready) setLastWorkspace(user.uid, workspaceId).catch(() => undefined);
  }, [ready, user.uid, workspaceId]);

  // Katalog selalu dari Firestore. Peluang/draft: fixtures untuk workspace demo, Firestore untuk workspace nyata.
  const isDemo = snapshot.workspace?.isDemo ?? false;
  const data = useMemo<DataSource>(
    () => ({
      key: `ws:${workspaceId}:${isDemo ? "demo" : "live"}`,
      catalog: firestoreCatalog(workspaceId),
      intelligence: isDemo ? demoIntelligence() : firestoreIntelligence(workspaceId),
    }),
    [workspaceId, isDemo],
  );

  const value = useMemo<WorkspaceState | null>(() => {
    if (!ready || !snapshot.workspace || !snapshot.role) return null;
    const role = snapshot.role;
    return {
      workspace: snapshot.workspace,
      role,
      can: (permission) => roleCan(role, permission),
      basePath: `/w/${workspaceId}`,
      isPublicDemo: false,
      data,
    };
  }, [ready, snapshot.workspace, snapshot.role, workspaceId, data]);

  if (!value) {
    const status = snapshot.key === key && snapshot.status !== "ready" ? snapshot.status : "loading";
    return <>{fallback(status)}</>;
  }
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
