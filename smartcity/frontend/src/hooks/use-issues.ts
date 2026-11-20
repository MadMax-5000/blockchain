import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { Abi } from "viem";
import { CONTRACT_ABI } from "@/lib/contracts";
import type { HistoryEntry, IssueRecord } from "@/lib/issues";
import { useDeployment } from "@/hooks/use-deployment";
import { useNetwork } from "@/hooks/use-network";

const abi = CONTRACT_ABI as Abi;

export function useIssues() {
  const { chainId } = useNetwork();
  const { address } = useDeployment();
  const publicClient = usePublicClient({ chainId });

  return useQuery<IssueRecord[]>({
    queryKey: ["issues", chainId, address],
    enabled: Boolean(address && publicClient),
    refetchInterval: 15_000,
    queryFn: async () => {
      if (!address || !publicClient) return [];

      const total = (await publicClient.readContract({
        address,
        abi,
        functionName: "totalIssues",
      })) as bigint;

      if (total === 0n) return [];

      const limit = total > 500n ? 500n : total;
      const ids = (await publicClient.readContract({
        address,
        abi,
        functionName: "getIssueIds",
        args: [0n, limit],
      })) as string[];

      const issues = await Promise.all(
        ids.map((id) =>
          publicClient.readContract({
            address,
            abi,
            functionName: "getIssue",
            args: [id],
          }) as Promise<unknown>,
        ),
      );

      return issues as IssueRecord[];
    },
  });
}

export function useIssue(issueId: string | undefined) {
  const issues = useIssues();
  return {
    ...issues,
    data: issues.data?.find((issue) => issue.issueId === issueId),
  };
}

export function useIssueHistory(issueId: string | undefined) {
  const { chainId } = useNetwork();
  const { address } = useDeployment();
  const publicClient = usePublicClient({ chainId });

  return useQuery<HistoryEntry[]>({
    queryKey: ["issue-history", chainId, address, issueId],
    enabled: Boolean(address && publicClient && issueId),
    queryFn: async () => {
      if (!address || !publicClient || !issueId) return [];
      return (await publicClient.readContract({
        address,
        abi,
        functionName: "getHistory",
        args: [issueId],
      })) as unknown as HistoryEntry[];
    },
  });
}
