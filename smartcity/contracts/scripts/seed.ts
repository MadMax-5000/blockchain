import fs from "fs";
import path from "path";
import { ethers, network } from "hardhat";

type IssueRow = {
  issueId: string;
  issueType: string;
  location: string;
  description: string;
  reportDate: string;
  priority: string;
  reportedBy: string;
  assignedTo: string;
  status: string;
};

const PRIORITY: Record<string, number> = { Low: 0, Medium: 1, High: 2, Critical: 3 };
const STATUS: Record<string, number> = {
  Reported: 0,
  Assigned: 1,
  InProgress: 2,
  Resolved: 3,
  Closed: 4,
};

const STATUS_COMMENTS: Record<number, string> = {
  2: "Intervention démarrée par l'équipe municipale",
  3: "Intervention terminée, contrôle effectué",
  4: "Dossier clos après vérification",
};

function loadRegistryAddress(chainId: number): string {
  const file = path.resolve(__dirname, "..", "deployments", `${chainId}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Aucun déploiement pour chainId ${chainId}. Lancez d'abord npm run deploy:local.`);
  }
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
    registry: { address: string };
  };
  return raw.registry.address;
}

function toInput(row: IssueRow, status: number, assignedTo: string) {
  return {
    issueId: row.issueId,
    issueType: row.issueType,
    location: row.location,
    description: row.description,
    reportDate: row.reportDate,
    priority: PRIORITY[row.priority] ?? 1,
    reportedBy: row.reportedBy,
    assignedTo,
    status,
  };
}

async function main(): Promise<void> {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const address = loadRegistryAddress(chainId);

  const rows = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "..", "data", "urban_issues.json"), "utf8"),
  ) as IssueRow[];

  const [admin] = await ethers.getSigners();
  const registry = await ethers.getContractAt("UrbanIssueRegistry", address);

  const total = await registry.totalIssues();
  if (total > 0n) {
    console.log(`Réseau ${network.name} — ${total} signalement(s) déjà présents, rien à faire.`);
    return;
  }

  console.log(`Réseau ${network.name} — création de ${rows.length} signalements fictifs`);

  const batch = await registry.connect(admin).batchCreateIssues(
    rows.map((row) => toInput(row, STATUS.Reported, "")),
  );
  await batch.wait();
  console.log(`Signalements créés — tx ${batch.hash}`);

  for (const row of rows) {
    const target = STATUS[row.status] ?? 0;
    if (target === 0) continue;

    const team = row.assignedTo || "UrbanTeam01";
    const assignTx = await registry
      .connect(admin)
      .assignTeam(row.issueId, team, "Affectation par le service municipal");
    await assignTx.wait();

    for (let step = 2; step <= target; ++step) {
      const tx = await registry
        .connect(admin)
        .updateStatus(row.issueId, step, STATUS_COMMENTS[step]);
      await tx.wait();
    }

    console.log(`${row.issueId} → ${row.status} (${team})`);
  }

  console.log("");
  console.log(`Total on-chain : ${await registry.totalIssues()}`);
  console.log("Vérification : npm run smoke:local puis http://localhost:5173");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
