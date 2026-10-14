import { MessageCircle, Search, Sparkles, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { BAND_LABELS, type OpportunityBand } from "@shared/scoring";
import { INTENT_LABELS, INTENTS, type Opportunity } from "@shared/types/intelligence";
import { IntentBadge, RedFlagBadge, ScoreBadge } from "@/components/intelligence/badges";
import { PostQuote } from "@/components/intelligence/PostQuote";
import { NotYetAvailable } from "@/components/intelligence/states";
import { QueryBoundary } from "@/components/layout/QueryBoundary";
import { EmptyState, PageHeader } from "@/components/layout/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCapabilities, useGenerateReply, useOpportunities, useReplyDrafts, useSetOpportunityStatus } from "@/hooks/useData";
import { useWorkspace } from "@/hooks/useWorkspace";

const ALL = "all";
const BANDS: OpportunityBand[] = ["high", "medium", "low", "not_qualified"];
const BAND_ITEMS = [{ value: ALL, label: "Semua skor" }, ...BANDS.map((b) => ({ value: b, label: BAND_LABELS[b] }))];
const INTENT_ITEMS = [{ value: ALL, label: "Semua intent" }, ...INTENTS.map((i) => ({ value: i, label: INTENT_LABELS[i] }))];

function FilterSelect({ items, value, onChange, label }: { items: { value: string; label: string }[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <Select items={items} value={value} onValueChange={(v) => onChange(String(v ?? ALL))}>
      <SelectTrigger className="w-full sm:w-48" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const STATUS_LABEL = { new: "Baru", saved: "Disimpan", skipped: "Dilewati" } as const;

function OpportunityActions({ opp, draftId }: { opp: Opportunity; draftId: string | undefined }) {
  const { basePath, can } = useWorkspace();
  const caps = useCapabilities();
  const navigate = useNavigate();
  const generate = useGenerateReply();
  const setStatus = useSetOpportunityStatus();
  const replyable = opp.matches.length > 0 && opp.redFlags.length === 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {replyable && draftId && (
        <Link to={`${basePath}/reply-center?draft=${draftId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <MessageCircle aria-hidden />
          Lihat draft balasan
        </Link>
      )}
      {replyable && !draftId && caps.ai && can("ai.use") && (
        <Button
          size="sm"
          disabled={generate.isPending}
          onClick={() =>
            generate.mutate({ opportunityId: opp.id }, { onSuccess: (r) => navigate(`${basePath}/reply-center?draft=${r.draftId}`) })
          }
        >
          <Sparkles aria-hidden />
          {generate.isPending ? "Menyusun draft…" : "Buat draft balasan"}
        </Button>
      )}
      {can("reply.edit") &&
        (["saved", "skipped"] as const).map((status) => (
          <Button
            key={status}
            size="sm"
            variant="ghost"
            aria-pressed={opp.status === status}
            disabled={setStatus.isPending}
            onClick={() => setStatus.mutate({ id: opp.id, status: opp.status === status ? "new" : status })}
          >
            {opp.status === status ? `✓ ${STATUS_LABEL[status]}` : status === "saved" ? "Simpan" : "Lewati"}
          </Button>
        ))}
    </div>
  );
}

function OpportunityCard({ opp, draftId }: { opp: Opportunity; draftId: string | undefined }) {
  const top = opp.matches[0];
  return (
    <Card>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PostQuote post={opp.post} className="min-w-0 flex-1" />
          <ScoreBadge score={opp.score} />
        </div>
        <div className="flex flex-wrap gap-2">
          <IntentBadge intent={opp.intent} />
          <RedFlagBadge flags={opp.redFlags} />
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Masalah pelanggan</dt>
            <dd>{opp.customerProblem}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Kecocokan terbaik</dt>
            <dd>{top ? `${top.offeringName} · ${top.matchScore}/100` : "Tidak ada produk/layanan yang cocok"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">Alasan skor</dt>
            <dd>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {opp.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
        <OpportunityActions opp={opp} draftId={draftId} />
      </CardContent>
    </Card>
  );
}

export function OpportunitiesPage() {
  const { data } = useWorkspace();
  const { basePath } = useWorkspace();
  const caps = useCapabilities();
  const opportunities = useOpportunities();
  const drafts = useReplyDrafts();
  const draftByOpp = new Map((drafts.data ?? []).map((d) => [d.opportunityId, d.id]));
  const [q, setQ] = useState("");
  const [band, setBand] = useState(ALL);
  const [intent, setIntent] = useState(ALL);

  const filter = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (opps: Opportunity[]) =>
      opps
        .filter((o) => band === ALL || o.band === band)
        .filter((o) => intent === ALL || o.intent === intent)
        .filter((o) => !term || `${o.post.text} ${o.post.authorName} ${o.customerProblem} ${o.matches[0]?.offeringName ?? ""}`.toLowerCase().includes(term))
        .sort((a, b) => b.score - a.score);
  }, [q, band, intent]);

  return (
    <>
      <PageHeader title="Opportunities" description="Percakapan yang dianalisis AI: niat membeli, masalah pelanggan, dan skor peluang 0–100." />
      {!data.intelligence.capabilities.opportunities ? (
        <NotYetAvailable
          icon={Target}
          title="Belum ada peluang"
          description="Peluang muncul setelah percakapan ditemukan (Fase 4) dan dianalisis AI (Fase 3)."
        />
      ) : (
        <>
          <div className="mb-4 grid gap-2 sm:flex sm:flex-wrap">
            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari post, nama, atau layanan" className="pl-8" aria-label="Cari peluang" />
            </div>
            <FilterSelect items={BAND_ITEMS} value={band} onChange={setBand} label="Filter skor" />
            <FilterSelect items={INTENT_ITEMS} value={intent} onChange={setIntent} label="Filter intent" />
          </div>
          <QueryBoundary query={opportunities}>
            {(opps) => {
              if (opps.length === 0) {
                return (
                  <EmptyState
                    icon={Target}
                    title="Belum ada peluang"
                    description="Peluang muncul dari Analisis Manual sekarang, dan dari monitoring Threads mulai Fase 4."
                    className="bg-white"
                    action={
                      caps.ai ? (
                        <Link to={`${basePath}/discover?tab=manual`} className="text-sm font-semibold text-primary hover:underline">
                          Analisis post pertama
                        </Link>
                      ) : undefined
                    }
                  />
                );
              }
              const visible = filter(opps);
              if (visible.length === 0) {
                return <EmptyState icon={Search} title="Tidak ada peluang yang cocok" description="Ubah kata pencarian atau filter." className="bg-white" />;
              }
              return (
                <ul className="grid gap-4">
                  {visible.map((o) => (
                    <li key={o.id}>
                      <OpportunityCard opp={o} draftId={draftByOpp.get(o.id)} />
                    </li>
                  ))}
                </ul>
              );
            }}
          </QueryBoundary>
        </>
      )}
    </>
  );
}
