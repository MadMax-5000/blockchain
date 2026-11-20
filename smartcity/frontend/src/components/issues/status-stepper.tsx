import { STATUS_LABELS } from "@/lib/issues";
import { cn } from "@/lib/utils";

export function StatusStepper({ current }: { current: number }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-5">
      {STATUS_LABELS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={label}
            className={cn(
              "relative rounded px-3 py-2.5 text-[13px]",
              active
                ? "bg-primary/10 text-primary before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-primary"
                : done
                  ? "bg-secondary text-foreground"
                  : "bg-secondary/40 text-muted-foreground",
            )}
            aria-current={active ? "step" : undefined}
          >
            <span className="font-mono text-[11px] text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="mt-1 block">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
