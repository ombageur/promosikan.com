import { AtSign, Bot, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/hooks/useWorkspace";

/** Tidak ada integrasi palsu: status jujur sampai OAuth & API benar-benar diimplementasikan. */
export function IntegrationsPage() {
  const { workspace, can } = useWorkspace();
  const manage = can("integrations.manage");

  return (
    <>
      <PageHeader title="Integrations" description="Koneksi ke platform resmi. Promosikan.com tidak memakai scraping atau otomasi browser." />
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-slate-900 text-white">
              <AtSign className="size-5" aria-hidden />
            </div>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Meta Threads
              <Badge variant="outline">
                <Clock aria-hidden />
                Fase 4
              </Badge>
            </CardTitle>
            <CardDescription>
              OAuth resmi untuk menemukan percakapan lewat keyword search dan membalas post yang diizinkan API.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p className="text-muted-foreground">
              {workspace.isDemo
                ? "Workspace demo tidak pernah terhubung ke platform sosial."
                : "Integrasi sedang menunggu verifikasi dokumentasi API dan App Review dari Meta."}
            </p>
            <Button variant="outline" disabled className="justify-self-start">
              Hubungkan Threads
            </Button>
            {!manage && <p className="text-xs text-muted-foreground">Hanya Owner dan Admin yang dapat mengelola integrasi.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Bot className="size-5" aria-hidden />
            </div>
            <CardTitle className="flex flex-wrap items-center gap-2">
              AI (Claude)
              <Badge variant="outline">
                <Clock aria-hidden />
                Fase 3
              </Badge>
            </CardTitle>
            <CardDescription>
              Analisis intent, scoring, pencocokan katalog, dan draft balasan. Dikelola platform — tidak perlu API key Anda.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Kuota AI per workspace mengikuti paket langganan (Fase 7).
          </CardContent>
        </Card>
      </div>
    </>
  );
}
