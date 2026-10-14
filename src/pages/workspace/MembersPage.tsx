import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, LogOut, MailPlus, MoreHorizontal, UserMinus, UsersRound } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { type AssignableRole, canChangeRole, canLeave, canRemoveMember, ROLE_LABELS } from "@shared/permissions";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { EmptyState, ErrorState, PageHeader } from "@/components/layout/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/useAuth";
import { myWorkspacesKey, useWorkspace } from "@/hooks/useWorkspace";
import { errorMessage } from "@/lib/firebase/callable";
import type { Member } from "@/types/workspace";
import {
  listMembers,
  listPendingInvitations,
  removeMember,
  revokeInvitation,
  transferOwnership,
  updateMemberRole,
} from "@/services/workspaces";
import { InviteMemberDialog } from "./InviteMemberDialog";
import { ROLE_ITEMS } from "./roles";

const ROLE_ORDER = ["owner", "admin", "marketing", "sales", "viewer"];
const dateFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });

type PendingAction = { kind: "remove" | "transfer" | "leave"; member: Member } | null;

function MemberSkeleton() {
  return (
    <div className="grid gap-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

function PendingInvitations() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [now] = useState(Date.now);
  const invitations = useQuery({ queryKey: ["invitations", workspace.id], queryFn: () => listPendingInvitations(workspace.id) });
  const revoke = useMutation({
    mutationFn: (inviteId: string) => revokeInvitation({ workspaceId: workspace.id, inviteId }),
    onSuccess: () => {
      toast.success("Undangan dibatalkan.");
      void queryClient.invalidateQueries({ queryKey: ["invitations", workspace.id] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Undangan tertunda</CardTitle>
        <CardDescription>Undangan yang belum diterima. Kedaluwarsa otomatis setelah 7 hari.</CardDescription>
      </CardHeader>
      <CardContent>
        {invitations.isPending ? (
          <MemberSkeleton />
        ) : invitations.isError ? (
          <ErrorState message={errorMessage(invitations.error)} onRetry={() => invitations.refetch()} />
        ) : invitations.data.length === 0 ? (
          <EmptyState icon={MailPlus} title="Tidak ada undangan tertunda" />
        ) : (
          <ul className="divide-y">
            {invitations.data.map((invite) => {
              const expired = invite.expiresAt.toMillis() <= now;
              return (
                <li key={invite.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {ROLE_LABELS[invite.role]} ·{" "}
                      {expired ? "Kedaluwarsa" : `Berlaku hingga ${dateFormat.format(invite.expiresAt.toDate())}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => revoke.mutate(invite.id)} disabled={revoke.isPending}>
                    Batalkan
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function MembersPage() {
  const { workspace, role: myRole, can } = useWorkspace();
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingAction>(null);
  const membersKey = ["members", workspace.id];

  // Role saya ikut menjadi bagian key agar daftar dimuat ulang setelah transfer ownership.
  const members = useQuery({
    queryKey: [...membersKey, myRole],
    queryFn: () => listMembers(workspace.id),
    select: (list) => [...list].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: membersKey });

  const changeRole = useMutation({
    mutationFn: ({ uid, role }: { uid: string; role: AssignableRole }) => updateMemberRole({ workspaceId: workspace.id, uid, role }),
    onSuccess: () => {
      toast.success("Role diperbarui.");
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const confirm = useMutation({
    mutationFn: async (action: NonNullable<PendingAction>) => {
      if (action.kind === "transfer") return transferOwnership({ workspaceId: workspace.id, newOwnerUid: action.member.uid });
      return removeMember({ workspaceId: workspace.id, uid: action.member.uid });
    },
    onSuccess: async (_data, action) => {
      setPending(null);
      if (action.kind === "leave") {
        await queryClient.invalidateQueries({ queryKey: myWorkspacesKey(user.uid) });
        toast.success(`Anda keluar dari ${workspace.name}.`);
        navigate("/app", { replace: true });
        return;
      }
      toast.success(action.kind === "transfer" ? "Ownership dipindahkan." : "Anggota dikeluarkan.");
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const dialog = pending && {
    remove: {
      title: "Keluarkan anggota?",
      description: `${pending.member.displayName || pending.member.email} akan kehilangan akses ke workspace ini.`,
      confirmLabel: "Keluarkan",
      destructive: true,
    },
    transfer: {
      title: "Transfer ownership?",
      description: `${pending.member.displayName || pending.member.email} akan menjadi Owner. Role Anda berubah menjadi Admin, dan hanya Owner baru yang bisa mengembalikannya.`,
      confirmLabel: "Transfer ownership",
      destructive: true,
    },
    leave: {
      title: "Keluar dari workspace?",
      description: `Anda akan kehilangan akses ke ${workspace.name}. Untuk bergabung lagi, Anda perlu undangan baru.`,
      confirmLabel: "Keluar",
      destructive: true,
    },
  }[pending.kind];

  return (
    <>
      <PageHeader
        title="Anggota Tim"
        description="Atur siapa yang bisa mengakses workspace ini dan apa yang boleh mereka lakukan."
        action={can("members.manage") ? <InviteMemberDialog /> : undefined}
      />
      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Anggota</CardTitle>
          </CardHeader>
          <CardContent>
            {members.isPending ? (
              <MemberSkeleton />
            ) : members.isError ? (
              <ErrorState message={errorMessage(members.error)} onRetry={() => members.refetch()} />
            ) : members.data.length === 0 ? (
              <EmptyState icon={UsersRound} title="Belum ada anggota" />
            ) : (
              <ul className="divide-y">
                {members.data.map((member) => {
                  const isMe = member.uid === user.uid;
                  const roleEditable = !isMe && canChangeRole(myRole, member.role, "viewer");
                  const removable = !isMe && canRemoveMember(myRole, member.role);
                  const transferable = !isMe && can("ownership.transfer");
                  const leavable = isMe && canLeave(myRole);
                  const hasActions = removable || transferable || leavable;

                  return (
                    <li key={member.uid} className="flex flex-wrap items-center gap-3 py-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary" aria-hidden>
                        {(member.displayName || member.email).charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {member.displayName || member.email}
                          {isMe && <span className="ml-1.5 text-xs text-muted-foreground">(Anda)</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                      </div>
                      {roleEditable && member.role !== "owner" ? (
                        <Select
                          items={ROLE_ITEMS}
                          value={member.role}
                          onValueChange={(role) => role && changeRole.mutate({ uid: member.uid, role: role as AssignableRole })}
                          disabled={changeRole.isPending}
                        >
                          <SelectTrigger className="w-36" aria-label={`Role ${member.email}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_ITEMS.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                          {member.role === "owner" && <Crown aria-hidden />}
                          {ROLE_LABELS[member.role]}
                        </Badge>
                      )}
                      {hasActions ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Aksi untuk ${member.email}`} />}>
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {transferable && (
                              <DropdownMenuItem onClick={() => setPending({ kind: "transfer", member })}>
                                <Crown aria-hidden />
                                Jadikan Owner
                              </DropdownMenuItem>
                            )}
                            {removable && (
                              <DropdownMenuItem variant="destructive" onClick={() => setPending({ kind: "remove", member })}>
                                <UserMinus aria-hidden />
                                Keluarkan
                              </DropdownMenuItem>
                            )}
                            {leavable && (
                              <DropdownMenuItem variant="destructive" onClick={() => setPending({ kind: "leave", member })}>
                                <LogOut aria-hidden />
                                Keluar dari workspace
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="size-8" aria-hidden />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {can("members.manage") && <PendingInvitations />}
      </div>

      {pending && dialog && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPending(null)}
          {...dialog}
          pending={confirm.isPending}
          onConfirm={() => confirm.mutate(pending)}
        />
      )}
    </>
  );
}
