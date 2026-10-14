import type { OpportunityBand, SubScores } from "../scoring";
import type { ReplyStyle } from "../schemas/automation";

/**
 * Tipe data hasil discovery & AI (SPEC §8–§13). Di Fase 2 hanya diisi data demo;
 * skema Zod dan penulisan oleh backend ditambahkan di Fase 3–5.
 */
export type Platform = "threads";

export const INTENTS = ["active_search", "asking_recommendation", "problem_aware", "comparing", "general_discussion"] as const;
export type Intent = (typeof INTENTS)[number];
export const INTENT_LABELS: Record<Intent, string> = {
  active_search: "Aktif mencari",
  asking_recommendation: "Minta rekomendasi",
  problem_aware: "Sadar masalah",
  comparing: "Membandingkan",
  general_discussion: "Diskusi umum",
};

export type DiscoveredPost = {
  id: string;
  platform: Platform;
  authorName: string;
  authorHandle: string;
  text: string;
  /** ISO 8601 */
  postedAt: string;
  matchedKeyword: string;
  /** null = tidak ada tautan asli (mis. data demo). */
  permalink: string | null;
};

export type OfferingMatch = {
  offeringId: string;
  offeringName: string;
  matchScore: number;
  approach: ReplyStyle;
  reason: string;
};

export type OpportunityStatus = "new" | "saved" | "skipped";

export type Opportunity = {
  id: string;
  post: DiscoveredPost;
  intent: Intent;
  customerProblem: string;
  subScores: SubScores;
  score: number;
  band: OpportunityBand;
  reasons: string[];
  redFlags: string[];
  /** Maksimal 3, terurut dari skor tertinggi. Kosong = tidak ada yang cocok. */
  matches: OfferingMatch[];
  status: OpportunityStatus;
};

export const REPLY_DRAFT_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "sending",
  "sent",
  "failed",
  "unsupported",
  "skipped",
] as const;
export type ReplyDraftStatus = (typeof REPLY_DRAFT_STATUSES)[number];
export const REPLY_DRAFT_STATUS_LABELS: Record<ReplyDraftStatus, string> = {
  draft: "Draft",
  pending_approval: "Menunggu approval",
  approved: "Disetujui",
  sending: "Mengirim",
  sent: "Terkirim",
  failed: "Gagal",
  unsupported: "Tidak didukung API",
  skipped: "Dilewati",
};

export type ReplyDraft = {
  id: string;
  opportunityId: string;
  text: string;
  style: ReplyStyle;
  status: ReplyDraftStatus;
  quality: { passed: boolean; notes: string[] };
  /** Apakah API mengizinkan membalas post ini (Fase 5). */
  publishable: boolean;
};

export const LEAD_STATUSES = [
  "discovered",
  "qualified",
  "matched",
  "reply_drafted",
  "replied",
  "engaged",
  "contacted",
  "negotiation",
  "converted",
  "lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  discovered: "Discovered",
  qualified: "Qualified",
  matched: "Matched",
  reply_drafted: "Reply Drafted",
  replied: "Replied",
  engaged: "Engaged",
  contacted: "Contacted",
  negotiation: "Negotiation",
  converted: "Converted",
  lost: "Lost",
};

export type Lead = {
  id: string;
  name: string;
  handle: string;
  platform: Platform;
  status: LeadStatus;
  offeringName: string | null;
  score: number;
  assigneeName: string | null;
  /** ISO 8601 */
  lastActivityAt: string;
  note: string;
  dealValue: number | null;
};

export type DailyStats = {
  /** YYYY-MM-DD */
  date: string;
  discovered: number;
  qualified: number;
  matched: number;
  drafts: number;
  repliesSent: number;
  engaged: number;
  converted: number;
};
