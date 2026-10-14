import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, PlayCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { createWorkspaceInput, type CreateWorkspaceInput } from "@shared/schemas/workspace";
import { Field } from "@/components/forms/Field";
import { fieldAria } from "@/components/forms/field-aria";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/useAuth";
import { myWorkspacesKey, useMyWorkspaces } from "@/hooks/useWorkspace";
import { errorMessage } from "@/lib/firebase/callable";
import { createWorkspace } from "@/services/workspaces";

export function OnboardingPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: workspaces } = useMyWorkspaces();
  const form = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceInput),
    defaultValues: { name: "", businessName: "", industry: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const isFirst = !workspaces || workspaces.length === 0;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const { workspaceId } = await createWorkspace(values);
      await queryClient.invalidateQueries({ queryKey: myWorkspacesKey(user.uid) });
      toast.success("Workspace dibuat.");
      navigate(`/w/${workspaceId}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <AuthLayout
      title={isFirst ? "Buat workspace pertama Anda" : "Buat workspace baru"}
      description="Workspace menyimpan profil bisnis, katalog, dan tim Anda. Data setiap workspace terpisah."
      footer={
        isFirst ? (
          <Link to="/demo" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
            <PlayCircle className="size-4" aria-hidden />
            Lihat demo Publish Agency dulu
          </Link>
        ) : (
          <Link to="/app" className="font-semibold text-primary hover:underline">
            Kembali ke workspace
          </Link>
        )
      }
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <Field id="name" label="Nama workspace" error={errors.name?.message} hint="Contoh: Publish Agency — Tim Sales">
          <Input {...fieldAria("name", errors.name?.message)} {...form.register("name")} />
        </Field>
        <Field id="businessName" label="Nama bisnis" error={errors.businessName?.message}>
          <Input autoComplete="organization" {...fieldAria("businessName", errors.businessName?.message)} {...form.register("businessName")} />
        </Field>
        <Field id="industry" label="Industri (opsional)" error={errors.industry?.message}>
          <Input placeholder="Digital Marketing" {...fieldAria("industry", errors.industry?.message)} {...form.register("industry")} />
        </Field>
        <Button type="submit" className="h-10" disabled={isSubmitting}>
          {isSubmitting ? "Membuat…" : "Buat workspace"}
          {!isSubmitting && <ArrowRight aria-hidden />}
        </Button>
      </form>
    </AuthLayout>
  );
}
