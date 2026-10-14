import { Lock, ShieldCheck, Sparkles } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { analyzeConversationInput, POST_MAX_CHARS } from "@shared/schemas/ai";
import { planLimits } from "@shared/plans";
import { BAND_LABELS } from "@shared/scoring";
import { Field } from "@/components/forms/Field";
import { fieldAria } from "@/components/forms/field-aria";
import { ScoreBadge } from "@/components/intelligence/badges";
import { EmptyState } from "@/components/layout/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAnalyzeConversation, useCapabilities } from "@/hooks/useData";
import { useWorkspace } from "@/hooks/useWorkspace";

type Errors = Partial<Record<"text" | "authorHandle" | "permalink", string>>;

/** Analisis Manual (SPEC §8): tempel teks post, AI menilai peluang & mencocokkan katalog. */
export function ManualAnalysis() {
  const { workspace, basePath, can } = useWorkspace();
  const caps = useCapabilities();
  const analyze = useAnalyzeConversation();
  const [text, setText] = useState("");
  const [authorHandle, setAuthorHandle] = useState("");
  const [permalink, setPermalink] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  if (!caps.ai) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Analisis Manual tidak tersedia di data demo"
        description="Workspace demo tidak memanggil AI. Buat workspace sendiri untuk menganalisis percakapan nyata."
        className="bg-white"
      />
    );
  }
  if (!can("ai.use")) {
    return <EmptyState icon={Lock} title="Role Anda tidak dapat memakai AI" description="Hubungi Owner atau Admin workspace." className="bg-white" />;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = analyzeConversationInput.safeParse({ workspaceId: workspace.id, text, authorHandle, permalink });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof Errors] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    analyze.mutate({ text: parsed.data.text, authorHandle: parsed.data.authorHandle, permalink: parsed.data.permalink });
  }

  const result = analyze.data;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Analisis Manual</CardTitle>
          <CardDescription>
            Tempel teks post dari media sosial. AI menilai niat membeli, mencocokkan dengan katalog, dan menyimpannya sebagai peluang.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4" noValidate>
            <Field id="ma-text" label="Teks post" error={errors.text} hint={`${text.length}/${POST_MAX_CHARS} karakter`}>
              <Textarea
                rows={5}
                value={text}
                maxLength={POST_MAX_CHARS}
                onChange={(e) => setText(e.target.value)}
                placeholder="mis. Ada rekomendasi agency SEO di Surabaya? Website saya susah muncul di Google."
                {...fieldAria("ma-text", errors.text)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="ma-handle" label="Akun penulis (opsional)" error={errors.authorHandle}>
                <Input value={authorHandle} onChange={(e) => setAuthorHandle(e.target.value)} placeholder="@nama" {...fieldAria("ma-handle", errors.authorHandle)} />
              </Field>
              <Field id="ma-link" label="Tautan post (opsional)" error={errors.permalink}>
                <Input type="url" value={permalink} onChange={(e) => setPermalink(e.target.value)} placeholder="https://" {...fieldAria("ma-link", errors.permalink)} />
              </Field>
            </div>
            <Button type="submit" className="justify-self-start" disabled={analyze.isPending}>
              <Sparkles aria-hidden />
              {analyze.isPending ? "Menganalisis…" : "Analisis dengan AI"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid content-start gap-4">
        {result && (
          <Card role="status" aria-live="polite">
            <CardHeader>
              <CardTitle>Hasil analisis</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {result.analysisStatus === "refused" ? (
                <p>AI tidak dapat menganalisis post ini. Peluang disimpan dengan tanda “Perlu review manual”.</p>
              ) : (
                <>
                  <ScoreBadge score={result.score} className="justify-self-start" />
                  <p>
                    {BAND_LABELS[result.band]}
                    {result.matched ? " — cocok dengan katalog Anda." : " — tidak ada produk/layanan yang cocok."}
                  </p>
                </>
              )}
              <div className="flex flex-wrap gap-3">
                <Link to={`${basePath}/opportunities`} className="font-semibold text-primary hover:underline">
                  Lihat di Opportunities
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
        <Alert role="note">
          <ShieldCheck aria-hidden />
          <AlertTitle>Tentang Analisis Manual</AlertTitle>
          <AlertDescription>
            <p>
              Teks dianalisis oleh Claude (Anthropic). Jangan menempelkan data pribadi yang tidak perlu. Satu analisis memakai 1 dari{" "}
              {planLimits(workspace.plan).aiCallsPerMonth} kuota AI bulanan.
            </p>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
