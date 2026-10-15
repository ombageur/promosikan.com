import { collection, doc, getDoc, getDocs, limit, orderBy, query, type Timestamp } from "firebase/firestore";
import { callable } from "@/lib/firebase/callable";
import { db } from "@/lib/firebase/firestore";

export type ThreadsAccount = {
  status: "connected" | "expired" | "revoked" | "error";
  username: string;
  lastSyncAt: Timestamp | null;
  nextSyncAt: Timestamp | null;
  tokenExpiresAt: Timestamp | null;
  lastError: string | null;
  quota?: { day: string; queries: number };
};

export type MonitoringRun = {
  id: string;
  startedAt: Timestamp;
  keywordsQueried: number;
  postsFound: number;
  postsNew: number;
  ownPostsSkipped?: number;
  stopReason: string | null;
  errors: string[];
};

export const startThreadsOAuth = callable<{ workspaceId: string }, { url: string }>("startThreadsOAuth");
export const disconnectThreads = callable<{ workspaceId: string }, { ok: true }>("disconnectThreads");
export const syncThreadsNow = callable<{ workspaceId: string }, { queued: true }>("syncThreadsNow");

export async function getThreadsAccount(workspaceId: string): Promise<ThreadsAccount | null> {
  const snap = await getDoc(doc(db, "workspaces", workspaceId, "socialAccounts", "threads"));
  return snap.exists() ? (snap.data() as ThreadsAccount) : null;
}

export async function listMonitoringRuns(workspaceId: string, max = 5): Promise<MonitoringRun[]> {
  const snap = await getDocs(query(collection(db, "workspaces", workspaceId, "monitoringRuns"), orderBy("startedAt", "desc"), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MonitoringRun, "id">) }));
}

/** Sama dengan DAILY_QUERY_BUDGET di functions/src/discovery/monitoring.ts. */
export const THREADS_DAILY_QUERY_BUDGET = 1500;
