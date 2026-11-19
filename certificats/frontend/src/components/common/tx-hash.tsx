import { ExternalLink } from "lucide-react";
import { CopyButton } from "@/components/common/copy-button";
import { explorerTxUrl } from "@/lib/chains";
import { shortenHash } from "@/lib/format";
import { useNetwork } from "@/hooks/use-network";

export function TxHash({ hash }: { hash: string }) {
  const { chainId } = useNetwork();
  const url = explorerTxUrl(chainId, hash);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-background/50 px-2 py-1 font-mono text-[11.5px]">
      <span className="text-muted-foreground">tx</span>
      <span title={hash}>{shortenHash(hash)}</span>
      <CopyButton value={hash} label="Copier le hash de transaction" />
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          title="Voir sur l'explorateur"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </span>
  );
}
