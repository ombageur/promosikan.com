import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  type Timestamp,
  updateDoc,
} from "firebase/firestore";
import type { Opportunity, ReplyDraft } from "@shared/types/intelligence";
import { auth } from "@/lib/firebase/auth";
import { db } from "@/lib/firebase/firestore";
import type { IntelligenceSource } from "./types";

const LIST_LIMIT = 100;

const iso = (value: unknown): string | undefined => {
  const ts = value as Timestamp | null | undefined;
  return ts && typeof ts.toDate === "function" ? ts.toDate().toISOString() : undefined;
};

function uid() {
  const current = auth.currentUser;
  if (!current) throw new Error("Sesi berakhir. Silakan masuk kembali.");
  return current.uid;
}

/**
 * Peluang & draft nyata dari Firestore (ditulis Cloud Functions). Lead dan statistik
 * belum tersedia sampai Fase 5–6, sehingga dikembalikan kosong tanpa data palsu.
 */
export function firestoreIntelligence(workspaceId: string): IntelligenceSource {
  const col = (name: string) => collection(db, "workspaces", workspaceId, name);
  const unavailable = async () => {
    throw new Error("Fitur ini belum tersedia untuk workspace ini.");
  };

  return {
    capabilities: { opportunities: true, drafts: true, leads: false, stats: false, ai: true },

    async listOpportunities() {
      const snap = await getDocs(query(col("opportunities"), orderBy("createdAt", "desc"), limit(LIST_LIMIT)));
      return snap.docs.map((d) => {
        const data = d.data();
        return { ...(data as Omit<Opportunity, "id" | "createdAt">), id: d.id, createdAt: iso(data.createdAt) };
      });
    },
    async setOpportunityStatus(id, status) {
      await updateDoc(doc(col("opportunities"), id), { status, updatedAt: serverTimestamp(), updatedBy: uid() });
    },

    async listReplyDrafts() {
      const snap = await getDocs(query(col("replyDrafts"), orderBy("updatedAt", "desc"), limit(LIST_LIMIT)));
      return snap.docs.map((d) => {
        const data = d.data();
        const quality = (data.quality ?? { passed: false, notes: [] }) as ReplyDraft["quality"] & { checkedAt?: unknown };
        return {
          ...(data as Omit<ReplyDraft, "id" | "quality" | "updatedAt">),
          id: d.id,
          quality: { passed: quality.passed, notes: quality.notes ?? [], checkedAt: iso(quality.checkedAt) ?? null },
          updatedAt: iso(data.updatedAt),
        };
      });
    },
    async updateReplyDraft(id, patch) {
      await updateDoc(doc(col("replyDrafts"), id), { ...patch, updatedAt: serverTimestamp(), updatedBy: uid() });
    },

    listLeads: async () => [],
    updateLead: unavailable,
    listDailyStats: async () => [],
  };
}
