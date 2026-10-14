import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlayCircle } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/firebase/callable";
import { createDemoWorkspace } from "@/services/workspaces";

/** Buat (atau buka kembali) workspace demo Publish Agency milik pengguna. */
export function TryDemoWorkspaceButton({ className }: { className?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: () => createDemoWorkspace(),
    onSuccess: async ({ workspaceId }) => {
      await queryClient.invalidateQueries({ queryKey: ["my-workspaces"] });
      navigate(`/w/${workspaceId}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <Button type="button" variant="outline" className={className} onClick={() => create.mutate()} disabled={create.isPending}>
      <PlayCircle aria-hidden />
      {create.isPending ? "Menyiapkan…" : "Coba workspace demo"}
    </Button>
  );
}
