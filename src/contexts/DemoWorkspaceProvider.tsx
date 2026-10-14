import { type ReactNode, useMemo } from "react";
import { DEMO_PROFILE } from "@shared/demo/publishAgency";
import { can } from "@shared/permissions";
import { demoIntelligence, memoryCatalog } from "@/services/data/memorySources";
import { WorkspaceContext, type WorkspaceState } from "./workspace-context";

/**
 * Workspace demo publik (/demo) tanpa login. Semua data dari fixtures di memori;
 * tidak ada pembacaan/penulisan Firestore dan tidak ada panggilan ke platform sosial.
 */
export function DemoWorkspaceProvider({ children }: { children: ReactNode }) {
  const value = useMemo<WorkspaceState>(
    () => ({
      workspace: {
        id: "demo",
        ...DEMO_PROFILE,
        ownerId: "demo",
        plan: "free",
        isDemo: true,
        logoPath: null,
        logoUrl: null,
      },
      // Pengunjung demo melihat semua fitur seperti Owner.
      role: "owner",
      can: (permission) => can("owner", permission),
      basePath: "/demo",
      isPublicDemo: true,
      data: { key: "public-demo", catalog: memoryCatalog(), intelligence: demoIntelligence() },
    }),
    [],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
