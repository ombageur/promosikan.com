import { MailCheck } from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation } from "react-router";
import { toast } from "sonner";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { useAuth, useCurrentUser } from "@/hooks/useAuth";
import { errorMessage } from "@/lib/firebase/callable";
import { redirectTarget } from "@/routes/redirect";
import { refreshVerification, resendVerificationEmail, signOut } from "@/services/auth";

export function VerifyEmailPage() {
  const user = useCurrentUser();
  const { emailVerified, refreshUser } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);

  if (emailVerified) return <Navigate to={redirectTarget(location.state)} replace />;

  async function check() {
    setChecking(true);
    try {
      const verified = await refreshVerification(user);
      if (verified) refreshUser();
      else toast.info("Email belum terverifikasi. Klik link di email Anda terlebih dahulu.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setChecking(false);
    }
  }

  async function resend() {
    setSending(true);
    try {
      await resendVerificationEmail(user);
      toast.success("Email verifikasi dikirim ulang.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthLayout
      title="Verifikasi email Anda"
      description={
        <>
          Kami mengirim link verifikasi ke <strong className="text-foreground">{user.email}</strong>. Verifikasi diperlukan
          untuk menjaga keamanan data workspace.
        </>
      }
      footer={
        <button type="button" onClick={() => signOut()} className="font-semibold text-primary hover:underline">
          Masuk dengan akun lain
        </button>
      }
    >
      <div className="grid gap-3">
        <div className="mb-2 flex justify-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
            <MailCheck className="size-7" aria-hidden />
          </span>
        </div>
        <Button className="h-10" onClick={check} disabled={checking}>
          {checking ? "Memeriksa…" : "Saya sudah verifikasi"}
        </Button>
        <Button variant="outline" className="h-10" onClick={resend} disabled={sending}>
          {sending ? "Mengirim…" : "Kirim ulang email"}
        </Button>
      </div>
    </AuthLayout>
  );
}
