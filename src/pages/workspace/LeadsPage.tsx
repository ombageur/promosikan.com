import { Search, Users } from "lucide-react";
import { useState } from "react";
import { type Lead, LEAD_STATUS_LABELS, LEAD_STATUSES, type LeadStatus } from "@shared/types/intelligence";
import { ScoreBadge } from "@/components/intelligence/badges";
import { NotYetAvailable } from "@/components/intelligence/states";
import { QueryBoundary } from "@/components/layout/QueryBoundary";
import { PageHeader } from "@/components/layout/states";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeads, useUpdateLead } from "@/hooks/useData";
import { useWorkspace } from "@/hooks/useWorkspace";
import { formatRelativeDay, formatRupiah } from "@/utils/format";

const STATUS_ITEMS = LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }));

function LeadCard({ lead, editable }: { lead: Lead; editable: boolean }) {
  const update = useUpdateLead();
  return (
    <article className="grid gap-2 rounded-lg border bg-white p-3 text-sm shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{lead.name}</h3>
          <p className="truncate text-xs text-muted-foreground">{lead.handle}</p>
        </div>
        <ScoreBadge score={lead.score} showLabel={false} />
      </div>
      {lead.offeringName && <p className="text-xs">{lead.offeringName}</p>}
      {lead.note && <p className="text-xs text-muted-foreground">{lead.note}</p>}
      <p className="text-xs text-muted-foreground">
        {lead.assigneeName ?? "Belum di-assign"} · {formatRelativeDay(lead.lastActivityAt)}
        {lead.dealValue !== null && <> · {formatRupiah(lead.dealValue)}</>}
      </p>
      {editable && (
        <Select
          items={STATUS_ITEMS}
          value={lead.status}
          onValueChange={(v) => v && update.mutate({ id: lead.id, status: v as LeadStatus })}
          disabled={update.isPending}
        >
          <SelectTrigger size="sm" className="w-full" aria-label={`Status ${lead.name}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_ITEMS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </article>
  );
}

export function LeadsPage() {
  const { data, can } = useWorkspace();
  const leads = useLeads();
  const [q, setQ] = useState("");
  const editable = can("leads.manage");

  return (
    <>
      <PageHeader title="Leads CRM" description="Pipeline calon pelanggan dari percakapan sampai konversi." />
      {!data.intelligence.capabilities.leads ? (
        <NotYetAvailable icon={Users} title="Belum ada lead" description="Lead dibuat dari peluang yang dibalas atau ditandai manual (Fase 5)." />
      ) : (
        <>
          <div className="relative mb-4 sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, handle, atau layanan" className="pl-8" aria-label="Cari lead" />
          </div>
          <QueryBoundary query={leads}>
            {(list) => {
              const term = q.trim().toLowerCase();
              const visible = list.filter((l) => !term || `${l.name} ${l.handle} ${l.offeringName ?? ""}`.toLowerCase().includes(term));
              return (
                // Kanban: gulir horizontal di layar kecil, setiap kolom satu status.
                <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6" role="region" aria-label="Pipeline lead" tabIndex={0}>
                  <div className="flex gap-3">
                    {LEAD_STATUSES.map((status) => {
                      const column = visible.filter((l) => l.status === status);
                      return (
                        <section key={status} aria-label={LEAD_STATUS_LABELS[status]} className="w-64 shrink-0 rounded-xl bg-slate-100/70 p-2">
                          <h2 className="mb-2 flex items-center justify-between px-1 text-xs font-semibold text-slate-700">
                            {LEAD_STATUS_LABELS[status]}
                            <span className="tabular-nums text-muted-foreground">{column.length}</span>
                          </h2>
                          <div className="grid gap-2">
                            {column.map((lead) => (
                              <LeadCard key={lead.id} lead={lead} editable={editable} />
                            ))}
                            {column.length === 0 && <p className="px-1 py-3 text-center text-xs text-muted-foreground">Kosong</p>}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </div>
              );
            }}
          </QueryBoundary>
        </>
      )}
    </>
  );
}
