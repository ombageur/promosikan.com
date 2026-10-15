import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AtSign, ExternalLink, Link2Off, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAutomationSettings } from "@/hooks/useData";
import { useWorkspace } from "@/hooks/useWorkspace";
import { errorMessage } from "@/lib/firebase/callable";
import {
  disconnectThreads,
  getThreadsAccount,
  listMonitoringRuns,
  startThreadsOAuth,
  syncThreadsNow,
  THREADS_DAILY_QUERY_BUDGET,
  type ThreadsAccount,
} from "@/services/threads";
import { formatNumber } from "@/utils/format";

const dateTime = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const fmt = (ts: { toDate(): Date } | null | undefined) => (ts ? dateTime.format(ts.toDate()) : "—");

const STATUS: Record<ThreadsAccount["status"], { label: string; variant: "default" | "destructive" }> = {
  connected: { label: "Terhubung", variant: "default" },
  expired: { label: "Kedaluwarsa", variant: "destructive" },
  revoked: { label: "Akses dicabut", variant: "destructive" },
  error: { label: "Bermasalah", variant: "destructive" },
};

const CALLBACK_MESSAGES: Record<string, () => void> = {
  connected: () => toast.success("Akun Threads terhubung."),
  denied: () => toast.info("Penghubungan Threads dibatalkan."),
  error: () => toast.error("Gagal menghubungkan Threads. Coba lagi."),
};

