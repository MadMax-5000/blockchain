import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { getAbi, type ContractVersion } from "@/lib/contracts";
import { useDeployment } from "@/hooks/use-deployment";
import { useNetwork } from "@/hooks/use-network";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function useTotals() {
  const { chainId } = useNetwork();
  const publicClient = usePublicClient({ chainId });
  const deployment = useDeployment();

  return useQuery<Record<ContractVersion, bigint>>({
    queryKey: ["totals", chainId, deployment.registry, deployment.nft],
    enabled: Boolean(publicClient && deployment.hasDeployment),
    queryFn: async () => {
      const read = async (version: ContractVersion) => {
        const address = deployment.addressFor(version);
        if (!address) return 0n;
        try {
          return (await publicClient!.readContract({
            address,
            abi: getAbi(version) as any,
            functionName: "totalCertificates",
          })) as bigint;
        } catch {
          return 0n;
        }
      };
      const [v1, v2] = await Promise.all([read("v1"), read("v2")]);
      return { v1, v2 };
    },
    retry: false,
  });
}
