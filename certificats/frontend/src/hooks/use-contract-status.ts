import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient } from "wagmi";
import { getAbi, type ContractVersion } from "@/lib/contracts";
import { useContractAddress } from "@/hooks/use-deployment";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ContractStatus = {
  canMint: boolean;
  canRevoke: boolean;
  isAdmin: boolean;
  isOwner?: boolean;
  owner?: string;
  paused?: boolean;
  minterRole?: string;
  soulbound?: boolean;
};

export function useContractStatus(version: ContractVersion) {
  const { address, chainId } = useContractAddress(version);
  const { address: account } = useAccount();
  const publicClient = usePublicClient({ chainId });

  return useQuery<ContractStatus>({
    queryKey: ["contract-status", version, chainId, address, account],
    enabled: Boolean(publicClient && address),
    queryFn: async () => {
      const abi = getAbi(version) as any;
      const client = publicClient!;

      if (version === "v1") {
        const [owner, isAdmin, paused] = await Promise.all([
          client.readContract({ address: address!, abi, functionName: "owner" }) as Promise<string>,
          account
            ? (client.readContract({
                address: address!,
                abi,
                functionName: "isAdmin",
                args: [account],
              }) as Promise<boolean>)
            : Promise.resolve(false),
          client.readContract({ address: address!, abi, functionName: "paused" }) as Promise<boolean>,
        ]);
        const isOwner = Boolean(account && owner.toLowerCase() === account.toLowerCase());
        return {
          owner,
          isOwner,
          isAdmin: Boolean(isAdmin),
          paused,
          canMint: (isOwner || Boolean(isAdmin)) && !paused,
          canRevoke: isOwner || Boolean(isAdmin),
        };
      }

      const [minterRole, paused, soulbound, isMinter, isAdmin] = await Promise.all([
        client.readContract({ address: address!, abi, functionName: "MINTER_ROLE" }) as Promise<string>,
        client.readContract({ address: address!, abi, functionName: "paused" }) as Promise<boolean>,
        client.readContract({ address: address!, abi, functionName: "soulbound" }) as Promise<boolean>,
        account
          ? (client.readContract({
              address: address!,
              abi,
              functionName: "hasRole",
              args: [await (client.readContract({
                address: address!,
                abi,
                functionName: "MINTER_ROLE",
              }) as Promise<`0x${string}`>), account],
            }) as Promise<boolean>)
          : Promise.resolve(false),
        account
          ? (client.readContract({
              address: address!,
              abi,
              functionName: "hasRole",
              args: [
                "0x0000000000000000000000000000000000000000000000000000000000000000",
                account,
              ],
            }) as Promise<boolean>)
          : Promise.resolve(false),
      ]);

      return {
        minterRole,
        paused,
        soulbound,
        isAdmin: Boolean(isAdmin),
        canMint: Boolean(isMinter) && !paused,
        canRevoke: Boolean(isAdmin),
      };
    },
    retry: false,
  });
}
