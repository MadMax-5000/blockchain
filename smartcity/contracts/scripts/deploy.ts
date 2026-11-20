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

  const Factory = await ethers.getContractFactory("UrbanIssueRegistry");
  const registry = await Factory.deploy();
  await registry.waitForDeployment();
  const receipt = await registry.deploymentTransaction()?.wait();
  const address = await registry.getAddress();

  const entry: DeploymentEntry = {
    chainId,
    network: network.name,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    registry: {
      address,
      blockNumber: receipt?.blockNumber ?? 0,
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
  console.log("UrbanIssueRegistry :", address);
  console.log("");
  console.log("Adresse écrite dans deployments/ et frontend/src/contracts/deployments.json");
  if (network.name === "localhost" || network.name === "hardhat") {
    console.log("Étape suivante : npm run seed:local puis npm run smoke:local.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
