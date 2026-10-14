import type { Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { automationSettingsSchema, DEFAULT_AUTOMATION_SETTINGS, type AutomationSettings } from "@shared/schemas/automation";
import { offeringSchema } from "@shared/schemas/catalog";
import { workspaceProfileSchema, type WorkspaceProfile } from "@shared/schemas/workspace";
import type { CatalogItem } from "./prompts/common";

/** Katalog besar dipersempit sebelum dikirim ke AI (SPEC §10). */
export const MAX_CATALOG_IN_PROMPT = 30;

export type AiContext = {
  profile: WorkspaceProfile;
  plan: unknown;
  catalog: CatalogItem[];
  settings: AutomationSettings;
};

export async function loadAiContext(db: Firestore, workspaceId: string): Promise<AiContext> {
  const ws = db.collection("workspaces").doc(workspaceId);
  const [workspace, offerings, settings] = await Promise.all([
    ws.get(),
    ws.collection("offerings").where("isActive", "==", true).limit(200).get(),
    ws.collection("settings").doc("automation").get(),
  ]);
  if (!workspace.exists) throw new HttpsError("not-found", "Workspace tidak ditemukan.");
  if (workspace.get("isDemo") === true) {
    // Workspace demo memakai data contoh; panggilan AI berbayar hanya untuk workspace nyata.
    throw new HttpsError("failed-precondition", "Workspace demo tidak memakai AI. Buat workspace sendiri untuk analisis AI.");
  }

  const catalog: CatalogItem[] = [];
  for (const doc of offerings.docs) {
    const parsed = offeringSchema.safeParse(doc.data());
    if (parsed.success) catalog.push({ id: doc.id, ...parsed.data });
  }

  return {
    profile: workspaceProfileSchema.parse(workspace.data()),
    plan: workspace.get("plan"),
    catalog,
    settings: settings.exists ? automationSettingsSchema.parse(settings.data() ?? {}) : DEFAULT_AUTOMATION_SETTINGS,
  };
}

/** Pilih maksimal 30 item paling relevan berdasarkan kecocokan kata (prefilter murah, tanpa AI). */
export function narrowCatalog(catalog: CatalogItem[], text: string, max = MAX_CATALOG_IN_PROMPT): CatalogItem[] {
  if (catalog.length <= max) return catalog;
  const words = new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2));
  const scoreOf = (o: CatalogItem) =>
    [o.name, o.category, ...o.keywords, ...o.problemsSolved]
      .join(" ")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => words.has(w)).length;
  return [...catalog].sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, max);
}
