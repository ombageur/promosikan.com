import { CheckCircle2, Circle, Compass, Sparkles } from "lucide-react";
import { Link } from "react-router";
import { PageHeader } from "@/components/layout/states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/hooks/useWorkspace";

export function OverviewPage() {
  const { workspace, can } = useWorkspace();
  const base = `/w/${workspace.id}`;
  const profileComplete = Boolean(workspace.description && workspace.website && workspace.brandVoice);

  const steps = [
    { done: true, label: "Buat workspace", to: null },
    { done: profileComplete, label: "Lengkapi profil bisnis & brand voice", to: `${base}/settings` },
    { done: false, label: "Undang anggota tim", to: can("members.manage") ? `${base}/settings/members` : null },
    { done: false, label: "Tambahkan produk & layanan (Fase 2)", to: null },
    { done: false, label: "Hubungkan Threads (Fase 4)", to: null },
  ];

  return (
    <>
      <PageHeader title={`Selamat datang di ${workspace.name}`} description="Temukan yang butuh. Tawarkan yang tepat." />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Langkah awal</CardTitle>
            <CardDescription>Siapkan workspace agar AI bisa mencocokkan percakapan dengan layanan Anda.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-2">
              {steps.map((step) => {
                const Icon = step.done ? CheckCircle2 : Circle;
                const content = (
                  <>
                    <Icon className={step.done ? "size-5 text-success" : "size-5 text-muted-foreground"} aria-hidden />
                    <span className={step.done ? "text-muted-foreground line-through" : ""}>{step.label}</span>
                    <span className="sr-only">{step.done ? "(selesai)" : "(belum)"}</span>
                  </>
                );
                return (
                  <li key={step.label}>
                    {step.to && !step.done ? (
                      <Link to={step.to} className="flex items-center gap-3 rounded-lg p-2 text-sm hover:bg-slate-50">
                        {content}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 p-2 text-sm">{content}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
        <Card className="bg-secondary/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" aria-hidden />
              Belum ada data peluang
            </CardTitle>
            <CardDescription>
              Dashboard peluang, analisis AI, dan Reply Center aktif di fase berikutnya. Sementara itu, lihat contohnya di demo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/demo" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
              <Compass className="size-4" aria-hidden />
              Buka demo Publish Agency
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
