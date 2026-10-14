import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { automationSettingsSchema, DEFAULT_AUTOMATION_SETTINGS } from "@shared/schemas/automation";
import type { Keyword, KeywordGroup, Offering } from "@shared/schemas/catalog";
import { auth } from "@/lib/firebase/auth";
import { db } from "@/lib/firebase/firestore";
import type { CatalogSource, WithId } from "./types";

// Batas atas list (SPEC §14: tidak ada query tanpa batas). Kuota per plan ditegakkan di Fase 7.
export const CATALOG_LIMITS = { offerings: 200, keywordGroups: 100, keywords: 500 } as const;

function uid() {
  const current = auth.currentUser;
  if (!current) throw new Error("Sesi berakhir. Silakan masuk kembali.");
  return current.uid;
}

/** Simpan dokumen katalog dengan jejak penulis yang diwajibkan firestore.rules. */
async function save<T extends object>(path: string[], id: string | null, data: T): Promise<string> {
  const col = collection(db, path.join("/"));
  const by = uid();
  if (id) {
    await updateDoc(doc(col, id), { ...data, updatedAt: serverTimestamp(), updatedBy: by });
    return id;
  }
  const ref = doc(col);
  await setDoc(ref, { ...data, createdAt: serverTimestamp(), createdBy: by, updatedAt: serverTimestamp(), updatedBy: by });
  return ref.id;
}

function strip<T>(data: Record<string, unknown>): T {
  const { createdAt: _c, createdBy: _cb, updatedAt: _u, updatedBy: _ub, ...rest } = data;
  return rest as T;
}

export function firestoreCatalog(workspaceId: string): CatalogSource {
  const base = ["workspaces", workspaceId];
  const col = (name: string) => collection(db, "workspaces", workspaceId, name);

  async function list<T>(name: string, field: string, max: number): Promise<WithId<T>[]> {
    const snap = await getDocs(query(col(name), orderBy(field), limit(max)));
    return snap.docs.map((d) => ({ id: d.id, ...strip<T>(d.data()) }));
  }

  return {
    listOfferings: () => list<Offering>("offerings", "name", CATALOG_LIMITS.offerings),
    saveOffering: (id, data) => save([...base, "offerings"], id, data),
    deleteOffering: (id) => deleteDoc(doc(col("offerings"), id)),

    listKeywordGroups: () => list<KeywordGroup>("keywordGroups", "name", CATALOG_LIMITS.keywordGroups),
    saveKeywordGroup: (id, data) => save([...base, "keywordGroups"], id, data),
    async deleteKeywordGroup(id) {
      const members = await getDocs(query(col("keywords"), where("groupId", "==", id), limit(CATALOG_LIMITS.keywords)));
      const batch = writeBatch(db);
      const by = uid();
      members.docs.forEach((d) => batch.update(d.ref, { groupId: null, updatedAt: serverTimestamp(), updatedBy: by }));
      batch.delete(doc(col("keywordGroups"), id));
      await batch.commit();
    },

    listKeywords: () => list<Keyword>("keywords", "term", CATALOG_LIMITS.keywords),
    saveKeyword: (id, data) => save([...base, "keywords"], id, data),
    deleteKeyword: (id) => deleteDoc(doc(col("keywords"), id)),

    async getAutomationSettings() {
      const snap = await getDoc(doc(col("settings"), "automation"));
      if (!snap.exists()) return DEFAULT_AUTOMATION_SETTINGS;
      // Dokumen lama/parsial tetap aman: field yang hilang diisi default.
      return automationSettingsSchema.parse(strip(snap.data()));
    },
    async saveAutomationSettings(data) {
      await setDoc(doc(col("settings"), "automation"), { ...data, updatedAt: serverTimestamp(), updatedBy: uid() });
    },
  };
}
