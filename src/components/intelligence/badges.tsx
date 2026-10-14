import { AlertTriangle } from "lucide-react";
import { BAND_LABELS, type OpportunityBand, scoreBand } from "@shared/scoring";
import { type Intent, INTENT_LABELS } from "@shared/types/intelligence";
import { cn } from "@/lib/utils";

const BAND_STYLES: Record<OpportunityBand, string> = {
  high: "bg-green-50 text-green-700 ring-green-600/20",
  medium: "bg-blue-50 text-blue-700 ring-blue-600/20",
  low: "bg-amber-50 text-amber-800 ring-amber-600/20",
  not_qualified: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

/** Skor peluang 0–100 + label kelas (warna tidak pernah jadi satu-satunya penanda). */
export function ScoreBadge({ score, showLabel = true, className }: { score: number; showLabel?: boolean; className?: string }) {
  const band = scoreBand(score);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap",
        BAND_STYLES[band],
        className,
      )}
    >
      <span className="tabular-nums">{score}</span>
      {showLabel && <span className="font-medium">· {BAND_LABELS[band]}</span>}
    </span>
  );
}

export function IntentBadge({ intent }: { intent: Intent }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 whitespace-nowrap">
      {INTENT_LABELS[intent]}
    </span>
  );
}

export function RedFlagBadge({ flags }: { flags: string[] }) {
  if (flags.length === 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/20"
      title={flags.join("; ")}
    >
      <AlertTriangle className="size-3" aria-hidden />
      Perlu review manual
    </span>
  );
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 whitespace-nowrap">
      Data Demo
    </span>
  );
}
