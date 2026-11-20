import fs from "fs";
import path from "path";
import { ethers } from "hardhat";

/**
 * Vérification post-déploiement : lit le registre, un signalement, son historique
 * et les événements émis. Usage : npm run smoke:local
 */
async function main(): Promise<void> {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const file = path.resolve(__dirname, "..", "deployments", `${chainId}.json`);
  const deployment = JSON.parse(fs.readFileSync(file, "utf8")) as {
    registry: { address: string };
  };

  const registry = await ethers.getContractAt("UrbanIssueRegistry", deployment.registry.address);

  const total = await registry.totalIssues();
  const ids = await registry.getIssueIds(0, 100);
  console.log(`totalIssues  : ${total}`);
  console.log(`getIssueIds  : ${ids.length} identifiant(s) — ${ids.slice(0, 3).join(", ")}…`);

  if (total < 8n) throw new Error("Le jeu de démonstration n'est pas présent (8 signalements attendus).");

  const issue = await registry.getIssue("CITY-2026-005");
  const history = await registry.getHistory("CITY-2026-005");

  console.log(
    `CITY-2026-005 : ${issue.issueType} — ${issue.location} — statut ${Number(issue.status)} — équipe ${issue.assignedTo}`,
  );
  console.log(`historique   : ${history.length} entrée(s)`);
  history.forEach((entry, index) => {
    console.log(
      `  ${index + 1}. ${new Date(Number(entry.timestamp) * 1000).toISOString()} · statut ${Number(entry.status)} · ${entry.comment} · ${entry.actor}`,
    );
  });

  if (history.length < 5 && Array.isArray(history)) {
    throw new Error("Historique incomplet sur le signalement clos de démonstration.");
  }

  const created = await registry.queryFilter(registry.filters.IssueCreated(), 0);
  const assigned = await registry.queryFilter(registry.filters.IssueAssigned(), 0);
  const statusUpdated = await registry.queryFilter(registry.filters.IssueStatusUpdated(), 0);
  console.log(`événements   : ${created.length} IssueCreated · ${assigned.length} IssueAssigned · ${statusUpdated.length} IssueStatusUpdated`);

  if (created.length < 8 || assigned.length === 0 || statusUpdated.length === 0) {
    throw new Error("Événements de traçabilité manquants.");
  }

  console.log("\nOK — déploiement, données de démonstration et historique vérifiés.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
