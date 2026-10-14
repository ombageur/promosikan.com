import { Radar } from "lucide-react";
import { Link } from "react-router";
import { IntentBadge, RedFlagBadge, ScoreBadge } from "@/components/intelligence/badges";
import { PostQuote } from "@/components/intelligence/PostQuote";
import { QueryBoundary } from "@/components/layout/QueryBoundary";
import { EmptyState, PageHeader } from "@/components/layout/states";
import { TabList } from "@/components/layout/Tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useCapabilities, useOpportunities } from "@/hooks/useData";
import { useTab } from "@/hooks/useTab";
import { useWorkspace } from "@/hooks/useWorkspace";
import { KeywordManager } from "./KeywordManager";
import { ManualAnalysis } from "./ManualAnalysis";

const TABS = ["feed", "manual", "keywords"] as const;

function Feed() {
  const { basePath } = useWorkspace();
  const caps = useCapabilities();
  const opportunities = useOpportunities();
  return (
    <QueryBoundary query={opportunities}>
      {(opps) =>
        opps.length === 0 ? (
          <EmptyState
            icon={Radar}
            title="Belum ada percakapan"
            description="Monitoring Threads otomatis aktif setelah akun terhubung (Fase 4). Sekarang Anda bisa menempelkan post lewat Analisis Manual."
            className="bg-white"
            action={
              caps.ai ? (
                <Link to={`${basePath}/discover?tab=manual`} className="text-sm font-semibold text-primary hover:underline">
                  Buka Analisis Manual
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid gap-3">
            {[...opps]
              .sort((a, b) => b.post.postedAt.localeCompare(a.post.postedAt))
              .map((o) => (
                <li key={o.id}>
                  <Card>
                    <CardContent className="grid gap-3">
                      <PostQuote post={o.post} />
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {o.post.matchedKeyword ? (
                          <span>
                            Keyword: <strong className="font-medium text-foreground">{o.post.matchedKeyword}</strong>
                          </span>
                        ) : (
                          <span>Analisis manual</span>
                        )}
                        <IntentBadge intent={o.intent} />
                        <ScoreBadge score={o.score} />
                        <RedFlagBadge flags={o.redFlags} />
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
          </ul>
        )
      }
    </QueryBoundary>
  );
}

export function DiscoverPage() {
  const caps = useCapabilities();
  const [tab, setTab] = useTab(TABS, "feed");

  return (
    <>
      <PageHeader title="Discover" description="Percakapan yang ditemukan, analisis manual, dan pengelolaan keyword yang dipantau." />
      <TabList
        label="Bagian Discover"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "feed", label: "Percakapan" },
          ...(caps.ai ? [{ value: "manual" as const, label: "Analisis Manual" }] : []),
          { value: "keywords", label: "Keyword" },
        ]}
      />
      <div role="tabpanel">{tab === "feed" ? <Feed /> : tab === "manual" ? <ManualAnalysis /> : <KeywordManager />}</div>
    </>
  );
}
