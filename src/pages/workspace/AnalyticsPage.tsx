import { BarChart3 } from "lucide-react";
import { useState } from "react";
import { BarList, ColumnChart, TrendChart } from "@/components/charts/charts";
import { MetricCard, NotYetAvailable } from "@/components/intelligence/states";
import { QueryBoundary } from "@/components/layout/QueryBoundary";
import { PageHeader } from "@/components/layout/states";
import { TabList } from "@/components/layout/Tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDailyStats, useOpportunities } from "@/hooks/useData";
import { useWorkspace } from "@/hooks/useWorkspace";
import { formatDate, formatNumber, formatPercent, formatRate, formatShortDate } from "@/utils/format";
import { conversionRate, funnel, sumStats, topKeywords, topOfferings } from "./derive";

const RANGES = [
  { value: "7", label: "7 hari" },
  { value: "14", label: "14 hari" },
  { value: "30", label: "30 hari" },
] as const;
type Range = (typeof RANGES)[number]["value"];

export function AnalyticsPage() {
  const { data } = useWorkspace();
  const stats = useDailyStats();
  const opportunities = useOpportunities();
  const [range, setRange] = useState<Range>("30");
  const [showTable, setShowTable] = useState(false);

  return (
    <>
      <PageHeader title="Analytics" description="Performa discovery, pencocokan, balasan, dan konversi." />
      {!data.intelligence.capabilities.stats ? (
        <NotYetAvailable icon={BarChart3} title="Belum ada data analytics" description="Metrik dihitung dari agregasi harian di backend (Fase 6)." />
      ) : (
        <QueryBoundary query={stats}>
          {(all) => {
            const days = all.slice(-Number(range));
            const t = sumStats(days);
            const chart = days.map((d) => ({ ...d, day: formatShortDate(d.date) }));
            return (
              <div className="grid gap-5">
                <TabList label="Rentang waktu" value={range} onChange={setRange} tabs={RANGES.map((r) => ({ ...r }))} />
                <section aria-label="Ringkasan" className="-mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <MetricCard label="Percakapan ditemukan" value={formatNumber(t.discovered)} />
                  <MetricCard label="Peluang qualified" value={formatNumber(t.qualified)} hint={formatPercent(t.qualified, t.discovered)} />
                  <MetricCard label="Product match rate" value={formatPercent(t.matched, t.qualified)} hint="match ÷ qualified" />
                  <MetricCard label="Balasan terkirim" value={formatNumber(t.repliesSent)} />
                  <MetricCard label="Engagement rate" value={formatPercent(t.engaged, t.repliesSent)} hint="engaged ÷ terkirim" />
                  <MetricCard label="Lead terkonversi" value={formatNumber(t.converted)} />
                  <MetricCard label="Conversion rate" value={formatRate(conversionRate(t))} hint="konversi ÷ percakapan" />
                  <MetricCard label="Draft AI dibuat" value={formatNumber(t.drafts)} />
                </section>
                <div className="grid gap-5 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Percakapan & peluang</CardTitle>
                      <CardDescription>Per hari</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <TrendChart
                        data={chart}
                        x="day"
                        label="Percakapan ditemukan dan peluang qualified per hari"
                        series={[
                          { key: "discovered", label: "Percakapan ditemukan" },
                          { key: "qualified", label: "Peluang qualified" },
                        ]}
                      />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Balasan terkirim</CardTitle>
                      <CardDescription>Per hari</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ColumnChart data={chart} x="day" y="repliesSent" label="Balasan terkirim per hari" height={240} />
                    </CardContent>
                  </Card>
                </div>
                <div className="grid gap-5 lg:grid-cols-3">
                  <Card>
                    <CardHeader>
                      <CardTitle>Funnel</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <BarList items={funnel(t)} />
                    </CardContent>
                  </Card>
                  <QueryBoundary query={opportunities}>
                    {(opps) => (
                      <>
                        <Card>
                          <CardHeader>
                            <CardTitle>Top keywords</CardTitle>
                            <CardDescription>Dari peluang terbaru</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <BarList items={topKeywords(opps)} />
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader>
                            <CardTitle>Top produk/layanan</CardTitle>
                            <CardDescription>Dari peluang terbaru</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <BarList items={topOfferings(opps)} />
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </QueryBoundary>
                </div>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Data harian</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
                      {showTable ? "Sembunyikan tabel" : "Tampilkan tabel"}
                    </Button>
                  </CardHeader>
                  {showTable && (
                    <CardContent className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-right text-sm tabular-nums">
                        <thead className="text-xs text-muted-foreground">
                          <tr className="border-b">
                            {["Tanggal", "Ditemukan", "Qualified", "Match", "Draft", "Terkirim", "Engaged", "Konversi"].map((h, i) => (
                              <th key={h} scope="col" className={i === 0 ? "py-2 text-left font-medium" : "py-2 font-medium"}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {[...days].reverse().map((d) => (
                            <tr key={d.date}>
                              <th scope="row" className="py-1.5 text-left font-normal">{formatDate(d.date)}</th>
                              <td>{d.discovered}</td>
                              <td>{d.qualified}</td>
                              <td>{d.matched}</td>
                              <td>{d.drafts}</td>
                              <td>{d.repliesSent}</td>
                              <td>{d.engaged}</td>
                              <td>{d.converted}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  )}
                </Card>
              </div>
            );
          }}
        </QueryBoundary>
      )}
    </>
  );
}
