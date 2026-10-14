import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { Field } from "@/components/forms/Field";
import { fieldAria } from "@/components/forms/field-aria";
import { GoogleButton, OrDivider } from "@/components/forms/GoogleButton";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/firebase/callable";
import { registerWithEmail } from "@/services/auth";

const schema = z
  .object({
    name: z.string().trim().min(2, "Minimal 2 karakter").max(100),
    email: z.email("Email tidak valid"),
    password: z.string().min(8, "Minimal 8 karakter").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Kata sandi tidak sama" });
type Values = z.infer<typeof schema>;

export function RegisterPage() {
  const location = useLocation();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirm: "" },
  });
  const { errors, isSubmitting } = form.formState;

  // Setelah daftar, pengguna otomatis login lalu diarahkan ke halaman verifikasi email.
  const onSubmit = form.handleSubmit(async ({ name, email, password }) => {
    try {
      await registerWithEmail(name, email, password);
      toast.success("Akun dibuat. Cek email Anda untuk verifikasi.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <AuthLayout
      title="Buat akun"
      description="Mulai temukan calon pelanggan yang sedang membutuhkan layanan Anda."
      footer={
        <>
          Sudah punya akun?{" "}
          <Link to="/login" state={location.state} className="font-semibold text-primary hover:underline">
            Masuk
          </Link>
        </>
      }
    >
      <GoogleButton label="Daftar dengan Google" />
      <OrDivider />
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <Field id="name" label="Nama lengkap" error={errors.name?.message}>
          <Input autoComplete="name" {...fieldAria("name", errors.name?.message)} {...form.register("name")} />
        </Field>
        <Field id="email" label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...fieldAria("email", errors.email?.message)} {...form.register("email")} />
        </Field>
        <Field id="password" label="Kata sandi" error={errors.password?.message} hint="Minimal 8 karakter.">
          <Input
            type="password"
            autoComplete="new-password"
            {...fieldAria("password", errors.password?.message)}
            {...form.register("password")}
          />
        </Field>
        <Field id="confirm" label="Ulangi kata sandi" error={errors.confirm?.message}>
          <Input
            type="password"
            autoComplete="new-password"
            {...fieldAria("confirm", errors.confirm?.message)}
            {...form.register("confirm")}
          />
        </Field>
        <Button type="submit" className="h-10" disabled={isSubmitting}>
          {isSubmitting ? "Membuat akun…" : "Daftar"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Dengan mendaftar, Anda menyetujui Syarat Layanan dan Kebijakan Privasi Promosikan.com.
        </p>
      </form>
    </AuthLayout>
  );
}
