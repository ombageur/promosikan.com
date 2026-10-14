const number = new Intl.NumberFormat("id-ID");
const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" });
const relative = new Intl.RelativeTimeFormat("id-ID", { numeric: "auto" });

export const formatNumber = (value: number) => number.format(value);
const oneDecimal = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** 0.6 → "0,6%" */
export const formatRate = (value: number) => `${oneDecimal.format(value)}%`;
export const formatRupiah = (value: number) => rupiah.format(value);
export const formatDate = (iso: string) => date.format(new Date(iso));
export const formatShortDate = (iso: string) => shortDate.format(new Date(iso));

/** "hari ini", "kemarin", "3 hari lalu". */
export function formatRelativeDay(iso: string, now = Date.now()) {
  const days = Math.round((new Date(iso).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000);
  return relative.format(days, "day");
}

export function formatPercent(part: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}
