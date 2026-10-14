import { CheckCircle2, ExternalLink, MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { REPLY_STYLE_LABELS } from "@shared/schemas/automation";
import { type Opportunity, type ReplyDraft, REPLY_DRAFT_STATUS_LABELS } from "@shared/types/intelligence";
import { ScoreBadge } from "@/components/intelligence/badges";
import { PostQuote } from "@/components/intelligence/PostQuote";
import { NotYetAvailable } from "@/components/intelligence/states";
import { QueryBoundary } from "@/components/layout/QueryBoundary";
import { EmptyState, PageHeader } from "@/components/layout/states";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useOpportunities, useReplyDrafts, useUpdateReplyDraft } from "@/hooks/useData";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

const MAX_REPLY = 500; // Batas karakter Threads; diverifikasi ulang di Fase 4.

function DraftEditor({ draft, opp }: { draft: ReplyDraft; opp: Opportunity }) {
  const { can } = useWorkspace();
  const update = useUpdateReplyDraft();
  const [text, setText] = useState(draft.text);
  const editable = can("reply.edit") && draft.status !== "skipped";
  const dirty = text !== draft.text;
  const top = opp.matches[0];

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Percakapan asli</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <PostQuote post={opp.post} />
          <div className="flex flex-wrap gap-2">
            <ScoreBadge score={opp.score} />
            {top && <Badge variant="secondary">{top.offeringName} · match {top.matchScore}</Badge>}
            <Badge variant="outline">{REPLY_STYLE_LABELS[draft.style]}</Badge>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Draft balasan</CardTitle>
          <CardDescription>Setiap balasan wajib ditinjau dan disetujui manusia sebelum dikirim.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <label htmlFor="draft-text" className="sr-only">
            Teks balasan
          </label>
          <Textarea
            id="draft-text"
            rows={6}
            value={text}
            maxLength={MAX_REPLY}
            onChange={(e) => setText(e.target.value)}
            disabled={!editable}
          />
          <p className="text-right text-xs text-muted-foreground tabular-nums">
            {text.length}/{MAX_REPLY}
          </p>
          <div className="rounded-lg bg-slate-50 p-3 text-xs">
            <p className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="size-4 text-success" aria-hidden />
              Pemeriksaan kualitas {draft.quality.passed ? "lolos" : "gagal"}
            </p>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              {draft.quality.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            {editable && (
              <Button
                variant="outline"
                disabled={!dirty || update.isPending || !text.trim()}
                onClick={() => update.mutate({ id: draft.id, text }, { onSuccess: () => toast.success("Draft disimpan.") })}
              >
                Simpan draft
              </Button>
            )}
            {editable && (
              <Button variant="ghost" disabled={update.isPending} onClick={() => update.mutate({ id: draft.id, status: "skipped" })}>
                Lewati
              </Button>
            )}
            <Button disabled title="Publikasi lewat Threads API tersedia di Fase 5">
              <Send aria-hidden />
              Approve & Reply
            </Button>
            {opp.post.permalink ? (
              <a href={opp.post.permalink} target="_blank" rel="noreferrer noopener" className={buttonVariants({ variant: "outline" })}>
                <ExternalLink aria-hidden />
                Buka post asli
              </a>
            ) : (
              <Button variant="outline" disabled>
                <ExternalLink aria-hidden />
                Buka post asli
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Pengiriman balasan aktif di Fase 5, hanya untuk post yang diizinkan Threads API dan setelah approval.
            {!opp.post.permalink && " Post demo tidak memiliki tautan asli."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function ReplyCenterPage() {
  const { data } = useWorkspace();
  const drafts = useReplyDrafts();
  const opportunities = useOpportunities();
  const [params, setParams] = useSearchParams();

  return (
    <>
      <PageHeader title="Reply Center" description="Tinjau, sunting, dan setujui draft balasan AI. Tidak ada balasan yang dikirim tanpa persetujuan." />
      {!data.intelligence.available ? (
        <NotYetAvailable icon={MessageCircle} title="Belum ada draft balasan" description="Draft dibuat oleh AI di Fase 3 dan dapat dikirim setelah approval di Fase 5." />
      ) : (
        <QueryBoundary query={drafts}>
          {(list) => (
            <QueryBoundary query={opportunities}>
              {(opps) => {
                if (list.length === 0) return <EmptyState icon={MessageCircle} title="Tidak ada draft" className="bg-white" />;
                const selectedId = params.get("draft") ?? list[0]?.id;
                const selected = list.find((d) => d.id === selectedId) ?? list[0];
                const selectedOpp = opps.find((o) => o.id === selected?.opportunityId);
                return (
                  <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
                    <nav aria-label="Daftar draft">
                      <ul className="grid gap-2">
                        {list.map((d) => {
                          const opp = opps.find((o) => o.id === d.opportunityId);
                          const active = d.id === selected?.id;
                          return (
                            <li key={d.id}>
                              <button
                                type="button"
                                aria-current={active ? "true" : undefined}
                                onClick={() => setParams({ draft: d.id }, { replace: true })}
                                className={cn(
                                  "w-full rounded-lg border bg-white p-3 text-left transition-colors hover:border-primary/40",
                                  active && "border-primary ring-1 ring-primary",
                                )}
                              >
                                <span className="flex items-center justify-between gap-2 text-xs">
                                  <span className="font-semibold">{opp?.post.authorName ?? "—"}</span>
                                  <span className="text-muted-foreground">{REPLY_DRAFT_STATUS_LABELS[d.status]}</span>
                                </span>
                                <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{opp?.post.text}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </nav>
                    {selected && selectedOpp ? (
                      <DraftEditor key={selected.id} draft={selected} opp={selectedOpp} />
                    ) : (
                      <EmptyState icon={MessageCircle} title="Pilih draft" className="bg-white" />
                    )}
                  </div>
                );
              }}
            </QueryBoundary>
          )}
        </QueryBoundary>
      )}
    </>
  );
}
