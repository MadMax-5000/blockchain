import { useAccount, useReadContract } from "wagmi";
import { keccak256, toHex, zeroAddress, type Abi } from "viem";
import { CONTRACT_ABI } from "@/lib/contracts";
import { useDeployment } from "@/hooks/use-deployment";
import { useNetwork } from "@/hooks/use-network";

export const AGENT_ROLE = keccak256(toHex("AGENT_ROLE"));

const abi = CONTRACT_ABI as Abi;

export function useMunicipalRole() {
  const { chainId } = useNetwork();
  const { address: contractAddress } = useDeployment();
  const { address: account, isConnected } = useAccount();

  const roleQuery = useReadContract({
    address: contractAddress ?? zeroAddress,
    abi,
    functionName: "hasRole",
    args: [AGENT_ROLE, account ?? zeroAddress],
    chainId,
    query: { enabled: Boolean(contractAddress && account) },
  });

  const pauseQuery = useReadContract({
    address: contractAddress ?? zeroAddress,
    abi,
    functionName: "paused",
    chainId,
    query: { enabled: Boolean(contractAddress) },
  });

  return {
    isConnected,
    account,
    isAgent: Boolean(roleQuery.data),
    isLoading: roleQuery.isLoading,
    paused: Boolean(pauseQuery.data),
  };
}
