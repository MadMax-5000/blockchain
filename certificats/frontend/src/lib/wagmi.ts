import { createConfig, http } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [hardhat, sepolia],
  connectors: [injected()],
  transports: {
    [hardhat.id]: http(import.meta.env.VITE_LOCAL_RPC_URL ?? "http://127.0.0.1:8545"),
    [sepolia.id]: http(import.meta.env.VITE_SEPOLIA_RPC_URL ?? undefined),
  },
  ssr: false,
});

/** Vrai si un wallet EIP-1193 est injecté dans la page (MetaMask, Brave Wallet, …). */
export function hasInjectedProvider(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as Window & { ethereum?: unknown }).ethereum);
}

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
