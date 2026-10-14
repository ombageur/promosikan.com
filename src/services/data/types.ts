import type { AutomationSettings } from "@shared/schemas/automation";
import type { Keyword, KeywordGroup, Offering } from "@shared/schemas/catalog";
import type { DailyStats, Lead, LeadStatus, Opportunity, OpportunityStatus, ReplyDraft, ReplyDraftStatus } from "@shared/types/intelligence";

export type WithId<T> = T & { id: string };

/** Data konfigurasi yang dikelola pengguna. Nyata di Firestore sejak Fase 2. */
export interface CatalogSource {
  listOfferings(): Promise<WithId<Offering>[]>;
  saveOffering(id: string | null, data: Offering): Promise<string>;
  deleteOffering(id: string): Promise<void>;

  listKeywordGroups(): Promise<WithId<KeywordGroup>[]>;
  saveKeywordGroup(id: string | null, data: KeywordGroup): Promise<string>;
  /** Keyword di dalam grup tidak ikut terhapus; grupnya dikosongkan. */
  deleteKeywordGroup(id: string): Promise<void>;

  listKeywords(): Promise<WithId<Keyword>[]>;
  saveKeyword(id: string | null, data: Keyword): Promise<string>;
  deleteKeyword(id: string): Promise<void>;

  getAutomationSettings(): Promise<AutomationSettings>;
  saveAutomationSettings(data: AutomationSettings): Promise<void>;
}

/** Fitur intelijen yang sudah tersedia untuk sumber data ini (bertambah per fase). */
export type IntelligenceCapabilities = {
  /** Peluang hasil analisis (Fase 3: Analisis Manual; Fase 4: monitoring). */
  opportunities: boolean;
  drafts: boolean;
  /** Lead CRM (Fase 5). */
  leads: boolean;
  /** Statistik agregat (Fase 6). */
  stats: boolean;
  /** Panggilan AI nyata (Claude). Selalu false untuk data demo. */
  ai: boolean;
};

/** Hasil discovery & AI: Firestore untuk workspace nyata, fixtures di memori untuk demo. */
export interface IntelligenceSource {
  capabilities: IntelligenceCapabilities;
  listOpportunities(): Promise<Opportunity[]>;
  setOpportunityStatus(id: string, status: OpportunityStatus): Promise<void>;
  listReplyDrafts(): Promise<ReplyDraft[]>;
  updateReplyDraft(id: string, patch: { text?: string; status?: ReplyDraftStatus }): Promise<void>;
  listLeads(): Promise<Lead[]>;
  updateLead(id: string, patch: { status?: LeadStatus }): Promise<void>;
  listDailyStats(): Promise<DailyStats[]>;
}

export type DataSource = {
  /** Bagian dari query key TanStack Query; unik per workspace/mode. */
  key: string;
  catalog: CatalogSource;
  intelligence: IntelligenceSource;
};
