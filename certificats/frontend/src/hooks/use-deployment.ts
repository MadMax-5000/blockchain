import { useMemo } from "react";
import {
  getBaseDeployment,
  getDeploymentAddress,
  getDeploymentBlock,
  type ContractVersion,
  type DeploymentEntry,
} from "@/lib/contracts";
import { useNetwork } from "@/hooks/use-network";
import { useLocalStorage } from "@/hooks/use-local-storage";

export type AddressOverride = { registry?: string; nft?: string };

export function useDeployment() {
  const { chainId } = useNetwork();
  const [overrides, setOverrides] = useLocalStorage<Record<string, AddressOverride>>(
    "certify:overrides",
    {},
  );

  const base: DeploymentEntry | undefined = useMemo(() => getBaseDeployment(chainId), [chainId]);
  const override = overrides[String(chainId)];

  const registry = (override?.registry as `0x${string}` | undefined) ?? base?.registry.address;
  const nft = (override?.nft as `0x${string}` | undefined) ?? base?.nft.address;

  const addressFor = (version: ContractVersion) => (version === "v1" ? registry : nft);
  const blockFor = (version: ContractVersion) => getDeploymentBlock(version, base);

  const setOverride = (next: AddressOverride) => {
    setOverrides({ ...overrides, [String(chainId)]: next });
  };

  return {
    chainId,
    base,
    registry,
    nft,
    addressFor,
    blockFor,
    hasDeployment: Boolean(registry || nft),
    override,
    setOverride,
    getAddress: (version: ContractVersion) => getDeploymentAddress(version, base),
  };
}

export function useContractAddress(version: ContractVersion) {
  const deployment = useDeployment();
  return {
    ...deployment,
    address: deployment.addressFor(version),
    fromBlock: deployment.blockFor(version),
  };
}
