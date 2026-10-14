import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ImageUp, Lock, Trash2 } from "lucide-react";
import { useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  type WorkspaceProfile,
  type WorkspaceProfileInput,
  workspaceProfileSchema,
} from "@shared/schemas/workspace";
import { Field } from "@/components/forms/Field";
import { fieldAria } from "@/components/forms/field-aria";
import { PageHeader } from "@/components/layout/states";
import { WorkspaceAvatar } from "@/components/layout/WorkspaceAvatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/hooks/useWorkspace";
import { errorMessage } from "@/lib/firebase/callable";
import type { Workspace } from "@/types/workspace";
import {
  LOGO_TYPES,
  removeWorkspaceLogo,
  updateWorkspaceProfile,
  uploadWorkspaceLogo,
} from "@/services/workspaces";

const LANGUAGE_ITEMS = [
  { value: "id", label: "Bahasa Indonesia" },
  { value: "en", label: "English" },
];

const profileOf = (w: Workspace): WorkspaceProfileInput => ({
  name: w.name,
  businessName: w.businessName,
  industry: w.industry ?? "",
  website: w.website ?? "",
  description: w.description ?? "",
  location: w.location ?? "",
  contactEmail: w.contactEmail ?? "",
  contactPhone: w.contactPhone ?? "",
  brandVoice: w.brandVoice ?? "",
  preferredLanguage: w.preferredLanguage ?? "id",
});

function LogoCard({ editable }: { editable: boolean }) {
  const { workspace } = useWorkspace();
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (file: File) => uploadWorkspaceLogo(workspace, file),
    onSuccess: () => toast.success("Logo diperbarui."),
    onError: (error) => toast.error(error instanceof Error && !("code" in error) ? error.message : errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: () => removeWorkspaceLogo(workspace),
    onSuccess: () => toast.success("Logo dihapus."),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const busy = upload.isPending || remove.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo</CardTitle>
        <CardDescription>PNG, JPG, atau WebP, maksimal 2 MB.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-4">
        <WorkspaceAvatar name={workspace.name} logoUrl={workspace.logoUrl} className="size-16 rounded-xl text-2xl" />
        {editable && (
          <div className="flex flex-wrap gap-2">
            <input
              ref={input}
              type="file"
              accept={LOGO_TYPES.join(",")}
              className="sr-only"
              aria-label="Pilih file logo"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate(file);
                e.target.value = "";
              }}
            />
            <Button variant="outline" onClick={() => input.current?.click()} disabled={busy}>
              <ImageUp aria-hidden />
              {upload.isPending ? "Mengunggah…" : "Unggah logo"}
            </Button>
            {workspace.logoUrl && (
              <Button variant="ghost" onClick={() => remove.mutate()} disabled={busy}>
                <Trash2 aria-hidden />
                Hapus
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SettingsPage() {
  const { workspace, can } = useWorkspace();
  const editable = can("workspace.update");
  const form = useForm<WorkspaceProfileInput, unknown, WorkspaceProfile>({
    resolver: zodResolver(workspaceProfileSchema),
    values: profileOf(workspace),
    resetOptions: { keepDirtyValues: true },
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateWorkspaceProfile(workspace.id, values);
      form.reset(values);
      toast.success("Profil bisnis disimpan.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  const text = (name: keyof WorkspaceProfileInput, label: string, props: React.ComponentProps<typeof Input> = {}, hint?: string) => (
    <Field id={name} label={label} error={errors[name]?.message} hint={hint}>
      <Input {...props} {...fieldAria(name, errors[name]?.message)} {...form.register(name)} />
    </Field>
  );

  return (
    <>
      <PageHeader
        title="Pengaturan Workspace"
        description="Profil bisnis ini dipakai AI untuk mencocokkan percakapan dan menyusun balasan sesuai brand Anda."
      />
      {!editable && (
        <Alert className="mb-5">
          <Lock aria-hidden />
          <AlertDescription>Hanya Owner dan Admin yang dapat mengubah pengaturan workspace.</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-5">
        <LogoCard editable={editable} />
        <Card>
          <CardHeader>
            <CardTitle>Profil bisnis</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} noValidate>
              <fieldset disabled={!editable || isSubmitting} className="grid gap-4 sm:grid-cols-2">
                {text("name", "Nama workspace")}
                {text("businessName", "Nama bisnis", { autoComplete: "organization" })}
                {text("industry", "Industri", { placeholder: "Digital Marketing" })}
                {text("website", "Website", { type: "url", placeholder: "https://" })}
                {text("location", "Lokasi", { placeholder: "Surabaya, Indonesia" })}
                {text("contactEmail", "Email kontak", { type: "email" })}
                {text("contactPhone", "Telepon/WhatsApp", { type: "tel" })}
                <Field id="preferredLanguage" label="Bahasa utama" error={errors.preferredLanguage?.message}>
                  <Controller
                    control={form.control}
                    name="preferredLanguage"
                    render={({ field }) => (
                      <Select
                        items={LANGUAGE_ITEMS}
                        value={field.value}
                        onValueChange={(value) => field.onChange(value)}
                        disabled={!editable}
                      >
                        <SelectTrigger id="preferredLanguage" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGE_ITEMS.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field
                  id="brandVoice"
                  label="Brand voice"
                  className="sm:col-span-2"
                  error={errors.brandVoice?.message}
                  hint="Contoh: ramah, konsultatif, tidak memaksa, memakai sapaan 'Kak'."
                >
                  <Input {...fieldAria("brandVoice", errors.brandVoice?.message)} {...form.register("brandVoice")} />
                </Field>
                <Field id="description" label="Deskripsi bisnis" className="sm:col-span-2" error={errors.description?.message}>
                  <Textarea rows={4} {...fieldAria("description", errors.description?.message)} {...form.register("description")} />
                </Field>
                {editable && (
                  <div className="flex justify-end gap-2 sm:col-span-2">
                    <Button type="button" variant="ghost" disabled={!isDirty} onClick={() => form.reset(profileOf(workspace))}>
                      Batalkan
                    </Button>
                    <Button type="submit" disabled={!isDirty || isSubmitting}>
                      {isSubmitting ? "Menyimpan…" : "Simpan perubahan"}
                    </Button>
                  </div>
                )}
              </fieldset>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
