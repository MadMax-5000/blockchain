import { useAccount, useConnect, useDisconnect } from "wagmi";
import { ChevronDown, LogOut, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CopyButton } from "@/components/common/copy-button";
import { getErrorMessage } from "@/lib/errors";
import { getChainMeta } from "@/lib/chains";
import { shortenAddress } from "@/lib/format";

export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (!isConnected || !address) {
    return (
      <Button
        size="sm"
        disabled={isPending}
        onClick={() => {
          const connector = connectors[0];
          if (!connector) {
            toast.error("Aucun wallet détecté. Installez MetaMask.");
            return;
          }
          connect(
            { connector },
            {
              onError: (error) => toast.error(getErrorMessage(error)),
            },
          );
        }}
      >
        <Wallet className="h-4 w-4" />
        {isPending ? "Connexion…" : "Connecter"}
      </Button>
    );
  }

  const chain = chainId ? getChainMeta(chainId) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-2 font-mono text-[12px]">
          <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
          {shortenAddress(address)}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Compte connecté</DropdownMenuLabel>
        <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-2">
          <div className="min-w-0">
            <p className="truncate font-mono text-[12px]">{address}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{chain?.name ?? "Réseau inconnu"}</p>
          </div>
          <CopyButton value={address} label="Copier l'adresse" />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            disconnect();
            toast.success("Wallet déconnecté");
          }}
        >
          <LogOut />
          Déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
