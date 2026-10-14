import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router";
import { firebaseConfig, useEmulators } from "@/lib/firebase/config";

export function HomePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-6 flex items-center gap-2">
        <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white">
          <Sparkles size={22} aria-hidden />
        </div>
        <span className="text-xl font-extrabold tracking-tight text-slate-900">
          promosikan<span className="text-blue-600">.com</span>
        </span>
      </div>
      <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
        Temukan yang Butuh. Tawarkan yang Tepat.
      </h1>
      <p className="mt-4 max-w-xl text-base text-slate-600">
        Platform AI yang membantu bisnis menemukan calon pelanggan dari percakapan publik, memahami kebutuhannya, dan
        menyiapkan pendekatan promosi yang relevan.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/demo" className="btn btn-primary">
          Lihat Demo <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
      <p className="mt-12 text-xs text-slate-400">
        Fase 0 · Firebase: {useEmulators ? "Emulator Suite" : firebaseConfig.projectId}
      </p>
    </main>
  );
}
