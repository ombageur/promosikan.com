import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router";
import { ErrorState, FullPageSpinner } from "@/components/layout/states";
import { useCurrentUser } from "@/hooks/useAuth";
import { useMyWorkspaces } from "@/hooks/useWorkspace";
import { errorMessage } from "@/lib/firebase/callable";
import { getUserProfile } from "@/services/users";

/** /app → workspace terakhir, workspace pertama, atau onboarding. */
export function AppIndexPage() {
  const user = useCurrentUser();
  const workspaces = useMyWorkspaces();
  const profile = useQuery({ queryKey: ["user-profile", user.uid], queryFn: () => getUserProfile(user.uid) });

  if (workspaces.isPending || profile.isPending) return <FullPageSpinner />;
  if (workspaces.isError) {
    return (
      <div className="mx-auto max-w-md px-4 py-20">
        <ErrorState message={errorMessage(workspaces.error)} onRetry={() => workspaces.refetch()} />
      </div>
    );
  }

  const list = workspaces.data;
  const last = profile.data?.lastWorkspaceId;
  const target = list.find((w) => w.id === last) ?? list[0];
  return <Navigate to={target ? `/w/${target.id}` : "/onboarding"} replace />;
}
