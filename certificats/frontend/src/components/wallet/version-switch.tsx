import { VERSION_META, type ContractVersion } from "@/lib/contracts";
import { useVersion } from "@/hooks/use-version";
import { cn } from "@/lib/utils";

export function VersionSwitch({ className }: { className?: string }) {
  const { version, setVersion } = useVersion();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border/70 bg-card/60 p-0.5",
        className,
      )}
      role="group"
      aria-label="Version du contrat"
    >
      {(["v1", "v2"] as ContractVersion[]).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setVersion(item)}
          className={cn(
            "flex-1 rounded-md px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors",
            version === item
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          title={VERSION_META[item].description}
        >
          {item === "v1" ? "v1 registre" : "v2 erc-721"}
        </button>
      ))}
    </div>
  );
}
