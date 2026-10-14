import { BriefcaseBusiness, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  type Offering,
  OFFERING_TYPE_LABELS,
  OFFERING_TYPES,
  offeringSchema,
  splitList,
} from "@shared/schemas/catalog";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { Field } from "@/components/forms/Field";
import { fieldAria } from "@/components/forms/field-aria";
import { QueryBoundary } from "@/components/layout/QueryBoundary";
import { EmptyState, PageHeader } from "@/components/layout/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDeleteOffering, useOfferings, useSaveOffering } from "@/hooks/useData";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { WithId } from "@/services/data/types";

type FormValues = {
  name: string;
  type: Offering["type"];
  category: string;
  description: string;
  benefits: string;
  targetAudience: string;
  problemsSolved: string;
  keywords: string;
  priceRange: string;
  usp: string;
  landingPageUrl: string;
  allowedClaims: string;
  isActive: boolean;
};

const TYPE_ITEMS = OFFERING_TYPES.map((t) => ({ value: t, label: OFFERING_TYPE_LABELS[t] }));
const lines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);

const toForm = (o?: Offering): FormValues => ({
  name: o?.name ?? "",
  type: o?.type ?? "service",
  category: o?.category ?? "",
  description: o?.description ?? "",
  benefits: (o?.benefits ?? []).join("\n"),
  targetAudience: o?.targetAudience ?? "",
  problemsSolved: (o?.problemsSolved ?? []).join("\n"),
  keywords: (o?.keywords ?? []).join(", "),
  priceRange: o?.priceRange ?? "",
  usp: o?.usp ?? "",
  landingPageUrl: o?.landingPageUrl ?? "",
  allowedClaims: (o?.allowedClaims ?? []).join("\n"),
  isActive: o?.isActive ?? true,
});

