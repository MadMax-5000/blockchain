export type SupportedChainId = 31337 | 11155111;

export type ChainMeta = {
  id: SupportedChainId;
  name: string;
  short: string;
  explorer: string | null;
  rpc: string;
  isLocal: boolean;
};

export const SUPPORTED_CHAINS: ChainMeta[] = [
  {
    id: 31337,
    name: "Hardhat local",
    short: "Local",
    explorer: null,
    rpc: import.meta.env.VITE_LOCAL_RPC_URL ?? "http://127.0.0.1:8545",
    isLocal: true,
  },
  {
    id: 11155111,
    name: "Sepolia",
    short: "Sepolia",
    explorer: "https://sepolia.etherscan.io",
    rpc: import.meta.env.VITE_SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org",
    isLocal: false,
  },
];

export const DEFAULT_CHAIN_ID: SupportedChainId = 31337;

export function getChainMeta(chainId: number): ChainMeta {
  return SUPPORTED_CHAINS.find((chain) => chain.id === chainId) ?? SUPPORTED_CHAINS[0];
}

export function explorerTxUrl(chainId: number, hash: string): string | null {
  const chain = getChainMeta(chainId);
  return chain.explorer ? `${chain.explorer}/tx/${hash}` : null;
}

export function explorerAddressUrl(chainId: number, address: string): string | null {
  const chain = getChainMeta(chainId);
  return chain.explorer ? `${chain.explorer}/address/${address}` : null;
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

/** Ajoute le réseau Hardhat local à MetaMask (utile pour un poste de dev). */
export async function addLocalChainToWallet(): Promise<void> {
  if (!window.ethereum) throw new Error("Aucun wallet injecté détecté.");
  await window.ethereum.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: "0x7a69",
        chainName: "Hardhat local",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: [getChainMeta(31337).rpc],
      },
    ],
  });
}
