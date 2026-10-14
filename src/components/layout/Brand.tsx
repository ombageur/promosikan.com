import { Sparkles } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

export function Brand({ to = "/", className }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={cn("flex items-center gap-2", className)} aria-label="Promosikan.com">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Sparkles size={20} aria-hidden />
      </span>
      <span className="text-base font-extrabold tracking-tight text-foreground">
        promosikan<span className="text-primary">.com</span>
      </span>
    </Link>
  );
}
