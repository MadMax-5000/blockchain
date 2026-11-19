import { useCallback } from "react";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { getAbi, type ContractVersion } from "@/lib/contracts";
import type { CertificateInput } from "@/lib/certificates";
import { useDeployment } from "@/hooks/use-deployment";
import { useNetwork } from "@/hooks/use-network";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function useEnsureCorrectChain() {
  const { chainId } = useNetwork();
  const { isConnected, chainId: walletChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  return useCallback(async () => {
    if (!isConnected) throw new Error("Connectez votre wallet pour signer la transaction.");
    if (walletChainId !== chainId) {
      await switchChainAsync({ chainId });
    }
  }, [chainId, isConnected, switchChainAsync, walletChainId]);
}

export function useCertificateActions() {
  const { writeContractAsync } = useWriteContract();
  const { chainId } = useNetwork();
  const deployment = useDeployment();
  const publicClient = usePublicClient({ chainId });
  const ensureChain = useEnsureCorrectChain();

  const resolveAddress = useCallback(
    (version: ContractVersion) => {
      const address = deployment.addressFor(version);
      if (!address) throw new Error("Aucun contrat déployé sur ce réseau. Lancez le déploiement local.");
      return address;
    },
    [deployment],
  );

  const wait = useCallback(
    async (hash: `0x${string}`) => {
      if (!publicClient) throw new Error("Client RPC indisponible.");
      return publicClient.waitForTransactionReceipt({ hash });
    },
    [publicClient],
  );

  const mint = useCallback(
    async (version: ContractVersion, input: CertificateInput) => {
      await ensureChain();
      const address = resolveAddress(version);
      const abi = getAbi(version) as any;
      const hash = await writeContractAsync({
        address,
        abi,
        functionName: "mintCertificate",
        args: [
          input.recipientAddress,
          input.studentName,
          input.studentId,
          input.diplomaTitle,
          input.issueDate,
          input.grade,
        ],
      });
      await wait(hash);
      return hash;
    },
    [ensureChain, resolveAddress, wait, writeContractAsync],
  );

  const mintBatch = useCallback(
    async (version: ContractVersion, inputs: CertificateInput[]) => {
      await ensureChain();
      const address = resolveAddress(version);
      const abi = getAbi(version) as any;

      const recipients = inputs.map((input) => input.recipientAddress);
      const names = inputs.map((input) => input.studentName);
      const ids = inputs.map((input) => input.studentId);
      const diplomas = inputs.map((input) => input.diplomaTitle);
      const dates = inputs.map((input) => input.issueDate);
      const grades = inputs.map((input) => input.grade);

      const hash = await writeContractAsync({
        address,
        abi,
        functionName: version === "v1" ? "batchMint" : "batchMintCertificatesWithData",
        args: [recipients, names, ids, diplomas, dates, grades],
      });
      await wait(hash);
      return hash;
    },
    [ensureChain, resolveAddress, wait, writeContractAsync],
  );

  const revoke = useCallback(
    async (version: ContractVersion, id: bigint) => {
      await ensureChain();
      const address = resolveAddress(version);
      const abi = getAbi(version) as any;
      const hash = await writeContractAsync({
        address,
        abi,
        functionName: version === "v1" ? "revoke" : "revokeCertificate",
        args: [id],
      });
      await wait(hash);
      return hash;
    },
    [ensureChain, resolveAddress, wait, writeContractAsync],
  );

  const setAdmin = useCallback(
    async (account: `0x${string}`, enabled: boolean) => {
      await ensureChain();
      const address = resolveAddress("v1");
      const abi = getAbi("v1") as any;
      const hash = await writeContractAsync({
        address,
        abi,
        functionName: "setAdmin",
        args: [account, enabled],
      });
      await wait(hash);
      return hash;
    },
    [ensureChain, resolveAddress, wait, writeContractAsync],
  );

  const grantRole = useCallback(
    async (role: `0x${string}`, account: `0x${string}`) => {
      await ensureChain();
      const address = resolveAddress("v2");
      const abi = getAbi("v2") as any;
      const hash = await writeContractAsync({
        address,
        abi,
        functionName: "grantRole",
        args: [role, account],
      });
      await wait(hash);
      return hash;
    },
    [ensureChain, resolveAddress, wait, writeContractAsync],
  );

  const revokeRole = useCallback(
    async (role: `0x${string}`, account: `0x${string}`) => {
      await ensureChain();
      const address = resolveAddress("v2");
      const abi = getAbi("v2") as any;
      const hash = await writeContractAsync({
        address,
        abi,
        functionName: "revokeRole",
        args: [role, account],
      });
      await wait(hash);
      return hash;
    },
    [ensureChain, resolveAddress, wait, writeContractAsync],
  );

  const setPaused = useCallback(
    async (version: ContractVersion, paused: boolean) => {
      await ensureChain();
      const address = resolveAddress(version);
      const abi = getAbi(version) as any;
      const hash = await writeContractAsync({
        address,
        abi,
        functionName: paused ? "pause" : "unpause",
        args: [],
      });
      await wait(hash);
      return hash;
    },
    [ensureChain, resolveAddress, wait, writeContractAsync],
  );

  return { mint, mintBatch, revoke, setAdmin, grantRole, revokeRole, setPaused };
}
