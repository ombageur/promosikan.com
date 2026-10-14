import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const memberships = await db.workspaceMember.findMany({ where: { userId: user.id }, include: { workspace: { select: { id: true, name: true, slug: true } } } });
    return NextResponse.json({ workspaces: memberships.map((member) => ({ ...member.workspace, role: member.role })) });
  } catch { return NextResponse.json({ error: "Database tidak tersedia" }, { status: 503 }); }
}
