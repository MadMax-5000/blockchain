import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/lib/chains";
import { useLocalStorage } from "@/hooks/use-local-storage";

type NetworkContextValue = {
  chainId: SupportedChainId;
  setChainId: (chainId: SupportedChainId) => void;
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [chainId, setChainId] = useLocalStorage<SupportedChainId>("certify:chain", DEFAULT_CHAIN_ID);

  const value = useMemo(() => ({ chainId, setChainId }), [chainId, setChainId]);

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork(): NetworkContextValue {
  const context = useContext(NetworkContext);
  if (!context) throw new Error("useNetwork doit être utilisé dans NetworkProvider");
  return context;
}
