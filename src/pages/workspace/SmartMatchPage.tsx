import { Sparkles } from "lucide-react";
import { Link } from "react-router";
import { REPLY_STYLE_LABELS } from "@shared/schemas/automation";
import { ScoreBadge } from "@/components/intelligence/badges";
import { NotYetAvailable } from "@/components/intelligence/states";
import { QueryBoundary } from "@/components/layout/QueryBoundary";
import { PageHeader } from "@/components/layout/states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useOfferings, useOpportunities } from "@/hooks/useData";
import { useWorkspace } from "@/hooks/useWorkspace";

export function SmartMatchPage() {
  const { data, basePath } = useWorkspace();
  const opportunities = useOpportunities();
  const offerings = useOfferings();
  const active = offerings.data?.filter((o) => o.isActive).length;

  return (
    <>
      <PageHeader
        title="Smart Match"
        description="AI mencocokkan kebutuhan calon pelanggan dengan katalog Anda. Jika tidak ada yang relevan, pencocokan tidak dipaksakan."
      />
      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p>
            Katalog aktif: <strong className="tabular-nums">{active ?? "…"}</strong> produk/layanan dipakai untuk pencocokan.
          </p>
          <Link to={`${basePath}/products`} className="font-semibold text-primary hover:underline">
            Kelola katalog
          </Link>
        </CardContent>
      </Card>
      {!data.intelligence.available ? (
        <NotYetAvailable icon={Sparkles} title="Belum ada hasil pencocokan" description="Smart Match berjalan bersama analisis AI di Fase 3." />
      ) : (
        <QueryBoundary query={opportunities}>
          {(opps) => (
            <Card>
              <CardHeader>
                <CardTitle>Hasil pencocokan</CardTitle>
                <CardDescription>Diurutkan dari match score tertinggi</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th scope="col" className="py-2 pr-3 font-medium">Kebutuhan pelanggan</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Produk/layanan</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Match score</th>
                      <th scope="col" className="py-2 font-medium">Pendekatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[...opps]
                      .sort((a, b) => (b.matches[0]?.matchScore ?? -1) - (a.matches[0]?.matchScore ?? -1))
                      .map((o) => {
                        const top = o.matches[0];
                        return (
                          <tr key={o.id} className="align-top">
                            <td className="py-3 pr-3">
                              <p className="font-medium">{o.customerProblem}</p>
                              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                {o.post.authorHandle}: “{o.post.text}”
                              </p>
                            </td>
                            <td className="py-3 pr-3">
                              {top ? (
                                <>
                                  <p>{top.offeringName}</p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">{top.reason}</p>
                                  {o.matches.length > 1 && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Alternatif: {o.matches.slice(1).map((m) => `${m.offeringName} (${m.matchScore})`).join(", ")}
                                    </p>
                                  )}
                                </>
                              ) : (
                                <span className="text-muted-foreground">Tidak ada yang cocok</span>
                              )}
                            </td>
                            <td className="py-3 pr-3">{top ? <ScoreBadge score={top.matchScore} showLabel={false} /> : "—"}</td>
                            <td className="py-3">{top ? REPLY_STYLE_LABELS[top.approach] : "Jangan dibalas"}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </QueryBoundary>
      )}
    </>
  );
}
