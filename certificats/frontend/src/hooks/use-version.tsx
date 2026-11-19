import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { ContractVersion } from "@/lib/contracts";
import { useLocalStorage } from "@/hooks/use-local-storage";

type VersionContextValue = {
  version: ContractVersion;
  setVersion: (version: ContractVersion) => void;
};

const VersionContext = createContext<VersionContextValue | null>(null);

export function VersionProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useLocalStorage<ContractVersion>("certify:version", "v2");

  const value = useMemo(() => ({ version, setVersion }), [version, setVersion]);

  return <VersionContext.Provider value={value}>{children}</VersionContext.Provider>;
}

export function useVersion(): VersionContextValue {
  const context = useContext(VersionContext);
  if (!context) throw new Error("useVersion doit être utilisé dans VersionProvider");
  return context;
}
