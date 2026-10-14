import { CreditCard, Lock } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/layout/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/hooks/useWorkspace";

export function BillingPage() {
  const { workspace, can } = useWorkspace();

  if (!can("billing.manage")) {
    return <EmptyState icon={Lock} title="Hanya Owner yang dapat membuka Billing" className="mt-8 bg-white" />;
  }

  return (
    <>
      <PageHeader title="Billing" description="Paket langganan dan pemakaian workspace." />
      <div className="grid gap-5 md:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardDescription>Paket saat ini</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              {workspace.plan === "free" ? "Free" : workspace.plan}
              {workspace.isDemo && <Badge variant="secondary">Workspace demo</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Tidak ada tagihan. Belum ada transaksi.</CardContent>
        </Card>
        <EmptyState
          icon={CreditCard}
          title="Paket berbayar & pemakaian tersedia di Fase 7"
          description="Kuota keyword, analisis AI, balasan harian, dan jumlah anggota akan ditampilkan di sini."
          className="bg-white"
        />
      </div>
    </>
  );
}
