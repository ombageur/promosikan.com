import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { AI_CALLS_PER_USER_PER_MINUTE, planLimits } from "@shared/plans";
import type { LlmUsage } from "./llm";
import { estimateCostUsd } from "./pricing";

const monthKey = (now: Date) => `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

/**
 * Pesan satu panggilan AI sebelum memanggil Claude: cek kuota bulanan workspace dan
 * rate limit per pengguna dalam satu transaksi. Ditolak → tidak ada panggilan AI sama sekali.
 */
export async function reserveAiCall(db: Firestore, workspaceId: string, uid: string, plan: unknown, now = new Date()) {
  const usageCol = db.collection("workspaces").doc(workspaceId).collection("usage");
  const monthRef = usageCol.doc(monthKey(now));
  const rateRef = usageCol.doc(`rate_${uid}`);
  const limit = planLimits(plan).aiCallsPerMonth;
  const minute = Math.floor(now.getTime() / 60_000);

  await db.runTransaction(async (tx) => {
    const [month, rate] = await Promise.all([tx.get(monthRef), tx.get(rateRef)]);
    const used = Number(month.get("aiCalls") ?? 0);
    if (used >= limit) {
      throw new HttpsError("resource-exhausted", `Kuota AI bulan ini habis (${limit} analisis). Kuota direset awal bulan depan.`);
    }
    const sameMinute = rate.get("minute") === minute;
    const count = sameMinute ? Number(rate.get("count") ?? 0) : 0;
    if (count >= AI_CALLS_PER_USER_PER_MINUTE) {
      throw new HttpsError("resource-exhausted", "Terlalu banyak permintaan AI. Tunggu sebentar lalu coba lagi.");
    }
    tx.set(monthRef, { month: monthKey(now), aiCalls: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(rateRef, { minute, count: count + 1 });
  });
}

/** Catat token & estimasi biaya setelah panggilan (termasuk yang ditolak/gagal parse — tetap ditagih). */
export async function recordAiUsage(db: Firestore, workspaceId: string, route: string, usage: LlmUsage, now = new Date()) {
  const cost = estimateCostUsd(usage);
  await db
    .collection("workspaces")
    .doc(workspaceId)
    .collection("usage")
    .doc(monthKey(now))
    .set(
      {
        inputTokens: FieldValue.increment(usage.inputTokens),
        outputTokens: FieldValue.increment(usage.outputTokens),
        cacheCreationTokens: FieldValue.increment(usage.cacheCreationTokens),
        cacheReadTokens: FieldValue.increment(usage.cacheReadTokens),
        costUsd: FieldValue.increment(cost.usd),
        [`calls.${route}`]: FieldValue.increment(1),
        ...(cost.known ? {} : { unknownPriceModels: FieldValue.arrayUnion(usage.model) }),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}
