import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, UserPlus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ASSIGNABLE_ROLES, type AssignableRole, ROLE_DESCRIPTIONS } from "@shared/permissions";
import { Field } from "@/components/forms/Field";
import { fieldAria } from "@/components/forms/field-aria";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/hooks/useWorkspace";
import { errorMessage } from "@/lib/firebase/callable";
import { inviteMember } from "@/services/workspaces";
import { ROLE_ITEMS } from "./roles";

const schema = z.object({ email: z.email("Email tidak valid"), role: z.enum(ASSIGNABLE_ROLES) });
type Values = z.infer<typeof schema>;

export function InviteMemberDialog() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ email: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", role: "marketing" } });
  const { errors } = form.formState;
  const role = useWatch({ control: form.control, name: "role" });

  const invite = useMutation({
    mutationFn: (values: Values) => inviteMember({ workspaceId: workspace.id, ...values }),
    onSuccess: (data, values) => {
      setResult({ email: values.email, url: data.inviteUrl });
      void queryClient.invalidateQueries({ queryKey: ["invitations", workspace.id] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setResult(null);
      setCopied(false);
      form.reset();
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      toast.error("Gagal menyalin. Salin link secara manual.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>
        <UserPlus aria-hidden />
        Undang anggota
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Undang anggota tim</DialogTitle>
          <DialogDescription>Link undangan berlaku 7 hari dan hanya bisa dipakai sekali oleh email yang diundang.</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="grid gap-3">
            <Alert role="status">
              <AlertDescription>
                Undangan untuk <strong>{result.email}</strong> dibuat. Jika email undangan belum aktif di workspace ini, bagikan
                link berikut secara langsung:
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Input readOnly value={result.url} aria-label="Link undangan" onFocus={(e) => e.currentTarget.select()} />
              <Button variant="outline" onClick={() => copy(result.url)} aria-label="Salin link">
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Selesai</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit((values) => invite.mutate(values))} className="grid gap-4" noValidate>
            <Field id="invite-email" label="Email" error={errors.email?.message}>
              <Input type="email" autoComplete="off" {...fieldAria("invite-email", errors.email?.message)} {...form.register("email")} />
            </Field>
            <Field id="invite-role" label="Role" hint={ROLE_DESCRIPTIONS[role as AssignableRole]}>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Select items={ROLE_ITEMS} value={field.value} onValueChange={(value) => field.onChange(value)}>
                    <SelectTrigger id="invite-role" className="w-full">
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
                )}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending ? "Mengirim…" : "Kirim undangan"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
