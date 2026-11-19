import { useCallback } from "react";
import { usePublicClient } from "wagmi";
import { getAbi, type ContractVersion } from "@/lib/contracts";
import type { CertificateRecord } from "@/lib/certificates";
import { useDeployment } from "@/hooks/use-deployment";
import { useNetwork } from "@/hooks/use-network";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function useCertificateSearch() {
  const { chainId } = useNetwork();
  const publicClient = usePublicClient({ chainId });
  const deployment = useDeployment();

  return useCallback(
    async (term: string): Promise<CertificateRecord[]> => {
      const query = term.trim();
      if (!query) return [];
      if (!publicClient) throw new Error("Client RPC indisponible.");

      const versions: ContractVersion[] = ["v2", "v1"];
      const results = await Promise.allSettled<CertificateRecord | null>(
        versions.map(async (version) => {
          const address = deployment.addressFor(version);
          if (!address) return null;
          const abi = getAbi(version) as any;

          let id: bigint | null = null;
          if (/^\d+$/.test(query)) {
            id = BigInt(query);
          } else {
            const found = (await publicClient.readContract({
              address,
              abi,
              functionName: version === "v1" ? "certificateIdByStudentId" : "tokenIdByStudentId",
              args: [query],
            })) as bigint;
            if (found === 0n) return null;
            id = found;
          }

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
          } satisfies CertificateRecord;
        }),
      );

      return results
        .filter((result): result is PromiseFulfilledResult<CertificateRecord | null> => result.status === "fulfilled")
        .map((result) => result.value)
        .filter((value): value is CertificateRecord => value !== null);
    },
    [deployment, publicClient],
  );
}
