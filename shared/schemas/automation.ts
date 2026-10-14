import { z } from "zod";

export const REPLY_STYLES = ["friendly", "professional", "consultative", "helpful", "soft_selling"] as const;
export type ReplyStyle = (typeof REPLY_STYLES)[number];
export const REPLY_STYLE_LABELS: Record<ReplyStyle, string> = {
  friendly: "Friendly",
  professional: "Professional",
  consultative: "Consultative",
  helpful: "Helpful",
  soft_selling: "Soft Selling",
};

/** Interval monitoring yang diizinkan (menit). Minimum per plan ditegakkan di Fase 7. */
export const MONITORING_INTERVALS = [60, 120, 240, 720, 1440] as const;

/**
 * Pengaturan automation (SPEC §19), satu dokumen di workspaces/{wid}/settings/automation.
 * `manualApproval` selalu true di versi ini: tidak ada auto-reply.
 */
export const automationSettingsSchema = z.object({
  monitoringEnabled: z.boolean().default(false),
  monitoringIntervalMinutes: z
    .number()
    .int()
    .refine((v) => (MONITORING_INTERVALS as readonly number[]).includes(v), "Interval tidak valid")
    .default(60),
  minOpportunityScore: z.number().int().min(0).max(100).default(60),
  minMatchScore: z.number().int().min(0).max(100).default(60),
  defaultReplyStyle: z.enum(REPLY_STYLES).default("consultative"),
  manualApproval: z.literal(true).default(true),
  dailyReplyLimit: z.number().int().min(1).max(100).default(20),
  authorCooldownDays: z.number().int().min(1).max(30).default(7),
  duplicateDetection: z.boolean().default(true),
  notifyInApp: z.boolean().default(true),
  notifyEmail: z.boolean().default(false),
});
export type AutomationSettings = z.infer<typeof automationSettingsSchema>;
export type AutomationSettingsInput = z.input<typeof automationSettingsSchema>;

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = automationSettingsSchema.parse({});

export function isReplyStyle(value: unknown): value is ReplyStyle {
  return typeof value === "string" && (REPLY_STYLES as readonly string[]).includes(value);
}
