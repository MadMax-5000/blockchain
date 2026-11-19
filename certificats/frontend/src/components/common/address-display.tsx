import { ExternalLink } from "lucide-react";
import { CopyButton } from "@/components/common/copy-button";
import { explorerAddressUrl } from "@/lib/chains";
import { shortenAddress } from "@/lib/format";
import { useNetwork } from "@/hooks/use-network";

export function AddressDisplay({
  address,
  chars = 4,
  withCopy = true,
  withExplorer = true,
}: {
  address: string;
  chars?: number;
  withCopy?: boolean;
  withExplorer?: boolean;
}) {
  const { chainId } = useNetwork();
  const explorer = explorerAddressUrl(chainId, address);

  return (
    <span className="inline-flex items-center gap-1 font-mono text-[12.5px] text-foreground/90">
      <span title={address}>{shortenAddress(address, chars)}</span>
      {withCopy ? <CopyButton value={address} label="Copier l'adresse" /> : null}
      {withExplorer && explorer ? (
        <a
          href={explorer}
          target="_blank"
          rel="noreferrer"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          title="Voir sur l'explorateur"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </span>
  );
}
