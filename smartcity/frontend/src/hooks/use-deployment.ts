import { useMemo } from "react";
import { getBaseDeployment, type DeploymentEntry } from "@/lib/contracts";
import { useNetwork } from "@/hooks/use-network";
import { useLocalStorage } from "@/hooks/use-local-storage";

export type AddressOverride = { registry?: string };

export function useDeployment() {
  const { chainId } = useNetwork();
  const [overrides, setOverrides] = useLocalStorage<Record<string, AddressOverride>>(
    "citytrace:addresses",
    {},
  );

  const base: DeploymentEntry | undefined = useMemo(() => getBaseDeployment(chainId), [chainId]);
  const override = overrides[String(chainId)];
  const address = (override?.registry as `0x${string}` | undefined) ?? base?.registry.address;

  const setOverride = (next: AddressOverride) => {
    setOverrides({ ...overrides, [String(chainId)]: next });
  };

  return {
    chainId,
    base,
    address,
    fromBlock: base?.registry.blockNumber ?? 0,
    hasDeployment: Boolean(address),
    override,
    setOverride,
  };
}
