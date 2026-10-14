import { cn } from "@/lib/utils";

export function WorkspaceAvatar({ name, logoUrl, className }: { name: string; logoUrl: string | null; className?: string }) {
  if (logoUrl) {
    return <img src={logoUrl} alt="" className={cn("size-8 shrink-0 rounded-lg border object-cover", className)} />;
  }
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-bold text-primary",
        className,
      )}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || "W"}
    </span>
  );
}
