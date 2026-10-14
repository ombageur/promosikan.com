import { Radar } from "lucide-react";
import { IntentBadge, ScoreBadge } from "@/components/intelligence/badges";
import { PostQuote } from "@/components/intelligence/PostQuote";
import { NotYetAvailable } from "@/components/intelligence/states";
import { QueryBoundary } from "@/components/layout/QueryBoundary";
import { PageHeader } from "@/components/layout/states";
import { TabList } from "@/components/layout/Tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useOpportunities } from "@/hooks/useData";
import { useTab } from "@/hooks/useTab";
import { useWorkspace } from "@/hooks/useWorkspace";
import { KeywordManager } from "./KeywordManager";

const TABS = ["feed", "keywords"] as const;

function Feed() {
  const { data } = useWorkspace();
  const opportunities = useOpportunities();
  if (!data.intelligence.available) {
    return (
      <NotYetAvailable
        icon={Radar}
        title="Belum ada percakapan yang ditemukan"
        description="Monitoring Threads berjalan setelah akun terhubung (Fase 4). Sementara itu, siapkan keyword yang ingin dipantau."
      />
    );
  }
  return (
    <QueryBoundary query={opportunities}>
      {(opps) => (
        <ul className="grid gap-3">
          {[...opps]
            .sort((a, b) => b.post.postedAt.localeCompare(a.post.postedAt))
            .map((o) => (
              <li key={o.id}>
                <Card>
                  <CardContent className="grid gap-3">
                    <PostQuote post={o.post} />
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        Keyword: <strong className="font-medium text-foreground">{o.post.matchedKeyword}</strong>
                      </span>
                      <IntentBadge intent={o.intent} />
                      <ScoreBadge score={o.score} />
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
        </ul>
      )}
    </QueryBoundary>
  );
}

export function DiscoverPage() {
  const { data } = useWorkspace();
  const [tab, setTab] = useTab(TABS, data.intelligence.available ? "feed" : "keywords");

  return (
    <>
      <PageHeader
        title="Discover"
        description="Percakapan publik yang cocok dengan keyword Anda, dan pengelolaan keyword yang dipantau."
      />
      <TabList
        label="Bagian Discover"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "feed", label: "Percakapan" },
          { value: "keywords", label: "Keyword" },
        ]}
      />
      <div role="tabpanel">{tab === "feed" ? <Feed /> : <KeywordManager />}</div>
    </>
  );
}
