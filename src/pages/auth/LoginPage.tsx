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
import { signInWithEmail } from "@/services/auth";

const schema = z.object({
  email: z.email("Email tidak valid"),
  password: z.string().min(1, "Kata sandi wajib diisi"),
});
type Values = z.infer<typeof schema>;

export function LoginPage() {
  const location = useLocation();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  // Setelah login berhasil, <GuestOnly> mengarahkan ke tujuan semula.
  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    try {
      await signInWithEmail(email, password);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <AuthLayout
      title="Masuk"
      description="Kelola peluang pelanggan dan promosi bisnis Anda."
      footer={
        <>
          Belum punya akun?{" "}
          <Link to="/register" state={location.state} className="font-semibold text-primary hover:underline">
            Daftar gratis
          </Link>
        </>
      }
    >
      <GoogleButton />
      <OrDivider />
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <Field id="email" label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...fieldAria("email", errors.email?.message)} {...form.register("email")} />
        </Field>
        <Field id="password" label="Kata sandi" error={errors.password?.message}>
          <Input
            type="password"
            autoComplete="current-password"
            {...fieldAria("password", errors.password?.message)}
            {...form.register("password")}
          />
        </Field>
        <div className="-mt-2 text-right">
          <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
            Lupa kata sandi?
          </Link>
        </div>
        <Button type="submit" className="h-10" disabled={isSubmitting}>
          {isSubmitting ? "Memproses…" : "Masuk"}
        </Button>
      </form>
    </AuthLayout>
  );
}
