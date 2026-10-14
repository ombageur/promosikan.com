import { z } from "zod";

/** Daftar teks pendek (benefit, keyword, dsb.) — dibersihkan, tanpa duplikat, dibatasi jumlahnya. */
const textList = (maxItems: number, maxLength: number) =>
  z
    .array(z.string().trim().max(maxLength))
    .transform((items) => [...new Set(items.filter(Boolean))])
    .pipe(z.array(z.string()).max(maxItems, `Maksimal ${maxItems} item`))
    .default([]);

const text = (max: number) => z.string().trim().max(max).default("");

export const OFFERING_TYPES = ["service", "product"] as const;
export const OFFERING_TYPE_LABELS: Record<(typeof OFFERING_TYPES)[number], string> = {
  service: "Layanan",
  product: "Produk",
};

export const OFFERING_LIMITS = {
  benefits: 10,
  problemsSolved: 10,
  keywords: 20,
  allowedClaims: 10,
} as const;

/** Produk/layanan di katalog (SPEC §6). Disimpan di workspaces/{wid}/offerings/{id}. */
export const offeringSchema = z.object({
  name: z.string().trim().min(2, "Minimal 2 karakter").max(100),
  type: z.enum(OFFERING_TYPES).default("service"),
  category: text(100),
  description: text(1000),
  benefits: textList(OFFERING_LIMITS.benefits, 200),
  targetAudience: text(300),
  problemsSolved: textList(OFFERING_LIMITS.problemsSolved, 200),
  keywords: textList(OFFERING_LIMITS.keywords, 60),
  priceRange: text(100),
  usp: text(300),
  landingPageUrl: z.union([z.url({ protocol: /^https?$/ }), z.literal("")]).default(""),
  allowedClaims: textList(OFFERING_LIMITS.allowedClaims, 200),
  isActive: z.boolean().default(true),
});
export type Offering = z.infer<typeof offeringSchema>;
export type OfferingInput = z.input<typeof offeringSchema>;

/** Grup keyword, mis. "SEO" atau "Website". */
export const keywordGroupSchema = z.object({
  name: z.string().trim().min(2, "Minimal 2 karakter").max(60),
  offeringId: z.string().max(128).nullable().default(null),
});
export type KeywordGroup = z.infer<typeof keywordGroupSchema>;
export type KeywordGroupInput = z.input<typeof keywordGroupSchema>;

/** Keyword yang dipantau (SPEC §8). */
export const keywordSchema = z.object({
  term: z.string().trim().min(2, "Minimal 2 karakter").max(100),
  groupId: z.string().max(128).nullable().default(null),
  offeringId: z.string().max(128).nullable().default(null),
  isActive: z.boolean().default(true),
});
export type Keyword = z.infer<typeof keywordSchema>;
export type KeywordInput = z.input<typeof keywordSchema>;

/** Pecah teks multi-baris atau dipisah koma menjadi daftar item. */
export function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
