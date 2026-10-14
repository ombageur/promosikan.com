import type { Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError } from "firebase-functions/v2/https";
import type { z } from "zod";
import { type LlmClient, LlmConfigError, type LlmRequest, LlmUnavailableError } from "./llm";
import { recordAiUsage } from "./usage";

export type RunOutcome<T> = { kind: "ok"; data: T; model: string } | { kind: "refused"; category: string | null; model: string };

/**
 * Satu panggilan AI terkontrol: panggil, catat biaya, validasi ulang dengan skema ketat.
 * Output tidak valid ditolak & dicatat — tidak pernah disimpan ke Firestore (DoD Fase 3).
 */
export async function runAi<S extends z.ZodType>(
  deps: { db: Firestore; llm: LlmClient },
  meta: { workspaceId: string; route: string; promptVersion: string },
  request: LlmRequest,
  strict: S,
): Promise<RunOutcome<z.output<S>>> {
  let result;
  try {
    result = await deps.llm.complete(request);
  } catch (error) {
    if (error instanceof LlmUnavailableError) {
      logger.warn("AI tidak tersedia sementara", { ...meta, error: error.message });
      throw new HttpsError("unavailable", "Layanan AI sedang sibuk. Coba lagi beberapa saat lagi.");
    }
    if (error instanceof LlmConfigError) {
      logger.error("Konfigurasi AI bermasalah", { ...meta, error: error.message });
      throw new HttpsError("internal", "Layanan AI belum dikonfigurasi dengan benar. Hubungi admin platform.");
    }
    throw error;
  }

  await recordAiUsage(deps.db, meta.workspaceId, meta.route, result.usage);

  if (result.kind === "refused") {
    logger.info("AI menolak permintaan", { ...meta, category: result.category, model: result.usage.model });
    return { kind: "refused", category: result.category, model: result.usage.model };
  }
  if (result.kind === "incomplete") {
    logger.error("Output AI tidak lengkap", { ...meta, reason: result.reason, model: result.usage.model });
    throw new HttpsError("internal", "AI tidak menghasilkan jawaban yang lengkap. Coba lagi.");
  }

  const parsed = strict.safeParse(result.json);
  if (!parsed.success) {
    logger.error("Output AI tidak lolos validasi", {
      ...meta,
      model: result.usage.model,
      issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`),
    });
    throw new HttpsError("internal", "AI mengembalikan hasil yang tidak valid. Coba lagi.");
  }
  return { kind: "ok", data: parsed.data, model: result.usage.model };
}
