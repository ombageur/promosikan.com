import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { credentialsSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const parsed = credentialsSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Email atau kata sandi tidak valid" }, { status: 400 });
    const user = await db.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !(await compare(parsed.data.password, user.passwordHash))) return NextResponse.json({ error: "Email atau kata sandi salah" }, { status: 401 });
    await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch { return NextResponse.json({ error: "Login gagal. Periksa konfigurasi database." }, { status: 500 }); }
}
