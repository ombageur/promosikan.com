import { AlertTriangle, CheckCircle2, ExternalLink, MessageCircle, RefreshCw, Scissors, Send, XCircle } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { REPLY_MAX_CHARS } from "@shared/schemas/ai";
import { REPLY_STYLE_LABELS, REPLY_STYLES, type ReplyStyle } from "@shared/schemas/automation";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCapabilities, useGenerateReply, useOpportunities, useReplyDrafts, useUpdateReplyDraft, useValidateReply } from "@/hooks/useData";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

const STYLE_ITEMS = REPLY_STYLES.map((s) => ({ value: s, label: REPLY_STYLE_LABELS[s] }));

/** Teks diubah setelah pemeriksaan kualitas terakhir → hasil pemeriksaan tidak berlaku lagi. */
function qualityIsStale(draft: ReplyDraft) {
  const { checkedAt } = draft.quality;
  return Boolean(checkedAt && draft.updatedAt && draft.updatedAt > checkedAt);
}

function AiActions({ draft }: { draft: ReplyDraft }) {
  const generate = useGenerateReply();
  const busy = generate.isPending;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-2">
      <span className="px-1 text-xs font-medium text-muted-foreground">AI:</span>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => generate.mutate({ opportunityId: draft.opportunityId, adjustment: "regenerate" })}>
        <RefreshCw aria-hidden />
        Buat ulang
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => generate.mutate({ opportunityId: draft.opportunityId, adjustment: "shorter" })}>
        <Scissors aria-hidden />
        Persingkat
      </Button>
      <Select
        items={STYLE_ITEMS}
        value={draft.style}
        onValueChange={(v) => v && v !== draft.style && generate.mutate({ opportunityId: draft.opportunityId, style: v as ReplyStyle, adjustment: "regenerate" })}
        disabled={busy}
      >
        <SelectTrigger size="sm" className="w-44" aria-label="Ganti nada balasan">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STYLE_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {busy && <span className="text-xs text-muted-foreground" role="status">Menyusun…</span>}
    </div>
  );
}

function DraftEditor({ draft, opp }: { draft: ReplyDraft; opp: Opportunity }) {
  const { can } = useWorkspace();
  const caps = useCapabilities();
  const update = useUpdateReplyDraft();
  const validate = useValidateReply();
  const [text, setText] = useState(draft.text);
  const editable = can("reply.edit") && (draft.status === "draft" || draft.status === "pending_approval");
  const dirty = text !== draft.text;
  const top = opp.matches[0];
  const stale = qualityIsStale(draft);
  const QualityIcon = stale ? AlertTriangle : draft.quality.passed ? CheckCircle2 : XCircle;

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
            maxLength={REPLY_MAX_CHARS}
            onChange={(e) => setText(e.target.value)}
            disabled={!editable}
          />
          <p className="text-right text-xs text-muted-foreground tabular-nums">
            {text.length}/{REPLY_MAX_CHARS}
          </p>
          {caps.ai && can("ai.use") && editable && <AiActions draft={draft} />}
          <div className="rounded-lg bg-slate-50 p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 font-semibold">
                <QualityIcon className={cn("size-4", stale ? "text-warning" : draft.quality.passed ? "text-success" : "text-destructive")} aria-hidden />
                {stale
                  ? "Teks diubah setelah pemeriksaan — periksa ulang"
                  : `Pemeriksaan kualitas ${draft.quality.passed ? "lolos" : "tidak lolos"}`}
              </p>
              {caps.ai && editable && (
                <Button size="xs" variant="outline" disabled={validate.isPending || dirty} onClick={() => validate.mutate(draft.id)}>
                  {validate.isPending ? "Memeriksa…" : "Periksa kualitas"}
                </Button>
              )}
            </div>
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
            {can("reply.edit") && (draft.status === "draft" || draft.status === "pending_approval" || draft.status === "skipped") && (
              <Button
                variant="ghost"
                disabled={update.isPending}
                onClick={() => update.mutate({ id: draft.id, status: draft.status === "skipped" ? "draft" : "skipped" })}
              >
                {draft.status === "skipped" ? "Batalkan lewati" : "Lewati"}
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
            {!opp.post.permalink && " Post ini tidak memiliki tautan asli."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function ReplyCenterPage() {
  const { data, basePath } = useWorkspace();
  const drafts = useReplyDrafts();
  const opportunities = useOpportunities();
  const [params, setParams] = useSearchParams();

  return (
    <>
      <PageHeader title="Reply Center" description="Tinjau, sunting, dan setujui draft balasan AI. Tidak ada balasan yang dikirim tanpa persetujuan." />
      {!data.intelligence.capabilities.drafts ? (
        <NotYetAvailable icon={MessageCircle} title="Belum ada draft balasan" description="Draft dibuat oleh AI di Fase 3 dan dapat dikirim setelah approval di Fase 5." />
      ) : (
        <QueryBoundary query={drafts}>
          {(list) => (
            <QueryBoundary query={opportunities}>
              {(opps) => {
                if (list.length === 0) {
                  return (
                    <EmptyState
                      icon={MessageCircle}
                      title="Belum ada draft balasan"
                      description="Buka Opportunities lalu pilih “Buat draft balasan” pada peluang yang cocok dengan katalog."
                      className="bg-white"
                      action={
                        <Link to={`${basePath}/opportunities`} className="text-sm font-semibold text-primary hover:underline">
                          Buka Opportunities
                        </Link>
                      }
                    />
                  );
                }
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
                      <DraftEditor key={`${selected.id}:${selected.updatedAt ?? ""}:${selected.text}`} draft={selected} opp={selectedOpp} />
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
