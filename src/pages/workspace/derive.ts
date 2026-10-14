import type { DailyStats, Lead, Opportunity } from "@shared/types/intelligence";

export type Totals = Omit<DailyStats, "date">;

export function sumStats(days: DailyStats[]): Totals {
  return days.reduce<Totals>(
    (acc, d) => ({
      discovered: acc.discovered + d.discovered,
      qualified: acc.qualified + d.qualified,
      matched: acc.matched + d.matched,
      drafts: acc.drafts + d.drafts,
      repliesSent: acc.repliesSent + d.repliesSent,
      engaged: acc.engaged + d.engaged,
      converted: acc.converted + d.converted,
    }),
    { discovered: 0, qualified: 0, matched: 0, drafts: 0, repliesSent: 0, engaged: 0, converted: 0 },
  );
}

/** Tahap funnel dari percakapan sampai konversi (SPEC §7). */
export function funnel(t: Totals) {
  return [
    { label: "Percakapan ditemukan", value: t.discovered },
    { label: "Peluang qualified", value: t.qualified },
    { label: "Cocok dengan katalog", value: t.matched },
    { label: "Balasan terkirim", value: t.repliesSent },
    { label: "Lead engaged", value: t.engaged },
    { label: "Pelanggan terkonversi", value: t.converted },
  ];
}

function countBy<T>(items: T[], key: (item: T) => string | null | undefined, limit = 5) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "id"))
    .slice(0, limit);
}

export const topKeywords = (opps: Opportunity[], limit?: number) => countBy(opps, (o) => o.post.matchedKeyword, limit);

/** Hanya peluang yang benar-benar cocok (matches tidak kosong) yang dihitung. */
export const topOfferings = (opps: Opportunity[], limit?: number) => countBy(opps, (o) => o.matches[0]?.offeringName, limit);

export const openLeads = (leads: Lead[]) => leads.filter((l) => l.status !== "converted" && l.status !== "lost");

export function conversionRate(t: Totals) {
  return t.discovered > 0 ? (t.converted / t.discovered) * 100 : 0;
}
