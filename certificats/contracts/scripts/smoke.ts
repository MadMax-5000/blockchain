import fs from "fs";
import path from "path";
import { ethers } from "hardhat";

/**
 * Vérification post-déploiement : lit les deux contrats et contrôle
 * que les 7 certificats de démonstration sont bien présents.
 * Usage : npx hardhat run scripts/smoke.ts --network localhost
 */
async function main(): Promise<void> {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const file = path.resolve(__dirname, "..", "deployments", `${chainId}.json`);
  const deployment = JSON.parse(fs.readFileSync(file, "utf8")) as {
    registry: { address: string };
    nft: { address: string };
  };

  const registry = await ethers.getContractAt("CertificateRegistry", deployment.registry.address);
  const nft = await ethers.getContractAt("CertificateNFT", deployment.nft.address);

  const totalV1 = await registry.totalCertificates();
  const totalV2 = await nft.totalCertificates();
  console.log(`v1 totalCertificates : ${totalV1}`);
  console.log(`v2 totalCertificates : ${totalV2}`);

  const v1 = await registry.getCertificate(1);
  console.log(`v1 #1 : ${v1.studentName} (${v1.studentId}) — ${v1.diplomaTitle} — revoked=${v1.revoked}`);

  const v2 = await nft.getCertificate(1);
  console.log(`v2 #1 : ${v2.studentName} (${v2.studentId}) — ${v2.diplomaTitle} — revoked=${v2.revoked}`);
  console.log(`v2 ownerOf(1) : ${await nft.ownerOf(1)}`);
  console.log(`v2 tokenIdByStudentId(2023-INF-042) : ${await nft.tokenIdByStudentId("2023-INF-042")}`);

  const uri = await nft.tokenURI(1);
  const prefix = "data:application/json;base64,";
  if (!uri.startsWith(prefix)) throw new Error("tokenURI inattendu");
  const metadata = JSON.parse(Buffer.from(uri.slice(prefix.length), "base64").toString("utf8"));
  console.log(`v2 tokenURI name : ${metadata.name}`);
  console.log(`v2 tokenURI attributes : ${metadata.attributes.length}`);

  if (totalV1 !== 7n || totalV2 !== 7n) throw new Error("Nombre de certificats inattendu");
  console.log("\nOK — déploiement et données de démonstration vérifiés.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
