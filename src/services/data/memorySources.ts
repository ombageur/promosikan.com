import {
  buildDemoIntelligence,
  DEMO_AUTOMATION,
  DEMO_KEYWORD_GROUPS,
  DEMO_OFFERINGS,
} from "@shared/demo/publishAgency";
import type { AutomationSettings } from "@shared/schemas/automation";
import type { Keyword, KeywordGroup, Offering } from "@shared/schemas/catalog";
import type { CatalogSource, IntelligenceSource, WithId } from "./types";

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`);

class Table<T> {
  private rows = new Map<string, T>();
  constructor(seed: WithId<T>[] = []) {
    for (const { id, ...row } of seed) this.rows.set(id, row as T);
  }
  list(sortBy: (row: T) => string): WithId<T>[] {
    return [...this.rows.entries()]
      .map(([id, row]) => ({ id, ...row }))
      .sort((a, b) => sortBy(a).localeCompare(sortBy(b), "id"));
  }
  save(id: string | null, row: T): string {
    const key = id ?? newId();
    this.rows.set(key, structuredClone(row));
    return key;
  }
  update(id: string, patch: Partial<T>) {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, ...patch });
  }
  delete(id: string) {
    this.rows.delete(id);
  }
}

/**
 * Katalog demo di memori untuk /demo (tanpa login). Perubahan hanya berlaku di tab ini
 * dan hilang saat halaman dimuat ulang — tidak ada yang dikirim ke server.
 */
export function memoryCatalog(): CatalogSource {
  const offerings = new Table<Offering>(DEMO_OFFERINGS);
  const groups = new Table<KeywordGroup>(DEMO_KEYWORD_GROUPS.map(({ terms: _terms, ...g }) => g));
  const keywords = new Table<Keyword>(
    DEMO_KEYWORD_GROUPS.flatMap((g) =>
      g.terms.map((term, i) => ({ id: `${g.id}-${i}`, term, groupId: g.id, offeringId: g.offeringId, isActive: true })),
    ),
  );
  let automation: AutomationSettings = { ...DEMO_AUTOMATION };

  return {
    listOfferings: async () => offerings.list((o) => o.name),
    saveOffering: async (id, data) => offerings.save(id, data),
    deleteOffering: async (id) => offerings.delete(id),
    listKeywordGroups: async () => groups.list((g) => g.name),
    saveKeywordGroup: async (id, data) => groups.save(id, data),
    deleteKeywordGroup: async (id) => {
      for (const k of keywords.list((k) => k.term)) if (k.groupId === id) keywords.update(k.id, { groupId: null });
      groups.delete(id);
    },
    listKeywords: async () => keywords.list((k) => k.term),
    saveKeyword: async (id, data) => keywords.save(id, data),
    deleteKeyword: async (id) => keywords.delete(id),
    getAutomationSettings: async () => automation,
    saveAutomationSettings: async (data) => {
      automation = { ...data };
    },
  };
}

/** Data peluang/lead demo di memori (SPEC §21). Selalu diberi label "Data Demo" oleh UI. */
export function demoIntelligence(now = Date.now()): IntelligenceSource {
  const data = buildDemoIntelligence(now);
  return {
    // Data demo tidak pernah memanggil AI sungguhan.
    capabilities: { opportunities: true, drafts: true, leads: true, stats: true, ai: false },
    listOpportunities: async () => data.opportunities,
    setOpportunityStatus: async (id, status) => {
      data.opportunities = data.opportunities.map((o) => (o.id === id ? { ...o, status } : o));
    },
    listReplyDrafts: async () => data.replyDrafts,
    updateReplyDraft: async (id, patch) => {
      data.replyDrafts = data.replyDrafts.map((d) => (d.id === id ? { ...d, ...patch } : d));
    },
    listLeads: async () => data.leads,
    updateLead: async (id, patch) => {
      data.leads = data.leads.map((l) => (l.id === id ? { ...l, ...patch } : l));
    },
    listDailyStats: async () => data.dailyStats,
  };
}
