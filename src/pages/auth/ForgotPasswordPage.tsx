import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { z } from "zod";
import { Field } from "@/components/forms/Field";
import { fieldAria } from "@/components/forms/field-aria";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FirebaseError } from "firebase/app";
import { errorMessage } from "@/lib/firebase/callable";
import { sendPasswordReset } from "@/services/auth";

const schema = z.object({ email: z.email("Email tidak valid") });
type Values = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await sendPasswordReset(email);
      setSentTo(email);
    } catch (e) {
      // Jangan bocorkan apakah email terdaftar.
      if (e instanceof FirebaseError && e.code === "auth/user-not-found") setSentTo(email);
      else setError(errorMessage(e));
    }
  });

  return (
    <AuthLayout
      title="Lupa kata sandi"
      description="Kami akan mengirim link untuk membuat kata sandi baru."
      footer={
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Kembali ke halaman masuk
        </Link>
      }
    >
      {sentTo ? (
        <Alert>
          <MailCheck aria-hidden />
          <AlertTitle>Cek email Anda</AlertTitle>
          <AlertDescription>
            Jika {sentTo} terdaftar, link reset kata sandi sudah dikirim. Periksa juga folder spam.
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Field id="email" label="Email" error={errors.email?.message}>
            <Input type="email" autoComplete="email" {...fieldAria("email", errors.email?.message)} {...form.register("email")} />
          </Field>
          <Button type="submit" className="h-10" disabled={isSubmitting}>
            {isSubmitting ? "Mengirim…" : "Kirim link reset"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
