import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const cookieName = "promosikan_session";
const sessionDays = 14;

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + sessionDays * 86400000);
  await db.session.create({ data: { userId, tokenHash, expiresAt } });
  (await cookies()).set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
}

export async function currentUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const session = await db.session.findUnique({ where: { tokenHash }, include: { user: { select: { id: true, email: true, name: true } } } });
  return session && session.expiresAt > new Date() ? session.user : null;
}

export async function clearSession() {
  const token = (await cookies()).get(cookieName)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: createHash("sha256").update(token).digest("hex") } });
  (await cookies()).delete(cookieName);
}

export async function requireWorkspace(workspaceId: string, roles?: ("OWNER" | "ADMIN" | "MARKETING" | "SALES" | "VIEWER")[]) {
  const user = await currentUser();
  if (!user) return null;
  const membership = await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: user.id } } });
  if (!membership || (roles && !roles.includes(membership.role))) return null;
  return { user, membership };
}
