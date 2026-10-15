import { type CallableOptions, type CallableRequest, HttpsError } from "firebase-functions/v2/https";
import type { z } from "zod";

/** Identitas pemanggil yang sudah diverifikasi. Handler hanya menerima ini, bukan request mentah. */
export type CallContext = {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
};

/**
 * App Check di-enforce lewat env ENFORCE_APP_CHECK=true (functions/.env.<project>).
 * Default nonaktif sampai site key reCAPTCHA Enterprise dikonfigurasi di frontend.
 */
export const callableOptions: CallableOptions = {
  enforceAppCheck: process.env.ENFORCE_APP_CHECK === "true",
  // Callable dipanggil langsung dari browser; akses dijaga requireAuth + requirePermission di handler.
  // Dinyatakan eksplisit agar setiap deploy (termasuk update) memasang izin invoker Cloud Run.
  invoker: "public",
};

export function requireAuth(request: Pick<CallableRequest, "auth">): CallContext {
  const auth = request.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Silakan masuk terlebih dahulu.");
  const email = typeof auth.token.email === "string" ? auth.token.email.toLowerCase() : "";
  if (!email || auth.token.email_verified !== true) {
    throw new HttpsError("failed-precondition", "Verifikasi email Anda terlebih dahulu.");
  }
  const name = typeof auth.token.name === "string" ? auth.token.name : "";
  return { uid: auth.uid, email, emailVerified: true, displayName: name || email.split("@")[0] || "" };
}

export function parseInput<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path.length ? ` (${first.path.join(".")})` : "";
    throw new HttpsError("invalid-argument", `Input tidak valid${where}: ${first?.message ?? "format salah"}`);
  }
  return result.data;
}
