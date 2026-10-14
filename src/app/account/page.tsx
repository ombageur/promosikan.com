"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { credentialsSchema, registerSchema } from "@/lib/validation";
import { z } from "zod";

type Fields = z.input<typeof registerSchema>;

export default function AccountPage() {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit } = useForm<Fields>({ defaultValues: { name: "", email: "", password: "", workspaceName: "" } });
  const submit = async (values: Fields) => {
    const parsed = (mode === "register" ? registerSchema : credentialsSchema).safeParse(values);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Data tidak valid."); return; }
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mode === "register" ? values : { email: values.email, password: values.password }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Permintaan gagal."); return; }
      setSuccess(mode === "register" ? "Akun dan workspace berhasil dibuat. Sesi aman telah dimulai." : "Berhasil masuk.");
    } catch { setError("Server tidak dapat dihubungi."); } finally { setBusy(false); }
  };
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5"><div className="w-full max-w-md"><Link href="/" className="mb-7 flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft size={16}/> Kembali ke demo</Link><div className="card p-7"><div className="mb-6 flex items-center gap-2"><div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white"><Sparkles size={20}/></div><span className="text-lg font-extrabold">promosikan<span className="text-blue-600">.com</span></span></div><div className="mb-5 flex gap-2"><button className={`btn flex-1 ${mode==="register"?"btn-primary":"btn-outline"}`} onClick={()=>setMode("register")}>Daftar</button><button className={`btn flex-1 ${mode==="login"?"btn-primary":"btn-outline"}`} onClick={()=>setMode("login")}>Masuk</button></div><h1 className="text-xl font-extrabold">{mode==="register"?"Buat workspace bisnis":"Masuk ke akun"}</h1><p className="mt-1 text-xs subtle">Memerlukan PostgreSQL yang sudah dikonfigurasi.</p><form onSubmit={handleSubmit(submit)} className="mt-6 space-y-4">{mode==="register"&&<><label className="block text-xs font-bold">Nama Anda<input className="field mt-2" {...register("name")}/></label><label className="block text-xs font-bold">Nama workspace<input className="field mt-2" {...register("workspaceName")}/></label></>}<label className="block text-xs font-bold">Email<input type="email" className="field mt-2" {...register("email")}/></label><label className="block text-xs font-bold">Kata sandi<input type="password" className="field mt-2" {...register("password")}/></label>{error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{success&&<p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</p>}<button disabled={busy} className="btn btn-primary w-full">{busy?"Memproses...":mode==="register"?"Buat akun & workspace":"Masuk"}</button></form><p className="mt-5 flex items-center justify-center gap-1 text-xs subtle"><LockKeyhole size={13}/> Sesi disimpan dalam cookie httpOnly</p></div></div></main>;
}
