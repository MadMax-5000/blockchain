import deployments from "@/contracts/deployments.json";
import { registryAbi } from "@/contracts/abis";

export type DeploymentEntry = {
  chainId: number;
  network: string;
  deployer: string;
  deployedAt: string;
  registry: { address: `0x${string}`; blockNumber: number };
};

export const CONTRACT_ABI = registryAbi;

export function getBaseDeployment(chainId: number): DeploymentEntry | undefined {
  return (deployments as Record<string, DeploymentEntry>)[String(chainId)];
}
