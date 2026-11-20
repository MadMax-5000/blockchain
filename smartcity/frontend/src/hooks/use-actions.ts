import { useQueryClient } from "@tanstack/react-query";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import type { Abi, Hash } from "viem";
import { CONTRACT_ABI } from "@/lib/contracts";
import type { IssueInput } from "@/lib/issues";
import { useDeployment } from "@/hooks/use-deployment";
import { useNetwork } from "@/hooks/use-network";

const abi = CONTRACT_ABI as Abi;

export function useIssueActions() {
  const { chainId } = useNetwork();
  const { address: contractAddress } = useDeployment();
  const publicClient = usePublicClient({ chainId });
  const { writeContractAsync, isPending } = useWriteContract();
  const queryClient = useQueryClient();
  const { address: account, isConnected, chainId: walletChainId } = useAccount();

  async function assertReady() {
    if (!isConnected || !account) throw new Error("Connectez MetaMask avant de signer.");
    if (!contractAddress) throw new Error("Adresse du contrat introuvable sur ce réseau.");
    if (!publicClient) throw new Error("Client blockchain indisponible.");
    if (walletChainId !== chainId) {
      throw new Error("MetaMask n'est pas sur le bon réseau. Sélectionnez le réseau affiché en haut de page.");
    }
    return { contractAddress, publicClient };
  }

  async function settle(hash: Hash, successMessage: string) {
    await publicClient!.waitForTransactionReceipt({ hash });
    await queryClient.invalidateQueries({ queryKey: ["issues"] });
    await queryClient.invalidateQueries({ queryKey: ["issue-history"] });
    return { hash, message: successMessage };
  }

  const createIssue = async (input: IssueInput) => {
    const ready = await assertReady();
    const hash = await writeContractAsync({
      address: ready.contractAddress,
      abi,
      functionName: "createIssue",
      args: [input],
      chainId,
      account: ready.publicClient ? account! : undefined,
    });
    return settle(hash, "Signalement enregistré on-chain.");
  };

  const batchCreateIssues = async (inputs: IssueInput[]) => {
    const ready = await assertReady();
    const hash = await writeContractAsync({
      address: ready.contractAddress,
      abi,
      functionName: "batchCreateIssues",
      args: [inputs],
      chainId,
      account: ready.publicClient ? account! : undefined,
    });
    return settle(hash, `${inputs.length} signalement(s) importé(s) on-chain.`);
  };

  const assignTeam = async (issueId: string, team: string, comment: string) => {
    const ready = await assertReady();
    const hash = await writeContractAsync({
      address: ready.contractAddress,
      abi,
      functionName: "assignTeam",
      args: [issueId, team, comment],
      chainId,
      account: ready.publicClient ? account! : undefined,
    });
    return settle(hash, `Équipe ${team} affectée.`);
  };

  const updateStatus = async (issueId: string, status: number, comment: string) => {
    const ready = await assertReady();
    const hash = await writeContractAsync({
      address: ready.contractAddress,
      abi,
      functionName: "updateStatus",
      args: [issueId, status, comment],
      chainId,
      account: ready.publicClient ? account! : undefined,
    });
    return settle(hash, "Statut mis à jour on-chain.");
  };

  const setPaused = async (paused: boolean) => {
    const ready = await assertReady();
    const hash = await writeContractAsync({
      address: ready.contractAddress,
      abi,
      functionName: paused ? "pause" : "unpause",
      chainId,
      account: ready.publicClient ? account! : undefined,
    });
    await queryClient.invalidateQueries({ queryKey: ["municipal-role"] });
    return settle(hash, paused ? "Registre mis en pause." : "Registre réactivé.");
  };

  return { createIssue, batchCreateIssues, assignTeam, updateStatus, setPaused, isPending };
}
