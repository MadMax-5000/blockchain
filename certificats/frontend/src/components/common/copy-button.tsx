import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/format";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label = "Copier",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopied(true);
      toast.success("Copié dans le presse-papiers");
      window.setTimeout(() => setCopied(false), 1600);
    } else {
      toast.error("Impossible de copier dans le presse-papiers");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1 rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
        className,
      )}
      title={label}
      aria-label={label}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
