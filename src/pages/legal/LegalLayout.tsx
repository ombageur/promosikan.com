import type { ReactNode } from "react";
import { Link } from "react-router";
import { Brand } from "@/components/layout/Brand";

/** Alamat kontak resmi untuk privasi & permintaan penghapusan data. Ganti jika domain/alamat berbeda. */
export const LEGAL_CONTACT_EMAIL = "privacy@promosikan.com";
export const LEGAL_UPDATED = "15 Oktober 2026";

export function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-svh bg-white">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Brand />
          <nav aria-label="Dokumen legal" className="flex gap-4 text-sm">
            <Link to="/privacy" className="text-muted-foreground hover:text-foreground">
              Privasi
            </Link>
            <Link to="/terms" className="text-muted-foreground hover:text-foreground">
              Syarat Layanan
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Terakhir diperbarui: {LEGAL_UPDATED}</p>
        <div className="mt-8 grid gap-6 text-[15px] leading-7 text-slate-700 [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc">
          {children}
        </div>
      </main>
    </div>
  );
}
