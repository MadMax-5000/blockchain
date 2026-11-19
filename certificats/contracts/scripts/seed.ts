import fs from "fs";
import path from "path";
import { ethers, network } from "hardhat";

type StudentRow = {
  studentName: string;
  studentId: string;
  diplomaTitle: string;
  issueDate: string;
  recipientAddress: string;
  grade: string;
};

function loadDeployment(chainId: number): { registry: string; nft: string } {
  const file = path.resolve(__dirname, "..", "deployments", `${chainId}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Aucun déploiement pour chainId ${chainId}. Lancez d'abord npm run deploy:local.`);
  }
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
    registry: { address: string };
    nft: { address: string };
  };
  return { registry: raw.registry.address, nft: raw.nft.address };
}

async function main(): Promise<void> {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const { registry: registryAddress, nft: nftAddress } = loadDeployment(chainId);

  const rows = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "..", "data", "etudiants.json"), "utf8"),
  ) as StudentRow[];

  const seen = new Set<string>();
  const unique = rows.filter((row) => {
    if (seen.has(row.studentId)) return false;
    seen.add(row.studentId);
    return true;
  });

  const [admin] = await ethers.getSigners();
  const registry = await ethers.getContractAt("CertificateRegistry", registryAddress);
  const nft = await ethers.getContractAt("CertificateNFT", nftAddress);

  console.log(`Réseau ${network.name} — ${unique.length} certificats uniques à émettre`);

  const totalV1 = await registry.totalCertificates();
  if (totalV1 === 0n) {
    const tx = await registry.connect(admin).batchMint(
      unique.map((row) => row.recipientAddress),
      unique.map((row) => row.studentName),
      unique.map((row) => row.studentId),
      unique.map((row) => row.diplomaTitle),
      unique.map((row) => row.issueDate),
      unique.map((row) => row.grade),
    );
    await tx.wait();
    console.log(`v1 CertificateRegistry : ${unique.length} certificats — tx ${tx.hash}`);
  } else {
    console.log(`v1 CertificateRegistry : déjà ${totalV1} certificats, rien à faire`);
  }

  const totalV2 = await nft.totalCertificates();
  if (totalV2 === 0n) {
    const tx = await nft.connect(admin).batchMintCertificatesWithData(
      unique.map((row) => row.recipientAddress),
      unique.map((row) => row.studentName),
      unique.map((row) => row.studentId),
      unique.map((row) => row.diplomaTitle),
      unique.map((row) => row.issueDate),
      unique.map((row) => row.grade),
    );
    await tx.wait();
    console.log(`v2 CertificateNFT      : ${unique.length} certificats — tx ${tx.hash}`);
  } else {
    console.log(`v2 CertificateNFT      : déjà ${totalV2} certificats, rien à faire`);
  }

  console.log("");
  console.log("Vérification : http://localhost:5173/verify");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
