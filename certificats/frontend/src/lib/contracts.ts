import deployments from "@/contracts/deployments.json";
import { nftAbi, registryAbi } from "@/contracts/abis";

export type ContractVersion = "v1" | "v2";

export type DeploymentEntry = {
  chainId: number;
  network: string;
  deployer: string;
  deployedAt: string;
  registry: { address: `0x${string}`; blockNumber: number };
  nft: { address: `0x${string}`; blockNumber: number };
};

export const VERSION_META: Record<
  ContractVersion,
  { label: string; short: string; contract: string; description: string }
> = {
  v1: {
    label: "v1 · Registre",
    short: "v1",
    contract: "CertificateRegistry",
    description: "Registre custom, métadonnées en struct, contrôle owner + admins.",
  },
  v2: {
    label: "v2 · ERC-721",
    short: "v2",
    contract: "CertificateNFT",
    description: "NFT ERC-721, tokenURI on-chain, AccessControl et soulbound.",
  },
};

export function getAbi(version: ContractVersion) {
  return version === "v1" ? registryAbi : nftAbi;
}

export function getBaseDeployment(chainId: number): DeploymentEntry | undefined {
  return (deployments as Record<string, DeploymentEntry>)[String(chainId)];
}

export function getDeploymentAddress(
  version: ContractVersion,
  deployment: DeploymentEntry | undefined,
): `0x${string}` | undefined {
  if (!deployment) return undefined;
  return version === "v1" ? deployment.registry.address : deployment.nft.address;
}

export function getDeploymentBlock(
  version: ContractVersion,
  deployment: DeploymentEntry | undefined,
): number {
  if (!deployment) return 0;
  return version === "v1" ? deployment.registry.blockNumber : deployment.nft.blockNumber;
}