/** Status koneksi Threads yang nyata (dari Firestore). Token tidak pernah ada di sisi client. */
export function ThreadsCard() {
  const { workspace, can, isPublicDemo, basePath } = useWorkspace();
  const manage = can("integrations.manage");
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [confirm, setConfirm] = useState(false);
  // Setelah sinkron manual dikirim, riwayat dimuat ulang berkala selama 2 menit agar hasilnya muncul.
  const [pollUntil, setPollUntil] = useState(0);
  const live = !workspace.isDemo && !isPublicDemo;
  const settings = useAutomationSettings();

  const account = useQuery({ queryKey: ["threads-account", workspace.id], queryFn: () => getThreadsAccount(workspace.id), enabled: live });
  const runs = useQuery({
    queryKey: ["monitoring-runs", workspace.id],
    queryFn: () => listMonitoringRuns(workspace.id),
    enabled: live && account.data?.status === "connected",
    refetchInterval: () => (Date.now() < pollUntil ? 10_000 : false),
  });

  // Hasil redirect OAuth (?threads=connected|denied|error) ditampilkan sekali lalu dibersihkan dari URL.
  useEffect(() => {
    const result = params.get("threads");
    if (!result) return;
    CALLBACK_MESSAGES[result]?.();
    const next = new URLSearchParams(params);
    next.delete("threads");
    next.delete("reason");
    setParams(next, { replace: true });
  }, [params, setParams]);

  const connect = useMutation({
    mutationFn: () => startThreadsOAuth({ workspaceId: workspace.id }),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const syncNow = useMutation({
    mutationFn: () => syncThreadsNow({ workspaceId: workspace.id }),
    onSuccess: () => {
      toast.success("Sinkron dimulai. Hasil muncul di riwayat dalam 1–2 menit.");
      setPollUntil(Date.now() + 2 * 60_000);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const disconnect = useMutation({
    mutationFn: () => disconnectThreads({ workspaceId: workspace.id }),
    onSuccess: async () => {
      setConfirm(false);
      toast.success("Koneksi Threads diputus.");
      await queryClient.invalidateQueries({ queryKey: ["threads-account", workspace.id] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const data = account.data;
  const status = data ? STATUS[data.status] : null;
  const quotaToday = data?.quota?.day === new Date().toISOString().slice(0, 10) ? data.quota.queries : 0;

  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-slate-900 text-white">
          <AtSign className="size-5" aria-hidden />
        </div>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Meta Threads
          {!live ? (
            <Badge variant="outline">Tidak dipakai di demo</Badge>
          ) : status ? (
            <Badge variant={status.variant}>{status.label}</Badge>
          ) : account.isPending ? null : (
            <Badge variant="outline">Belum terhubung</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Monitoring keyword lewat Threads API resmi (OAuth). Balasan tetap hanya dikirim setelah approval manusia.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {!live ? (
          <p className="text-muted-foreground">Workspace demo tidak pernah terhubung ke platform sosial.</p>
        ) : account.isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : account.isError ? (
          <p role="alert" className="text-destructive">
            {errorMessage(account.error)}
          </p>
        ) : !data ? (
          <>
            <p className="text-muted-foreground">
              Hubungkan akun Threads bisnis Anda. Sampai izin <code>threads_keyword_search</code> disetujui Meta, pencarian hanya
              menemukan post milik akun Anda sendiri.
            </p>
            {manage ? (
              <Button className="justify-self-start" onClick={() => connect.mutate()} disabled={connect.isPending}>
                <AtSign aria-hidden />
                {connect.isPending ? "Membuka Threads…" : "Hubungkan Threads"}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Hanya Owner dan Admin yang dapat menghubungkan integrasi.</p>
            )}
          </>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">Akun</dt>
              <dd className="font-medium">@{data.username}</dd>
              <dt className="text-muted-foreground">Sinkron terakhir</dt>
              <dd>{fmt(data.lastSyncAt)}</dd>
              <dt className="text-muted-foreground">Sinkron berikutnya</dt>
              <dd>{data.status === "connected" ? fmt(data.nextSyncAt) : "Berhenti"}</dd>
              <dt className="text-muted-foreground">Pencarian hari ini</dt>
              <dd className="tabular-nums">
                {formatNumber(quotaToday)} / {formatNumber(THREADS_DAILY_QUERY_BUDGET)}
              </dd>
              <dt className="text-muted-foreground">Token berlaku s.d.</dt>
              <dd>{fmt(data.tokenExpiresAt)}</dd>
            </dl>
            {data.lastError && (
              <p role="alert" className="rounded-md bg-destructive/5 p-2 text-xs text-destructive">
                {data.lastError}
              </p>
            )}
            {data.status === "connected" && settings.data && !settings.data.monitoringEnabled && (
              <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                Monitoring masih nonaktif.{" "}
                <Link to={`${basePath}/automation`} className="font-semibold underline">
                  Aktifkan di Automation
                </Link>
              </p>
            )}
            {data.status === "connected" && (
              <p className="rounded-md bg-secondary p-2 text-xs text-secondary-foreground">
                Sampai izin <code>threads_keyword_search</code> disetujui lewat App Review Meta, pencarian hanya menemukan post milik
                akun @{data.username} sendiri — dan post milik sendiri sengaja dilewati karena bukan calon pelanggan. Hasil “0 baru” pada
                tahap ini wajar.
              </p>
            )}
            {runs.data && runs.data.length === 0 && data.status === "connected" && (
              <p className="text-xs text-muted-foreground">Belum ada sinkron. Aktifkan monitoring atau klik “Sinkron sekarang”.</p>
            )}
            {runs.data && runs.data.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Riwayat sinkron</p>
                <ul className="grid gap-1 text-xs">
                  {runs.data.map((run) => (
                    <li key={run.id} className="flex flex-wrap justify-between gap-2">
                      <span>{fmt(run.startedAt)}</span>
                      <span className="text-muted-foreground">
                        {run.keywordsQueried} keyword · {run.postsFound} ditemukan · {run.postsNew} baru
                        {(run.ownPostsSkipped ?? 0) > 0 && ` · ${run.ownPostsSkipped} milik sendiri dilewati`}
                        {run.stopReason === "rate_limit" && " · batas API"}
                        {run.stopReason === "budget" && " · kuota harian"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {manage && (
              <div className="flex flex-wrap items-center gap-2">
                {data.status === "connected" && (
                  <Button onClick={() => syncNow.mutate()} disabled={syncNow.isPending}>
                    <RefreshCw aria-hidden />
                    {syncNow.isPending ? "Mengirim…" : "Sinkron sekarang"}
                  </Button>
                )}
                {data.status !== "connected" && (
                  <Button onClick={() => connect.mutate()} disabled={connect.isPending}>
                    <RefreshCw aria-hidden />
                    Hubungkan ulang
                  </Button>
                )}
                <Button variant="outline" onClick={() => setConfirm(true)}>
                  <Link2Off aria-hidden />
                  Putuskan
                </Button>
                <a
                  href="https://www.threads.com/settings"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                >
                  Kelola akses di Threads <ExternalLink className="size-3" aria-hidden />
                </a>
              </div>
            )}
          </>
        )}
      </CardContent>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Putuskan koneksi Threads?"
        description="Token akses dihapus dan monitoring berhenti. Peluang yang sudah ditemukan tetap tersimpan."
        confirmLabel="Putuskan"
        destructive
        pending={disconnect.isPending}
        onConfirm={() => disconnect.mutate()}
      />
    </Card>
  );
}
