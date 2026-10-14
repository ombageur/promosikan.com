import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailWarning, UsersRound } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@shared/permissions";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { FullPageSpinner } from "@/components/layout/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useAuth";
import { myWorkspacesKey } from "@/hooks/useWorkspace";
import { errorMessage } from "@/lib/firebase/callable";
import { signOut } from "@/services/auth";
import { acceptInvitation, getInvitation } from "@/services/workspaces";

export function InvitePage() {
  const { inviteId = "" } = useParams();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const user = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [now] = useState(Date.now);

  // Rules hanya mengizinkan penerima (email cocok) membaca undangan; error = email lain / tidak valid.
  const invite = useQuery({ queryKey: ["invitation", inviteId], queryFn: () => getInvitation(inviteId), retry: false });

  const accept = useMutation({
    mutationFn: () => acceptInvitation({ inviteId, token }),
    onSuccess: async ({ workspaceId, alreadyMember }) => {
      await queryClient.invalidateQueries({ queryKey: myWorkspacesKey(user.uid) });
      toast.success(alreadyMember ? "Anda sudah menjadi anggota workspace ini." : "Selamat bergabung!");
      navigate(`/w/${workspaceId}`, { replace: true });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (invite.isPending) return <FullPageSpinner />;

  const data = invite.data;
  const expired = data ? data.expiresAt.toMillis() <= now : false;
  const usable = data && data.status === "pending" && !expired && token;

  return (
    <AuthLayout
      title="Undangan workspace"
      footer={
        <Link to="/app" className="font-semibold text-primary hover:underline">
          Ke aplikasi
        </Link>
      }
    >
      {!data ? (
        <Alert variant="destructive">
          <MailWarning aria-hidden />
          <AlertTitle>Undangan tidak dapat dibuka</AlertTitle>
          <AlertDescription>
            <p>
              Link tidak valid, atau undangan ini ditujukan untuk email lain. Anda masuk sebagai <strong>{user.email}</strong>.
            </p>
            <button type="button" className="mt-2 font-semibold underline" onClick={() => signOut()}>
              Masuk dengan email lain
            </button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4">
          <div className="flex items-start gap-3 rounded-lg bg-secondary p-4">
            <UsersRound className="mt-0.5 size-5 text-primary" aria-hidden />
            <div className="text-sm">
              <p>
                <strong>{data.invitedByName || "Admin"}</strong> mengundang Anda ke workspace{" "}
                <strong>{data.workspaceName}</strong> sebagai <strong>{ROLE_LABELS[data.role]}</strong>.
              </p>
              <p className="mt-1 text-muted-foreground">{ROLE_DESCRIPTIONS[data.role]}</p>
            </div>
          </div>
          {!usable && (
            <Alert variant="destructive">
              <AlertDescription>
                {data.status === "accepted"
                  ? "Undangan ini sudah dipakai."
                  : data.status === "revoked"
                    ? "Undangan ini sudah dibatalkan admin."
                    : expired
                      ? "Undangan sudah kedaluwarsa. Minta admin mengirim undangan baru."
                      : "Link undangan tidak lengkap. Buka link dari email undangan."}
              </AlertDescription>
            </Alert>
          )}
          <Button className="h-10" disabled={!usable || accept.isPending} onClick={() => accept.mutate()}>
            {accept.isPending ? "Bergabung…" : "Terima undangan"}
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}
