import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const parsed = registerSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Data pendaftaran tidak valid", details: parsed.error.flatten() }, { status: 400 });
    const { name, email, password, workspaceName } = parsed.data;
    const exists = await db.user.findUnique({ where: { email } });
    if (exists) return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
    const passwordHash = await hash(password, 12);
    const slug = `${workspaceName.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0,40) || "workspace"}-${crypto.randomUUID().slice(0, 8)}`;
    const user = await db.user.create({ data: { name, email, passwordHash, memberships: { create: { role: "OWNER", workspace: { create: { name: workspaceName, slug, profile: { create: { name: workspaceName } }, settings: { create: {} } } } } } }, select: { id: true, email: true, name: true } });
    await createSession(user.id);
    return NextResponse.json({ user }, { status: 201 });
  } catch { return NextResponse.json({ error: "Pendaftaran gagal. Periksa konfigurasi database." }, { status: 500 }); }
}
