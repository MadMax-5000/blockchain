import { Badge } from "@/components/ui/badge";
import { statusLabel, statusTone } from "@/lib/issues";
import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  muted: "border-border bg-secondary text-muted-foreground",
  info: "border-primary/40 bg-primary/10 text-primary",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  outline: "border-border bg-transparent text-foreground",
};

export function StatusBadge({ status, className }: { status: number; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("shrink-0 whitespace-nowrap rounded px-2 py-0.5 text-[13px]", TONES[statusTone(status)], className)}
    >
      {statusLabel(status)}
    </Badge>
  );
}
