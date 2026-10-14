import { FolderPlus, Plus, Tags, Trash2, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { keywordGroupSchema, keywordSchema } from "@shared/schemas/catalog";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { QueryBoundary } from "@/components/layout/QueryBoundary";
import { EmptyState } from "@/components/layout/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useDeleteKeyword,
  useDeleteKeywordGroup,
  useKeywordGroups,
  useKeywords,
  useOfferings,
  useSaveKeyword,
  useSaveKeywordGroup,
} from "@/hooks/useData";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import type { WithId } from "@/services/data/types";
import type { Keyword, KeywordGroup } from "@shared/schemas/catalog";

const NONE = "__none__";

function OfferingSelect({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  label: string;
}) {
  const offerings = useOfferings();
  const items = [{ value: NONE, label: "Tanpa produk/layanan" }, ...(offerings.data ?? []).map((o) => ({ value: o.id, label: o.name }))];
  return (
    <Select items={items} value={value ?? NONE} onValueChange={(v) => onChange(!v || v === NONE ? null : String(v))} disabled={disabled}>
      <SelectTrigger className="w-full sm:w-56" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function KeywordChip({ keyword, editable }: { keyword: WithId<Keyword>; editable: boolean }) {
  const save = useSaveKeyword();
  const remove = useDeleteKeyword();
  const { id, ...value } = keyword;
  return (
    <li
      className={cn(
        "inline-flex items-center gap-1 rounded-full border py-1 pr-1 pl-3 text-sm",
        keyword.isActive ? "border-primary/30 bg-secondary text-foreground" : "border-dashed bg-white text-muted-foreground line-through",
      )}
    >
      {editable ? (
        <button
          type="button"
          aria-pressed={keyword.isActive}
          title={keyword.isActive ? "Klik untuk menonaktifkan" : "Klik untuk mengaktifkan"}
          onClick={() => save.mutate({ id, value: { ...value, isActive: !keyword.isActive } })}
          disabled={save.isPending}
        >
          {keyword.term}
          <span className="sr-only">{keyword.isActive ? " (aktif)" : " (nonaktif)"}</span>
        </button>
      ) : (
        <span>
          {keyword.term}
          <span className="sr-only">{keyword.isActive ? " (aktif)" : " (nonaktif)"}</span>
        </span>
      )}
      {editable && (
        <button
          type="button"
          className="rounded-full p-1 text-muted-foreground hover:bg-white hover:text-destructive"
          aria-label={`Hapus keyword ${keyword.term}`}
          onClick={() => remove.mutate(id)}
          disabled={remove.isPending}
        >
          <X className="size-3.5" />
        </button>
      )}
      {!editable && <span className="w-2" />}
    </li>
  );
}

function AddKeyword({ groupId, offeringId }: { groupId: string | null; offeringId: string | null }) {
  const save = useSaveKeyword();
  const [term, setTerm] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = keywordSchema.safeParse({ term, groupId, offeringId });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Keyword tidak valid");
    setError(null);
    save.mutate({ id: null, value: parsed.data }, { onSuccess: () => setTerm("") });
  }

  const inputId = `add-keyword-${groupId ?? "none"}`;
  return (
    <form onSubmit={submit} className="mt-3 grid gap-1">
      <div className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          Keyword baru
        </label>
        <Input id={inputId} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="mis. butuh jasa SEO" maxLength={100} />
        <Button type="submit" variant="outline" disabled={save.isPending || !term.trim()}>
          <Plus aria-hidden />
          Tambah
        </Button>
      </div>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function GroupCard({
  group,
  keywords,
  editable,
}: {
  group: WithId<KeywordGroup> | null;
  keywords: WithId<Keyword>[];
  editable: boolean;
}) {
  const saveGroup = useSaveKeywordGroup();
  const deleteGroup = useDeleteKeywordGroup();
  const [confirm, setConfirm] = useState(false);
  const active = keywords.filter((k) => k.isActive).length;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>{group ? group.name : "Tanpa grup"}</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {active} aktif dari {keywords.length} keyword
          </p>
        </div>
        {group && (
          <div className="flex items-center gap-2">
            <OfferingSelect
              label={`Produk/layanan untuk grup ${group.name}`}
              value={group.offeringId}
              disabled={!editable || saveGroup.isPending}
              onChange={(offeringId) => saveGroup.mutate({ id: group.id, value: { name: group.name, offeringId } })}
            />
            {editable && (
              <Button variant="ghost" size="icon" aria-label={`Hapus grup ${group.name}`} onClick={() => setConfirm(true)}>
                <Trash2 />
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {keywords.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada keyword di grup ini.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {keywords.map((k) => (
              <KeywordChip key={k.id} keyword={k} editable={editable} />
            ))}
          </ul>
        )}
        {editable && <AddKeyword groupId={group?.id ?? null} offeringId={group?.offeringId ?? null} />}
      </CardContent>
      {group && (
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title={`Hapus grup ${group.name}?`}
          description="Keyword di dalamnya tidak dihapus; keyword pindah ke “Tanpa grup”."
          confirmLabel="Hapus grup"
          destructive
          pending={deleteGroup.isPending}
          onConfirm={() => deleteGroup.mutate(group.id, { onSuccess: () => setConfirm(false) })}
        />
      )}
    </Card>
  );
}

function AddGroup() {
  const save = useSaveKeywordGroup();
  const [name, setName] = useState("");
  const [offeringId, setOfferingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = keywordGroupSchema.safeParse({ name, offeringId });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Nama grup tidak valid");
    setError(null);
    save.mutate(
      { id: null, value: parsed.data },
      {
        onSuccess: () => {
          setName("");
          setOfferingId(null);
        },
      },
    );
  }

  return (
    <Card className="border-dashed">
      <CardContent>
        <form onSubmit={submit} className="grid gap-2 sm:flex sm:items-start">
          <div className="grid flex-1 gap-1">
            <label htmlFor="new-group" className="sr-only">
              Nama grup baru
            </label>
            <Input id="new-group" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama grup baru, mis. Website" maxLength={60} />
            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
          <OfferingSelect label="Produk/layanan untuk grup baru" value={offeringId} onChange={setOfferingId} />
          <Button type="submit" disabled={save.isPending || !name.trim()}>
            <FolderPlus aria-hidden />
            Buat grup
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function KeywordManager() {
  const { can } = useWorkspace();
  const editable = can("catalog.manage");
  const groups = useKeywordGroups();
  const keywords = useKeywords();

  return (
    <QueryBoundary query={groups}>
      {(groupList) => (
        <QueryBoundary query={keywords}>
          {(keywordList) => {
            const ungrouped = keywordList.filter((k) => !k.groupId || !groupList.some((g) => g.id === k.groupId));
            return (
              <div className="grid gap-4">
                <p className="text-sm text-muted-foreground">
                  Keyword aktif akan dipantau di Threads mulai Fase 4. Klik keyword untuk mengaktifkan/menonaktifkan.
                  {!editable && " Hanya Owner, Admin, dan Marketing yang dapat mengubah keyword."}
                </p>
                {groupList.length === 0 && keywordList.length === 0 && (
                  <EmptyState
                    icon={Tags}
                    title="Belum ada keyword"
                    description="Buat grup (mis. “SEO”), tautkan ke layanan, lalu tambahkan frasa yang biasa ditulis calon pelanggan."
                    className="bg-white"
                  />
                )}
                {groupList.map((g) => (
                  <GroupCard key={g.id} group={g} keywords={keywordList.filter((k) => k.groupId === g.id)} editable={editable} />
                ))}
                {(ungrouped.length > 0 || (editable && groupList.length === 0)) && (
                  <GroupCard group={null} keywords={ungrouped} editable={editable} />
                )}
                {editable && <AddGroup />}
              </div>
            );
          }}
        </QueryBoundary>
      )}
    </QueryBoundary>
  );
}
