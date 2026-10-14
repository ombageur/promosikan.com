import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import { profileSchema } from "@/lib/validation";
type Context = { params: Promise<{ workspaceId: string }> };
export async function GET(_request: Request, { params }: Context) {
  const { workspaceId } = await params;
  if (!(await requireWorkspace(workspaceId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const profile = await db.businessProfile.findUnique({ where: { workspaceId } });
  return NextResponse.json({ profile });
}
export async function PUT(request: Request, { params }: Context) {
  const { workspaceId } = await params;
  if (!(await requireWorkspace(workspaceId, ["OWNER", "ADMIN"]))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = profileSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Profil tidak valid", details: parsed.error.flatten() }, { status: 400 });
  const profile = await db.businessProfile.upsert({ where: { workspaceId }, create: { workspaceId, ...parsed.data }, update: parsed.data });
  return NextResponse.json({ profile });
}
