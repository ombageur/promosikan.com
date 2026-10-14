import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import {
  generateReplyInput,
  REPLY_MAX_CHARS,
  replyStrictSchema,
  validateReplyInput,
  validationStrictSchema,
} from "@shared/schemas/ai";
import { isReplyStyle } from "@shared/schemas/automation";
import type { WorkspaceProfile } from "@shared/schemas/workspace";
import { type CallContext, parseInput } from "../utils/context";
import { requirePermission } from "../utils/membership";
import type { AiDeps } from "./analyze";
import { loadAiContext } from "./context";
import type { CatalogItem } from "./prompts/common";
import { buildReplyRequest, buildValidateRequest, REPLY_PROMPT_VERSION, VALIDATE_PROMPT_VERSION } from "./prompts/reply";
import { runAi } from "./run";
import { reserveAiCall } from "./usage";

const URL_RE = /\bhttps?:\/\/[^\s)]+/gi;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /(?:\+?62|0)\s?8[\d\s-]{7,}\d/g;

/** Pemeriksaan deterministik (tanpa AI) yang selalu dijalankan bersama validasi AI. */
export function localReplyIssues(text: string, profile: WorkspaceProfile, offering: CatalogItem | null): string[] {
  const issues: string[] = [];
  if (text.length > REPLY_MAX_CHARS) issues.push(`Balasan melebihi ${REPLY_MAX_CHARS} karakter.`);
  const allowedUrls = [profile.website, offering?.landingPageUrl].filter(Boolean).map((u) => u!.replace(/\/$/, ""));
  for (const url of text.match(URL_RE) ?? []) {
    if (!allowedUrls.some((allowed) => url.replace(/\/$/, "").startsWith(allowed))) {
      issues.push(`Tautan ${url} tidak tercantum di profil atau katalog.`);
    }
  }
  for (const email of text.match(EMAIL_RE) ?? []) {
    if (email.toLowerCase() !== profile.contactEmail.toLowerCase()) issues.push(`Email ${email} tidak tercantum di profil.`);
  }
  const digits = (s: string) => s.replace(/\D/g, "");
  for (const phone of text.match(PHONE_RE) ?? []) {
    if (!profile.contactPhone || !digits(profile.contactPhone).endsWith(digits(phone).slice(-8))) {
      issues.push(`Nomor ${phone.trim()} tidak tercantum di profil.`);
    }
  }
  return issues;
}

