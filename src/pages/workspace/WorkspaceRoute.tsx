import { ShieldOff } from "lucide-react";
import { Link, useParams } from "react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Brand } from "@/components/layout/Brand";
import { EmptyState, ErrorState, FullPageSpinner } from "@/components/layout/states";
import { Button } from "@/components/ui/button";
import { WorkspaceProvider } from "@/contexts/WorkspaceProvider";

function Blocked({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-6 px-4">
      <Brand />
      {children}
    </main>
  );
}

/** /w/:workspaceId — memuat workspace + role, lalu merender layout aplikasi. */
export function WorkspaceRoute() {
  const { workspaceId = "" } = useParams();

  return (
    <WorkspaceProvider
      key={workspaceId}
      workspaceId={workspaceId}
      fallback={(status) => {
        if (status === "loading") return <FullPageSpinner label="Memuat workspace…" />;
        if (status === "forbidden") {
          return (
            <Blocked>
              <EmptyState
                icon={ShieldOff}
                title="Anda tidak memiliki akses ke workspace ini"
                description="Workspace tidak ditemukan, atau Anda bukan (lagi) anggotanya."
                action={<Button nativeButton={false} render={<Link to="/app" />}>Ke workspace saya</Button>}
                className="w-full bg-white"
              />
            </Blocked>
          );
        }
        return (
          <Blocked>
            <ErrorState message="Workspace gagal dimuat. Periksa koneksi Anda." onRetry={() => window.location.reload()} />
          </Blocked>
        );
      }}
    >
      <AppLayout />
    </WorkspaceProvider>
  );
}
