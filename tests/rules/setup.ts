import { readFileSync } from "node:fs";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import type { Role } from "../../shared/permissions";

export const PROJECT_ID = "demo-promosikan";

export async function createEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: readFileSync("storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
  });
}

/** Anggota workspace ws1 untuk setiap role, plus eve (owner ws2) sebagai orang luar. */
export const WS1_MEMBERS: Record<Role, string> = {
  owner: "alice",
  admin: "bob",
  marketing: "mia",
  sales: "sam",
  viewer: "vic",
};
export const OUTSIDER = "eve";
export const INVITEE_EMAIL = "newbie@example.com";

export const emailOf = (uid: string) => `${uid}@example.com`;

export function asUser(env: RulesTestEnvironment, uid: string, opts: { verified?: boolean; email?: string } = {}) {
  return env.authenticatedContext(uid, { email: opts.email ?? emailOf(uid), email_verified: opts.verified ?? true });
}

export const baseWorkspace = {
  name: "Publish Agency",
  businessName: "PT Publish Agency",
  industry: "Digital Marketing",
  website: "",
  description: "",
  location: "",
  contactEmail: "",
  contactPhone: "",
  brandVoice: "",
  preferredLanguage: "id",
  logoPath: null,
  logoUrl: null,
  plan: "free",
  isDemo: false,
};

export async function seed(env: RulesTestEnvironment) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const now = Timestamp.now();
    await setDoc(doc(db, "workspaces/ws1"), { ...baseWorkspace, ownerId: WS1_MEMBERS.owner, createdAt: now, updatedAt: now });
    for (const [role, uid] of Object.entries(WS1_MEMBERS)) {
      await setDoc(doc(db, `workspaces/ws1/members/${uid}`), { uid, role, email: emailOf(uid), displayName: uid, joinedAt: now });
    }
    await setDoc(doc(db, "workspaces/ws2"), { ...baseWorkspace, name: "Lain", ownerId: OUTSIDER, createdAt: now, updatedAt: now });
    await setDoc(doc(db, `workspaces/ws2/members/${OUTSIDER}`), {
      uid: OUTSIDER,
      role: "owner",
      email: emailOf(OUTSIDER),
      displayName: OUTSIDER,
      joinedAt: now,
    });
    await setDoc(doc(db, "workspaces/ws1/auditLogs/log1"), { action: "workspace.created", actorUid: "alice", createdAt: now });
    await setDoc(doc(db, "invitations/inv1"), {
      workspaceId: "ws1",
      workspaceName: "Publish Agency",
      email: INVITEE_EMAIL,
      role: "viewer",
      tokenHash: "x",
      status: "pending",
      createdAt: now,
      expiresAt: now,
    });
    await setDoc(doc(db, "users/alice"), { displayName: "Alice", email: emailOf("alice"), createdAt: now, updatedAt: now });
  });
}
