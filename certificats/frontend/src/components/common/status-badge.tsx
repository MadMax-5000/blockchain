import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatusBadge({ revoked, className }: { revoked: boolean; className?: string }) {
  if (revoked) {
    return (
      <Badge variant="destructive" className={cn("gap-1.5", className)}>
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        Révoqué
      </Badge>
    );
  }
  return (
    <Badge variant="default" className={cn("gap-1.5", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      Valide
    </Badge>
  );
}
