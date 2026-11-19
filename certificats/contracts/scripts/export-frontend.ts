import fs from "fs";
import path from "path";
import { artifacts } from "hardhat";

export const FRONTEND_DIR = path.resolve(__dirname, "..", "..", "frontend");
export const CONTRACTS_DIR = path.join(FRONTEND_DIR, "src", "contracts");
export const DEPLOYMENTS_PATH = path.join(CONTRACTS_DIR, "deployments.json");

export type DeploymentEntry = {
  chainId: number;
  network: string;
  deployer: string;
  deployedAt: string;
  registry: { address: string; blockNumber: number };
  nft: { address: string; blockNumber: number };
};

export type DeploymentsFile = Record<string, DeploymentEntry>;

export async function writeAbis(): Promise<void> {
  const registry = await artifacts.readArtifact("CertificateRegistry");
  const nft = await artifacts.readArtifact("CertificateNFT");

  fs.mkdirSync(CONTRACTS_DIR, { recursive: true });
  const content = `// Fichier généré par scripts/export-frontend.ts — ne pas éditer à la main.
// Relancer \`npm run export\` après chaque compilation.

export const registryAbi = ${JSON.stringify(registry.abi, null, 2)} as const;

export const nftAbi = ${JSON.stringify(nft.abi, null, 2)} as const;
`;
  fs.writeFileSync(path.join(CONTRACTS_DIR, "abis.ts"), content, "utf8");
}

export function readDeployments(): DeploymentsFile {
  if (!fs.existsSync(DEPLOYMENTS_PATH)) return {};
  const raw = fs.readFileSync(DEPLOYMENTS_PATH, "utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as DeploymentsFile;
}

export function mergeDeployment(entry: DeploymentEntry): DeploymentsFile {
  const deployments = readDeployments();
  deployments[String(entry.chainId)] = entry;
  fs.mkdirSync(CONTRACTS_DIR, { recursive: true });
  fs.writeFileSync(DEPLOYMENTS_PATH, `${JSON.stringify(deployments, null, 2)}\n`, "utf8");
  return deployments;
}

async function main(): Promise<void> {
  await writeAbis();
  console.log(`ABI exportées vers ${path.join(CONTRACTS_DIR, "abis.ts")}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
