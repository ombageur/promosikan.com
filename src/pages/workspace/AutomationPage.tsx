import { Lock, ShieldCheck } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import {
  type AutomationSettings,
  automationSettingsSchema,
  MONITORING_INTERVALS,
  REPLY_STYLE_LABELS,
  REPLY_STYLES,
} from "@shared/schemas/automation";
import { Field } from "@/components/forms/Field";
import { fieldAria } from "@/components/forms/field-aria";
import { QueryBoundary } from "@/components/layout/QueryBoundary";
import { PageHeader } from "@/components/layout/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAutomationSettings, useSaveAutomationSettings } from "@/hooks/useData";
import { useWorkspace } from "@/hooks/useWorkspace";

const INTERVAL_ITEMS = MONITORING_INTERVALS.map((m) => ({ value: String(m), label: m < 1440 ? `Setiap ${m / 60} jam` : "Setiap hari" }));
const STYLE_ITEMS = REPLY_STYLES.map((s) => ({ value: s, label: REPLY_STYLE_LABELS[s] }));

function SettingsForm({ initial, editable }: { initial: AutomationSettings; editable: boolean }) {
  const save = useSaveAutomationSettings();
  const form = useForm<AutomationSettings>({ values: initial, resetOptions: { keepDirtyValues: true } });
  const { errors, isDirty } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    const parsed = automationSettingsSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) form.setError(issue.path[0] as keyof AutomationSettings, { message: issue.message });
      return;
    }
    save.mutate(parsed.data, { onSuccess: () => form.reset(parsed.data) });
  });

  const number = (name: "minOpportunityScore" | "minMatchScore" | "dailyReplyLimit" | "authorCooldownDays", label: string, min: number, max: number, hint?: string) => (
    <Field id={name} label={label} error={errors[name]?.message} hint={hint}>
      <Input type="number" min={min} max={max} step={1} {...fieldAria(name, errors[name]?.message)} {...form.register(name, { valueAsNumber: true })} />
    </Field>
  );

  const toggle = (name: "monitoringEnabled" | "duplicateDetection" | "notifyInApp" | "notifyEmail", label: string, hint: string) => (
    <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
      <input type="checkbox" className="mt-0.5 size-4 accent-primary" {...form.register(name)} />
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <fieldset disabled={!editable || save.isPending} className="grid gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Monitoring</CardTitle>
            <CardDescription>Pemantauan keyword di Threads berjalan setelah integrasi aktif (Fase 4).</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">{toggle("monitoringEnabled", "Aktifkan monitoring", "Belum berpengaruh sampai akun Threads terhubung.")}</div>
            <Field id="monitoringIntervalMinutes" label="Interval monitoring">
              <Controller
                control={form.control}
                name="monitoringIntervalMinutes"
                render={({ field }) => (
                  <Select items={INTERVAL_ITEMS} value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))} disabled={!editable}>
                    <SelectTrigger id="monitoringIntervalMinutes" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVAL_ITEMS.map((i) => (
                        <SelectItem key={i.value} value={i.value}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            {toggle("duplicateDetection", "Deteksi duplikat", "Abaikan post yang sudah pernah dianalisis.")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ambang AI</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {number("minOpportunityScore", "Skor peluang minimum", 0, 100, "Peluang di bawah ambang tidak dibuatkan draft.")}
            {number("minMatchScore", "Match score minimum", 0, 100, "Di bawah ambang dianggap “tidak ada yang cocok”.")}
            <Field id="defaultReplyStyle" label="Gaya balasan default">
              <Controller
                control={form.control}
                name="defaultReplyStyle"
                render={({ field }) => (
                  <Select items={STYLE_ITEMS} value={field.value} onValueChange={(v) => field.onChange(v)} disabled={!editable}>
                    <SelectTrigger id="defaultReplyStyle" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STYLE_ITEMS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Batas balasan</CardTitle>
            <CardDescription>Melindungi reputasi akun dan mencegah balasan yang terasa seperti spam.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {number("dailyReplyLimit", "Balasan maksimum per hari", 1, 100)}
            {number("authorCooldownDays", "Jeda ke author yang sama (hari)", 1, 30)}
            <Alert className="sm:col-span-2" role="note">
              <ShieldCheck aria-hidden />
              <AlertTitle>Approval manual selalu aktif</AlertTitle>
              <AlertDescription>
                Setiap balasan harus disetujui manusia sebelum dikirim. Auto-reply tidak tersedia di versi ini.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifikasi</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {toggle("notifyInApp", "Notifikasi di aplikasi", "Draft baru, kegagalan kirim, lead di-assign.")}
            {toggle("notifyEmail", "Notifikasi email", "Ringkasan peluang penting.")}
          </CardContent>
        </Card>

        {editable && (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={!isDirty} onClick={() => form.reset(initial)}>
              Batalkan
            </Button>
            <Button type="submit" disabled={!isDirty || save.isPending}>
              {save.isPending ? "Menyimpan…" : "Simpan pengaturan"}
            </Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}

export function AutomationPage() {
  const { can } = useWorkspace();
  const editable = can("automation.manage");
  const settings = useAutomationSettings();

  return (
    <>
      <PageHeader title="Automation" description="Atur monitoring, ambang AI, dan batas balasan. Auto-reply nonaktif secara permanen di versi ini." />
      {!editable && (
        <Alert className="mb-5" role="note">
          <Lock aria-hidden />
          <AlertDescription>Hanya Owner dan Admin yang dapat mengubah pengaturan automation.</AlertDescription>
        </Alert>
      )}
      <QueryBoundary query={settings}>{(initial) => <SettingsForm initial={initial} editable={editable} />}</QueryBoundary>
    </>
  );
}
