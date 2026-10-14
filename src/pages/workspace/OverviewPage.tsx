import { ArrowRight, CheckCircle2, Circle, Compass, Sparkles } from "lucide-react";
import { Link } from "react-router";
import { BarList, TrendChart } from "@/components/charts/charts";
import { TryDemoWorkspaceButton } from "@/components/forms/TryDemoWorkspaceButton";
import { ScoreBadge } from "@/components/intelligence/badges";
import { PostQuote } from "@/components/intelligence/PostQuote";
import { MetricCard, NotYetAvailable } from "@/components/intelligence/states";
import { QueryBoundary } from "@/components/layout/QueryBoundary";
import { PageHeader } from "@/components/layout/states";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDailyStats, useKeywords, useOfferings, useOpportunities, useReplyDrafts } from "@/hooks/useData";
import { useWorkspace } from "@/hooks/useWorkspace";
import { formatNumber, formatPercent, formatRate, formatShortDate } from "@/utils/format";
import { conversionRate, funnel, sumStats, topKeywords, topOfferings } from "./derive";

function SetupChecklist() {
  const { workspace, basePath, can } = useWorkspace();
  const offerings = useOfferings();
  const keywords = useKeywords();
  const steps = [
    { done: true, label: "Buat workspace", to: null },
    {
      done: Boolean(workspace.description && workspace.brandVoice),
      label: "Lengkapi profil bisnis & brand voice",
      to: can("workspace.update") ? `${basePath}/settings` : null,
    },
    {
      done: (offerings.data?.length ?? 0) > 0,
      label: "Tambahkan produk & layanan",
      to: can("catalog.manage") ? `${basePath}/products` : null,
    },
    {
      done: (keywords.data?.length ?? 0) > 0,
      label: "Tentukan keyword yang dipantau",
      to: can("catalog.manage") ? `${basePath}/discover?tab=keywords` : null,
    },
    { done: false, label: "Hubungkan Threads (Fase 4)", to: null },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Langkah awal</CardTitle>
        <CardDescription>Siapkan workspace agar AI bisa mencocokkan percakapan dengan layanan Anda.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-1">
          {steps.map((step) => {
            const Icon = step.done ? CheckCircle2 : Circle;
            const content = (
              <>
                <Icon className={step.done ? "size-5 text-success" : "size-5 text-muted-foreground"} aria-hidden />
                <span className={step.done ? "text-muted-foreground line-through" : ""}>{step.label}</span>
                <span className="sr-only">{step.done ? "(selesai)" : "(belum)"}</span>
                {step.to && !step.done && <ArrowRight className="ml-auto size-4 text-muted-foreground" aria-hidden />}
              </>
            );
            return (
              <li key={step.label}>
                {step.to && !step.done ? (
                  <Link to={step.to} className="flex items-center gap-3 rounded-lg p-2 text-sm hover:bg-slate-50">
                    {content}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 p-2 text-sm">{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { basePath } = useWorkspace();
  const stats = useDailyStats();
  const opportunities = useOpportunities();
  const drafts = useReplyDrafts();
  const pending = drafts.data?.filter((d) => d.status === "pending_approval").length ?? 0;

  return (
    <div className="grid gap-5">
      <QueryBoundary query={stats}>
        {(days) => {
          const t = sumStats(days);
          const chart = days.map((d) => ({ day: formatShortDate(d.date), discovered: d.discovered, qualified: d.qualified }));
          return (
            <>
              <section aria-label="Ringkasan 30 hari" className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <MetricCard label="Percakapan ditemukan" value={formatNumber(t.discovered)} hint="30 hari terakhir" />
                <MetricCard label="Peluang qualified" value={formatNumber(t.qualified)} hint={`${formatPercent(t.qualified, t.discovered)} dari percakapan`} />
                <MetricCard label="Cocok dengan katalog" value={formatNumber(t.matched)} />
                <MetricCard label="Draft AI" value={formatNumber(t.drafts)} />
                <MetricCard label="Balasan terkirim" value={formatNumber(t.repliesSent)} />
                <MetricCard label="Lead engaged" value={formatNumber(t.engaged)} />
                <MetricCard label="Pelanggan terkonversi" value={formatNumber(t.converted)} />
                <MetricCard label="Conversion rate" value={formatRate(conversionRate(t))} hint="konversi ÷ percakapan" />
              </section>
              <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
                <Card>
                  <CardHeader>
                    <CardTitle>Pertumbuhan peluang</CardTitle>
                    <CardDescription>Percakapan ditemukan vs. peluang qualified per hari</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TrendChart
                      data={chart}
                      x="day"
                      label="Pertumbuhan peluang 30 hari"
                      series={[
                        { key: "discovered", label: "Percakapan ditemukan" },
                        { key: "qualified", label: "Peluang qualified" },
                      ]}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Funnel konversi</CardTitle>
                    <CardDescription>30 hari terakhir</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BarList items={funnel(t)} />
                  </CardContent>
                </Card>
              </div>
            </>
          );
        }}
      </QueryBoundary>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Peluang terbaru</CardTitle>
            <CardDescription>Percakapan yang relevan dengan katalog Anda</CardDescription>
            <CardAction>
              <Link to={`${basePath}/opportunities`} className="text-sm font-semibold text-primary hover:underline">
                Lihat semua
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            <QueryBoundary query={opportunities}>
              {(opps) => (
                <ul className="divide-y">
                  {[...opps]
                    .sort((a, b) => b.post.postedAt.localeCompare(a.post.postedAt))
                    .slice(0, 5)
                    .map((o) => (
                      <li key={o.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                        <PostQuote post={o.post} clamp className="min-w-0 flex-1" />
                        <ScoreBadge score={o.score} showLabel={false} />
                      </li>
                    ))}
                </ul>
              )}
            </QueryBoundary>
          </CardContent>
        </Card>
        <div className="grid content-start gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Menunggu approval</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <p className="text-3xl font-extrabold tabular-nums">{pending}</p>
              <Link to={`${basePath}/reply-center`} className="text-sm font-semibold text-primary hover:underline">
                Buka Reply Center
              </Link>
            </CardContent>
          </Card>
          <QueryBoundary query={opportunities}>
            {(opps) => (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Top keywords</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BarList items={topKeywords(opps)} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Top layanan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BarList items={topOfferings(opps)} />
                  </CardContent>
                </Card>
              </>
            )}
          </QueryBoundary>
        </div>
      </div>
    </div>
  );
}

export function OverviewPage() {
  const { workspace, data, isPublicDemo } = useWorkspace();

  return (
    <>
      <PageHeader title={`Selamat datang di ${workspace.name}`} description="Temukan yang butuh. Tawarkan yang tepat." />
      {data.intelligence.available ? (
        <Dashboard />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <SetupChecklist />
          <div className="grid content-start gap-4">
            <NotYetAvailable
              icon={Sparkles}
              title="Belum ada data peluang"
              description="Dashboard terisi setelah Threads terhubung (Fase 4) dan analisis AI berjalan (Fase 3)."
            />
            {!isPublicDemo && (
              <Card className="bg-secondary/60">
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm">
                    <Compass className="size-4 text-primary" aria-hidden />
                    Ingin mencoba alur lengkap dengan data contoh?
                  </p>
                  <TryDemoWorkspaceButton />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
