import { type LucideIcon, PlayCircle } from "lucide-react";
import { Link } from "react-router";
import { EmptyState } from "@/components/layout/states";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

/**
 * Workspace nyata sebelum pipeline discovery/AI tersedia. Jujur: tidak ada data palsu,
 * jelaskan kapan data muncul, dan arahkan ke demo untuk melihat contohnya.
 */
export function NotYetAvailable({ icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      className="bg-white"
      action={
        <Link to="/demo" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          <PlayCircle className="size-4" aria-hidden />
          Lihat contohnya di demo
        </Link>
      }
    />
  );
}

/** Banner wajib di semua halaman dengan data demo (SPEC §21). */
export function DemoDataBanner() {
  const { workspace, isPublicDemo } = useWorkspace();
  if (!workspace.isDemo) return null;
  return (
    <div role="note" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950 sm:px-6 sm:text-sm">
      <strong className="font-semibold">Data Demo.</strong> Percakapan, skor, draft, dan lead di sini adalah simulasi Publish
      Agency. Tidak ada yang dikirim ke platform sosial.
      {isPublicDemo && " Perubahan hanya tersimpan di tab ini."}
    </div>
  );
}

export function MetricCard({ label, value, hint, className }: { label: string; value: string; hint?: string; className?: string }) {
  return (
    <Card className={cn("gap-1 py-4", className)}>
      <CardContent className="px-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function ListSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("grid gap-3", className)} role="status" aria-label="Memuat">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}
