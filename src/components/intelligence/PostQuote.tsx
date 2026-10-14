import { ExternalLink } from "lucide-react";
import type { DiscoveredPost, Platform } from "@shared/types/intelligence";
import { cn } from "@/lib/utils";
import { formatRelativeDay } from "@/utils/format";

const PLATFORM_LABELS: Record<Platform, string> = { threads: "Threads", manual: "Analisis manual" };

/** Kutipan post sosial asli, dengan tautan hanya jika post punya permalink nyata. */
export function PostQuote({ post, className, clamp }: { post: DiscoveredPost; className?: string; clamp?: boolean }) {
  return (
    <figure className={cn("grid gap-1.5", className)}>
      <figcaption className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{post.authorName}</span>
        {post.authorHandle && post.authorHandle !== post.authorName && <span>{post.authorHandle}</span>}
        <span aria-hidden>·</span>
        <span>{PLATFORM_LABELS[post.platform]}</span>
        <span aria-hidden>·</span>
        <time dateTime={post.postedAt}>{formatRelativeDay(post.postedAt)}</time>
        {post.permalink && (
          <a href={post.permalink} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
            Buka post <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </figcaption>
      <blockquote className={cn("text-sm leading-relaxed text-foreground", clamp && "line-clamp-3")}>“{post.text}”</blockquote>
    </figure>
  );
}