async function loadOpportunity(db: Firestore, workspaceId: string, opportunityId: string) {
  const snap = await db.collection("workspaces").doc(workspaceId).collection("opportunities").doc(opportunityId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Peluang tidak ditemukan.");
  return snap;
}

async function checkQuality(
  deps: AiDeps,
  meta: { workspaceId: string; uid: string; plan: unknown },
  input: { profile: WorkspaceProfile; offering: CatalogItem | null; postText: string; draftText: string },
) {
  const local = localReplyIssues(input.draftText, input.profile, input.offering);
  await reserveAiCall(deps.db, meta.workspaceId, meta.uid, meta.plan);
  const outcome = await runAi(
    deps,
    { workspaceId: meta.workspaceId, route: "validate", promptVersion: VALIDATE_PROMPT_VERSION },
    buildValidateRequest(input),
    validationStrictSchema,
  );
  if (outcome.kind === "refused") {
    return { passed: false, notes: [...local, "Pemeriksaan otomatis tidak dapat dijalankan. Tinjau secara manual."] };
  }
  const notes = [...local, ...outcome.data.issues];
  return { passed: outcome.data.passed && local.length === 0, notes: notes.length > 0 ? notes : ["Tidak ditemukan masalah."] };
}

/** Buat / buat ulang / persingkat draft balasan untuk satu peluang (SPEC §11). */
export async function generateReplyHandler(deps: AiDeps, ctx: CallContext, data: unknown) {
  const input = parseInput(generateReplyInput, data);
  await requirePermission(deps.db, input.workspaceId, ctx.uid, "ai.use");
  const opp = await loadOpportunity(deps.db, input.workspaceId, input.opportunityId);

  const redFlags = (opp.get("redFlags") as string[] | undefined) ?? [];
  if (redFlags.length > 0 || opp.get("analysisStatus") === "refused") {
    throw new HttpsError("failed-precondition", "Peluang ini perlu review manual. Draft AI tidak dibuat untuk percakapan sensitif.");
  }
  const top = (opp.get("matches") as { offeringId: string; approach: string }[] | undefined)?.[0];
  if (!top) throw new HttpsError("failed-precondition", "Tidak ada produk/layanan yang cocok, sehingga sebaiknya post ini tidak dibalas.");

  const aiContext = await loadAiContext(deps.db, input.workspaceId);
  const offering = aiContext.catalog.find((o) => o.id === top.offeringId);
  if (!offering) throw new HttpsError("failed-precondition", "Produk/layanan yang cocok sudah dihapus atau dinonaktifkan. Analisis ulang post ini.");

  const draftRef = deps.db.collection("workspaces").doc(input.workspaceId).collection("replyDrafts").doc(`draft_${opp.id}`);
  const previous = await draftRef.get();
  if (input.adjustment && !previous.exists) throw new HttpsError("failed-precondition", "Belum ada draft untuk diubah.");
  const style = input.style ?? (isReplyStyle(previous.get("style")) ? previous.get("style") : null) ?? (isReplyStyle(top.approach) ? top.approach : aiContext.settings.defaultReplyStyle);

  await reserveAiCall(deps.db, input.workspaceId, ctx.uid, aiContext.plan);
  const postText = String(opp.get("post.text") ?? "");
  const outcome = await runAi(
    deps,
    { workspaceId: input.workspaceId, route: "reply", promptVersion: REPLY_PROMPT_VERSION },
    buildReplyRequest({
      profile: aiContext.profile,
      offering,
      postText,
      customerProblem: String(opp.get("customerProblem") ?? ""),
      style,
      adjustment: input.adjustment,
      previousText: previous.get("text"),
    }),
    replyStrictSchema,
  );
  if (outcome.kind === "refused") {
    throw new HttpsError("failed-precondition", "AI tidak dapat membuat draft untuk post ini. Tulis balasan secara manual.");
  }

  const quality = await checkQuality(
    deps,
    { workspaceId: input.workspaceId, uid: ctx.uid, plan: aiContext.plan },
    { profile: aiContext.profile, offering, postText, draftText: outcome.data.text },
  );

  await draftRef.set({
    opportunityId: opp.id,
    text: outcome.data.text,
    style,
    status: "draft",
    quality: { ...quality, checkedAt: FieldValue.serverTimestamp() },
    publishable: false,
    promptVersion: REPLY_PROMPT_VERSION,
    model: outcome.model,
    createdAt: previous.get("createdAt") ?? FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: ctx.uid,
  });

  return { draftId: draftRef.id, text: outcome.data.text, quality };
}

/** Periksa ulang draft (mis. setelah disunting manual). */
export async function validateReplyHandler(deps: AiDeps, ctx: CallContext, data: unknown) {
  const input = parseInput(validateReplyInput, data);
  await requirePermission(deps.db, input.workspaceId, ctx.uid, "reply.edit");
  const draftRef = deps.db.collection("workspaces").doc(input.workspaceId).collection("replyDrafts").doc(input.draftId);
  const draft = await draftRef.get();
  if (!draft.exists) throw new HttpsError("not-found", "Draft tidak ditemukan.");
  const opp = await loadOpportunity(deps.db, input.workspaceId, String(draft.get("opportunityId")));
  const aiContext = await loadAiContext(deps.db, input.workspaceId);
  const topId = (opp.get("matches") as { offeringId: string }[] | undefined)?.[0]?.offeringId;
  const offering = aiContext.catalog.find((o) => o.id === topId) ?? null;

  const quality = await checkQuality(
    deps,
    { workspaceId: input.workspaceId, uid: ctx.uid, plan: aiContext.plan },
    { profile: aiContext.profile, offering, postText: String(opp.get("post.text") ?? ""), draftText: String(draft.get("text") ?? "") },
  );
  await draftRef.update({ quality: { ...quality, checkedAt: FieldValue.serverTimestamp() } });
  return { quality };
}
