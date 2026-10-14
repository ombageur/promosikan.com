import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/utils/format";

/**
 * Palet grafik: slot kategorikal berurutan tetap (tidak pernah diputar).
 * Divalidasi dengan dataviz validate_palette (light, surface #fff): CVD ΔE 9.2, normal ΔE 27.6.
 */
const SERIES_COLORS = ["#2563eb", "#eb6834"] as const;
const GRID = "#e2e8f0";
const AXIS_TEXT = "#64748b";

type Series = { key: string; label: string };
type Datum = Record<string, string | number>;

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="mb-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
      {series.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: SERIES_COLORS[i] }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

const tooltipStyle = {
  contentStyle: { borderRadius: 8, borderColor: GRID, fontSize: 12 },
  labelStyle: { color: "#0f172a", fontWeight: 600 },
  itemStyle: { color: "#334155" },
};

/** Tren harian 1–2 seri, satu sumbu Y. Garis 2px, penanda akhir, crosshair tooltip. */
export function TrendChart({
  data,
  x,
  series,
  height = 240,
  label,
}: {
  data: Datum[];
  x: string;
  series: Series[];
  height?: number;
  label: string;
}) {
  return (
    <figure aria-label={label}>
      <Legend series={series} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey={x} tick={{ fontSize: 11, fill: AXIS_TEXT }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tick={{ fontSize: 11, fill: AXIS_TEXT }} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
            <Tooltip {...tooltipStyle} cursor={{ stroke: AXIS_TEXT, strokeWidth: 1 }} formatter={(v) => formatNumber(Number(v))} />
            {series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={SERIES_COLORS[i]}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/** Kolom harian satu seri; tebal ≤ 24px, ujung data membulat 4px. */
export function ColumnChart({
  data,
  x,
  y,
  height = 200,
  label,
}: {
  data: Datum[];
  x: string;
  y: string;
  height?: number;
  label: string;
}) {
  return (
    <figure aria-label={label} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 12, bottom: 0, left: -12 }} barCategoryGap={2}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey={x} tick={{ fontSize: 11, fill: AXIS_TEXT }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={{ fontSize: 11, fill: AXIS_TEXT }} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "#f1f5f9" }} formatter={(v) => formatNumber(Number(v))} />
          <Bar dataKey={y} name={label} fill={SERIES_COLORS[0]} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

/**
 * Batang horizontal untuk peringkat/funnel (HTML, bukan SVG): label & nilai selalu terlihat,
 * sehingga tidak bergantung pada warna atau hover.
 */
export function BarList({ items, max }: { items: { label: string; value: number; hint?: string }[]; max?: number }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <li key={item.label} className="grid gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {formatNumber(item.value)}
              {item.hint && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{item.hint}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100" aria-hidden>
            <div
              className="h-2 rounded-full"
              style={{ width: `${Math.max(2, (item.value / top) * 100)}%`, background: SERIES_COLORS[0] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

