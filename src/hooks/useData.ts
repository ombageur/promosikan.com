import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AutomationSettings } from "@shared/schemas/automation";
import type { Keyword, KeywordGroup, Offering } from "@shared/schemas/catalog";
import type { LeadStatus, ReplyDraftStatus } from "@shared/types/intelligence";
import { errorMessage } from "@/lib/firebase/callable";
import { useWorkspace } from "./useWorkspace";

/** Query key per sumber data, agar cache workspace/demo tidak tercampur. */
function useKey() {
  const { data } = useWorkspace();
  return (name: string) => [data.key, name] as const;
}

function useInvalidate() {
  const queryClient = useQueryClient();
  const key = useKey();
  return (...names: string[]) => Promise.all(names.map((n) => queryClient.invalidateQueries({ queryKey: key(n) })));
}

/** Mutasi standar: toast sukses/gagal + invalidasi query terkait. */
function useAction<I>(fn: (input: I) => Promise<unknown>, invalidates: string[], success?: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await invalidate(...invalidates);
      if (success) toast.success(success);
    },
    onError: (error) => toast.error(error instanceof Error && !("code" in error) ? error.message : errorMessage(error)),
  });
}

// ---------- Katalog ----------
export function useOfferings() {
  const { data } = useWorkspace();
  return useQuery({ queryKey: useKey()("offerings"), queryFn: () => data.catalog.listOfferings() });
}

export function useSaveOffering() {
  const { data } = useWorkspace();
  return useAction(
    ({ id, value }: { id: string | null; value: Offering }) => data.catalog.saveOffering(id, value),
    ["offerings"],
    "Produk/layanan disimpan.",
  );
}

export function useDeleteOffering() {
  const { data } = useWorkspace();
  return useAction((id: string) => data.catalog.deleteOffering(id), ["offerings"], "Produk/layanan dihapus.");
}

export function useKeywordGroups() {
  const { data } = useWorkspace();
  return useQuery({ queryKey: useKey()("keywordGroups"), queryFn: () => data.catalog.listKeywordGroups() });
}

export function useSaveKeywordGroup() {
  const { data } = useWorkspace();
  return useAction(
    ({ id, value }: { id: string | null; value: KeywordGroup }) => data.catalog.saveKeywordGroup(id, value),
    ["keywordGroups"],
  );
}

export function useDeleteKeywordGroup() {
  const { data } = useWorkspace();
  return useAction((id: string) => data.catalog.deleteKeywordGroup(id), ["keywordGroups", "keywords"], "Grup dihapus.");
}

export function useKeywords() {
  const { data } = useWorkspace();
  return useQuery({ queryKey: useKey()("keywords"), queryFn: () => data.catalog.listKeywords() });
}

export function useSaveKeyword() {
  const { data } = useWorkspace();
  return useAction(({ id, value }: { id: string | null; value: Keyword }) => data.catalog.saveKeyword(id, value), ["keywords"]);
}

export function useDeleteKeyword() {
  const { data } = useWorkspace();
  return useAction((id: string) => data.catalog.deleteKeyword(id), ["keywords"], "Keyword dihapus.");
}

export function useAutomationSettings() {
  const { data } = useWorkspace();
  return useQuery({ queryKey: useKey()("automation"), queryFn: () => data.catalog.getAutomationSettings() });
}

export function useSaveAutomationSettings() {
  const { data } = useWorkspace();
  return useAction(
    (value: AutomationSettings) => data.catalog.saveAutomationSettings(value),
    ["automation"],
    "Pengaturan automation disimpan.",
  );
}

// ---------- Intelijen (demo di Fase 2) ----------
export function useOpportunities() {
  const { data } = useWorkspace();
  return useQuery({ queryKey: useKey()("opportunities"), queryFn: () => data.intelligence.listOpportunities() });
}

export function useReplyDrafts() {
  const { data } = useWorkspace();
  return useQuery({ queryKey: useKey()("replyDrafts"), queryFn: () => data.intelligence.listReplyDrafts() });
}

export function useUpdateReplyDraft() {
  const { data } = useWorkspace();
  return useAction(
    ({ id, ...patch }: { id: string; text?: string; status?: ReplyDraftStatus }) => data.intelligence.updateReplyDraft(id, patch),
    ["replyDrafts"],
  );
}

export function useLeads() {
  const { data } = useWorkspace();
  return useQuery({ queryKey: useKey()("leads"), queryFn: () => data.intelligence.listLeads() });
}

export function useUpdateLead() {
  const { data } = useWorkspace();
  return useAction(({ id, status }: { id: string; status: LeadStatus }) => data.intelligence.updateLead(id, { status }), ["leads"]);
}

export function useDailyStats() {
  const { data } = useWorkspace();
  return useQuery({ queryKey: useKey()("dailyStats"), queryFn: () => data.intelligence.listDailyStats() });
}
