import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-bold text-blue-600">404</p>
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Halaman tidak ditemukan</h1>
      <p className="max-w-sm text-sm text-slate-500">Alamat yang Anda buka tidak tersedia atau sudah dipindahkan.</p>
      <Link to="/" className={buttonVariants()}>Kembali ke beranda</Link>
    </main>
  );
}
