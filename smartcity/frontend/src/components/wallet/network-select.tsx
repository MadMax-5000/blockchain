import { useAccount, useSwitchChain } from "wagmi";
import { Check, ChevronDown, Plus } from "lucide-react";
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
import { addLocalChainToWallet, getChainMeta, SUPPORTED_CHAINS } from "@/lib/chains";
import { getErrorMessage } from "@/lib/errors";
import { useNetwork } from "@/hooks/use-network";

export function NetworkSelect() {
  const { chainId, setChainId } = useNetwork();
  const { isConnected, chainId: walletChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const current = getChainMeta(chainId);

  const choose = async (nextChainId: (typeof SUPPORTED_CHAINS)[number]["id"]) => {
    setChainId(nextChainId);
    if (!isConnected || walletChainId === nextChainId) return;

    try {
      await switchChainAsync({ chainId: nextChainId });
    } catch (error) {
      if (nextChainId === 31337) {
        try {
          await addLocalChainToWallet();
          await switchChainAsync({ chainId: nextChainId });
          toast.success("Réseau Hardhat ajouté au wallet");
          return;
        } catch {
          // ignore, on affiche l'erreur initiale
        }
      }
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-[13px]">
          <span
            className={
              isConnected && walletChainId === chainId
                ? "h-1.5 w-1.5 rounded-full bg-primary"
                : "h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
            }
          />
          <span className="hidden sm:inline">{current.short}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Réseau</DropdownMenuLabel>
        {SUPPORTED_CHAINS.map((chain) => (
          <DropdownMenuItem key={chain.id} onSelect={() => void choose(chain.id)} className="justify-between">
            <span className="flex items-center gap-2">
              {chain.id === chainId ? (
                <Check className="h-3.5 w-3.5 text-primary" />
              ) : (
                <span className="h-3.5 w-3.5" />
              )}
              <span>{chain.name}</span>
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">{chain.id}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void addLocalChainToWallet()
              .then(() => toast.success("Hardhat local ajouté au wallet"))
              .catch((error) => toast.error(getErrorMessage(error)));
          }}
        >
          <Plus />
          Ajouter Hardhat à MetaMask
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
