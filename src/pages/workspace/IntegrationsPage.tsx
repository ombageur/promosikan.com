import { Bot } from "lucide-react";
import { PageHeader } from "@/components/layout/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { planLimits } from "@shared/plans";
import { useCapabilities } from "@/hooks/useData";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getAiUsage } from "@/services/ai";
import { formatNumber } from "@/utils/format";
import { ThreadsCard } from "./ThreadsCard";

/** Tidak ada integrasi palsu: status jujur sampai OAuth & API benar-benar diimplementasikan. */
function UsageLine() {
  const { workspace } = useWorkspace();
  const usage = useQuery({ queryKey: ["ai-usage", workspace.id], queryFn: () => getAiUsage(workspace.id) });
  if (usage.isPending) return <p>Memuat pemakaian…</p>;
  if (usage.isError) return <p>Pemakaian tidak dapat dimuat.</p>;
  const limit = planLimits(workspace.plan).aiCallsPerMonth;
  return (
    <p className="text-foreground">
      Pemakaian bulan ini: <strong className="tabular-nums">{formatNumber(usage.data.aiCalls)}</strong> dari {formatNumber(limit)} panggilan AI
    </p>
  );
}

export function IntegrationsPage() {
  const { workspace, can } = useWorkspace();
  const caps = useCapabilities();

  return (
    <>
      <PageHeader title="Integrations" description="Koneksi ke platform resmi. Promosikan.com tidak memakai scraping atau otomasi browser." />
      <div className="grid gap-5 md:grid-cols-2">
        <ThreadsCard />
        <Card>
          <CardHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Bot className="size-5" aria-hidden />
            </div>
            <CardTitle className="flex flex-wrap items-center gap-2">
              AI (Claude)
              {caps.ai ? <Badge>Aktif</Badge> : <Badge variant="outline">Tidak dipakai di demo</Badge>}
            </CardTitle>
            <CardDescription>
              Analisis intent, scoring, pencocokan katalog, dan draft balasan. Dikelola platform — tidak perlu API key Anda.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            {caps.ai ? (
              <>
                <p>Dipakai untuk Analisis Manual, draft balasan, dan pemeriksaan kualitas. Kuota paket Free: {planLimits(workspace.plan).aiCallsPerMonth} panggilan/bulan.</p>
                {can("audit.read") && <UsageLine />}
              </>
            ) : (
              <p>Workspace demo memakai data contoh dan tidak memanggil AI.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
