/**
 * Batas per paket. Fase 3 hanya memakai kuota AI; paket berbayar & batas lain di Fase 7.
 */
export const PLAN_LIMITS = {
  free: { aiCallsPerMonth: 200 },
} as const;

export type PlanId = keyof typeof PLAN_LIMITS;

export function planLimits(plan: unknown) {
  return PLAN_LIMITS[(typeof plan === "string" && plan in PLAN_LIMITS ? plan : "free") as PlanId];
}

/** Batas panggilan AI per pengguna per menit (anti-penyalahgunaan). */
export const AI_CALLS_PER_USER_PER_MINUTE = 10;
