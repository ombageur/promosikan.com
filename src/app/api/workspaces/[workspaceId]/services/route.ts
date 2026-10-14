import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import { serviceSchema } from "@/lib/validation";
type Context = { params: Promise<{ workspaceId: string }> };
export async function GET(_request: Request, { params }: Context) {
  const { workspaceId } = await params;
  if (!(await requireWorkspace(workspaceId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const services = await db.service.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ services });
}
export async function POST(request: Request, { params }: Context) {
  const { workspaceId } = await params;
  if (!(await requireWorkspace(workspaceId, ["OWNER", "ADMIN", "MARKETING"]))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = serviceSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Layanan tidak valid", details: parsed.error.flatten() }, { status: 400 });
  const service = await db.service.create({ data: { workspaceId, ...parsed.data } });
  return NextResponse.json({ service }, { status: 201 });
}