function OfferingDialog({ offering, open, onOpenChange }: { offering: WithId<Offering> | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const save = useSaveOffering();
  const form = useForm<FormValues>({ values: toForm(offering ?? undefined) });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (v) => {
    const parsed = offeringSchema.safeParse({
      ...v,
      benefits: lines(v.benefits),
      problemsSolved: lines(v.problemsSolved),
      keywords: splitList(v.keywords),
      allowedClaims: lines(v.allowedClaims),
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        form.setError(issue.path[0] as keyof FormValues, { message: issue.message });
      }
      return;
    }
    await save.mutateAsync({ id: offering?.id ?? null, value: parsed.data });
    onOpenChange(false);
  });

  const text = (name: keyof FormValues, label: string, hint?: string, placeholder?: string) => (
    <Field id={`o-${name}`} label={label} error={errors[name]?.message} hint={hint}>
      <Input placeholder={placeholder} {...fieldAria(`o-${name}`, errors[name]?.message)} {...form.register(name)} />
    </Field>
  );
  const area = (name: keyof FormValues, label: string, hint?: string) => (
    <Field id={`o-${name}`} label={label} error={errors[name]?.message} hint={hint} className="sm:col-span-2">
      <Textarea rows={3} {...fieldAria(`o-${name}`, errors[name]?.message)} {...form.register(name)} />
    </Field>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{offering ? `Edit ${offering.name}` : "Tambah produk/layanan"}</DialogTitle>
          <DialogDescription>AI memakai informasi ini untuk mencocokkan kebutuhan pelanggan dan menyusun balasan.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          {text("name", "Nama", undefined, "SEO Management")}
          <Field id="o-type" label="Jenis">
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select items={TYPE_ITEMS} value={field.value} onValueChange={(v) => field.onChange(v)}>
                  <SelectTrigger id="o-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_ITEMS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          {text("category", "Kategori")}
          {text("priceRange", "Kisaran harga", undefined, "Mulai Rp3 juta/bulan")}
          {area("description", "Deskripsi")}
          {text("targetAudience", "Target pelanggan")}
          {text("landingPageUrl", "Landing page", undefined, "https://")}
          {area("problemsSolved", "Masalah yang diselesaikan", "Satu per baris. Dipakai untuk pencocokan.")}
          {area("benefits", "Manfaat", "Satu per baris.")}
          <Field id="o-keywords" label="Keyword" error={errors.keywords?.message} hint="Pisahkan dengan koma." className="sm:col-span-2">
            <Input {...fieldAria("o-keywords", errors.keywords?.message)} {...form.register("keywords")} />
          </Field>
          {text("usp", "Unique selling proposition")}
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" {...form.register("isActive")} />
              Aktif (dipakai untuk pencocokan)
            </label>
          </div>
          {area("allowedClaims", "Klaim yang boleh disebut AI", "Satu per baris. AI tidak akan menjanjikan hal di luar daftar ini.")}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProductsPage() {
  const { can } = useWorkspace();
  const editable = can("catalog.manage");
  const offerings = useOfferings();
  const save = useSaveOffering();
  const remove = useDeleteOffering();
  const [editing, setEditing] = useState<WithId<Offering> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<WithId<Offering> | null>(null);

  const openEditor = (o: WithId<Offering> | null) => {
    setEditing(o);
    setDialogOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Products & Services"
        description="Katalog yang dipakai AI untuk mencocokkan kebutuhan calon pelanggan."
        action={
          editable ? (
            <Button onClick={() => openEditor(null)}>
              <Plus aria-hidden />
              Tambah
            </Button>
          ) : undefined
        }
      />
      {!editable && (
        <Alert className="mb-5" role="note">
          <Lock aria-hidden />
          <AlertDescription>Hanya Owner, Admin, dan Marketing yang dapat mengubah katalog.</AlertDescription>
        </Alert>
      )}
      <QueryBoundary query={offerings}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              icon={BriefcaseBusiness}
              title="Katalog masih kosong"
              description="Tambahkan produk atau layanan yang ingin dipromosikan, lengkap dengan masalah yang diselesaikan."
              className="bg-white"
              action={editable ? <Button onClick={() => openEditor(null)}>Tambah produk/layanan</Button> : undefined}
            />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {list.map((o) => (
                <li key={o.id}>
                  <Card className={o.isActive ? "h-full" : "h-full opacity-70"}>
                    <CardHeader>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle>{o.name}</CardTitle>
                        <Badge variant="secondary">{OFFERING_TYPE_LABELS[o.type]}</Badge>
                        {!o.isActive && <Badge variant="outline">Nonaktif</Badge>}
                      </div>
                      {o.category && <CardDescription>{o.category}</CardDescription>}
                    </CardHeader>
                    <CardContent className="grid gap-3 text-sm">
                      {o.description && <p>{o.description}</p>}
                      {o.problemsSolved.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Masalah yang diselesaikan</p>
                          <ul className="mt-1 list-disc pl-5">
                            {o.problemsSolved.map((p) => (
                              <li key={p}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {o.keywords.length > 0 && (
                        <ul className="flex flex-wrap gap-1.5" aria-label="Keyword">
                          {o.keywords.map((k) => (
                            <li key={k} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                              {k}
                            </li>
                          ))}
                        </ul>
                      )}
                      {o.priceRange && <p className="text-xs text-muted-foreground">Harga: {o.priceRange}</p>}
                      {editable && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button variant="outline" size="sm" onClick={() => openEditor(o)}>
                            <Pencil aria-hidden />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={save.isPending}
                            onClick={() => {
                              const { id, ...value } = o;
                              save.mutate({ id, value: { ...value, isActive: !o.isActive } });
                            }}
                          >
                            {o.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleting(o)} aria-label={`Hapus ${o.name}`}>
                            <Trash2 aria-hidden />
                            Hapus
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )
        }
      </QueryBoundary>
      {editable && <OfferingDialog offering={editing} open={dialogOpen} onOpenChange={setDialogOpen} />}
      {deleting && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDeleting(null)}
          title={`Hapus ${deleting.name}?`}
          description="Produk/layanan ini tidak lagi dipakai untuk pencocokan. Keyword yang ditautkan tetap ada."
          confirmLabel="Hapus"
          destructive
          pending={remove.isPending}
          onConfirm={() => remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        />
      )}
    </>
  );
}
