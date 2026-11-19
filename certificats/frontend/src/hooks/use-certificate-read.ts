import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { PublicClient } from "viem";
import { getAbi, type ContractVersion } from "@/lib/contracts";
import type { CertificateRecord, RecentCertificate } from "@/lib/certificates";
import { useContractAddress } from "@/hooks/use-deployment";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function fetchCertificate(
  publicClient: PublicClient,
  version: ContractVersion,
  address: `0x${string}`,
  id: bigint,
): Promise<CertificateRecord> {
  const abi = getAbi(version) as any;
  const raw = (await publicClient.readContract({
    address,
    abi,
    functionName: "getCertificate",
    args: [id],
  })) as any;

  let tokenURI: string | undefined;
  if (version === "v2") {
    try {
      tokenURI = (await publicClient.readContract({
        address,
        abi,
        functionName: "tokenURI",
        args: [id],
      })) as string;
    } catch {
      tokenURI = undefined;
    }
  }

  return {
    version,
    id,
    studentName: raw.studentName,
    studentId: raw.studentId,
    diplomaTitle: raw.diplomaTitle,
    issueDate: raw.issueDate,
    grade: raw.grade,
    recipient: raw.recipient,
    revoked: raw.revoked,
    issuedAt: raw.issuedAt,
    tokenURI,
  };
}

export function useCertificate(version: ContractVersion, id: bigint | null) {
  const { address, chainId } = useContractAddress(version);
  const publicClient = usePublicClient({ chainId });

  return useQuery({
    queryKey: ["certificate", version, chainId, address, id?.toString()],
    enabled: Boolean(publicClient && address && id !== null),
    queryFn: () => fetchCertificate(publicClient!, version, address!, id!),
    retry: false,
  });
}

export function useRecentCertificates(version: ContractVersion, limit = 20) {
  const { address, chainId, fromBlock } = useContractAddress(version);
  const publicClient = usePublicClient({ chainId });

  return useQuery<RecentCertificate[]>({
    queryKey: ["recent", version, chainId, address, fromBlock, limit],
    enabled: Boolean(publicClient && address),
    queryFn: async () => {
      const abi = getAbi(version) as any;
      const logs = (await publicClient!.getContractEvents({
        address: address!,
        abi,
        eventName: "CertificateMinted",
        fromBlock: BigInt(fromBlock),
        toBlock: "latest",
      })) as any[];

      const recent = logs.slice(-limit).reverse();
      const ids = recent.map((log) =>
        version === "v1" ? (log.args as any).certId : (log.args as any).tokenId,
      );

      if (ids.length === 0) return [];

      const results = await publicClient!.multicall({
        contracts: ids.map((id) => ({
          address: address!,
          abi,
          functionName: "getCertificate",
          args: [id],
        })),
        allowFailure: true,
      });

      return ids.map((id: bigint, index: number) => {
        const result = results[index] as any;
        if (!result || result.status !== "success") return null;
        const raw = result.result as any;
        return {
          version,
          id,
          studentName: raw.studentName,
          studentId: raw.studentId,
          diplomaTitle: raw.diplomaTitle,
          issueDate: raw.issueDate,
          grade: raw.grade,
          recipient: raw.recipient,
          revoked: raw.revoked,
          issuedAt: raw.issuedAt,
          txHash: recent[index].transactionHash,
        } satisfies RecentCertificate;
      }).filter(Boolean) as RecentCertificate[];
    },
  });
}
