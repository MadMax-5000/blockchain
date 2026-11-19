import fs from "fs";
import path from "path";
import { ethers, network } from "hardhat";
import { mergeDeployment, writeAbis, type DeploymentEntry } from "./export-frontend";

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);

  console.log(`Réseau      : ${network.name} (chainId ${chainId})`);
  console.log(`Déployeur   : ${deployer.address}`);
  console.log(`Solde       : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  const Registry = await ethers.getContractFactory("CertificateRegistry");
  const registry = await Registry.deploy(deployer.address);
  await registry.waitForDeployment();
  const registryReceipt = await registry.deploymentTransaction()?.wait();
  const registryAddress = await registry.getAddress();

  const NFT = await ethers.getContractFactory("CertificateNFT");
  const nft = await NFT.deploy(deployer.address, true);
  await nft.waitForDeployment();
  const nftReceipt = await nft.deploymentTransaction()?.wait();
  const nftAddress = await nft.getAddress();

  const entry: DeploymentEntry = {
    chainId,
    network: network.name,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    registry: {
      address: registryAddress,
      blockNumber: registryReceipt?.blockNumber ?? 0,
    },
    nft: {
      address: nftAddress,
      blockNumber: nftReceipt?.blockNumber ?? 0,
    },
  };

  const deploymentsDir = path.resolve(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  fs.writeFileSync(
    path.join(deploymentsDir, `${chainId}.json`),
    `${JSON.stringify(entry, null, 2)}\n`,
    "utf8",
  );

  mergeDeployment(entry);
  await writeAbis();

  console.log("");
  console.log("CertificateRegistry (v1) :", registryAddress);
  console.log("CertificateNFT      (v2) :", nftAddress);
  console.log("");
  console.log("Adresses écrites dans deployments/ et frontend/src/contracts/deployments.json");
  if (network.name === "localhost" || network.name === "hardhat") {
    console.log("Étape suivante : npm run seed:local (avec un node local démarré).");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
