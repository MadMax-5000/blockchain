import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const STATUS = { Reported: 0, Assigned: 1, InProgress: 2, Resolved: 3, Closed: 4 };
const PRIORITY = { Low: 0, Medium: 1, High: 2, Critical: 3 };

type IssueInput = {
  issueId: string;
  issueType: string;
  location: string;
  description: string;
  reportDate: string;
  priority: number;
  reportedBy: string;
  assignedTo: string;
  status: number;
};

function input(overrides: Partial<IssueInput> = {}): IssueInput {
  return {
    issueId: "CITY-2026-001",
    issueType: "StreetLight",
    location: "Avenue Mohammed V",
    description: "Streetlight not working",
    reportDate: "2026-11-19",
    priority: PRIORITY.High,
    reportedBy: "Citizen01",
    assignedTo: "",
    status: STATUS.Reported,
    ...overrides,
  };
}

async function deployFixture() {
  const [owner, agent, stranger, citizen] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory("UrbanIssueRegistry");
  const registry = await Factory.deploy();
  await registry.waitForDeployment();
  return { registry, owner, agent, stranger, citizen };
}

async function create(
  registry: Awaited<ReturnType<typeof deployFixture>>["registry"],
  overrides: Partial<IssueInput> = {},
  signer?: Awaited<ReturnType<typeof ethers.getSigners>>[number],
) {
  const tx = await (signer ? registry.connect(signer) : registry).createIssue(input(overrides));
  await tx.wait();
}

describe("UrbanIssueRegistry", () => {
  describe("Déploiement et rôles", () => {
    it("accorde les rôles admin et agent au déployeur", async () => {
      const { registry, owner } = await loadFixture(deployFixture);
      expect(await registry.DEFAULT_ADMIN_ROLE()).to.equal(ethers.ZeroHash);
      expect(await registry.hasRole(await registry.DEFAULT_ADMIN_ROLE(), owner.address)).to.equal(true);
      expect(await registry.hasRole(await registry.AGENT_ROLE(), owner.address)).to.equal(true);
      expect(await registry.totalIssues()).to.equal(0n);
      expect(await registry.paused()).to.equal(false);
    });

    it("permet à l'admin d'accorder et retirer AGENT_ROLE", async () => {
      const { registry, owner, agent } = await loadFixture(deployFixture);
      const role = await registry.AGENT_ROLE();
      await expect(registry.connect(owner).grantRole(role, agent.address))
        .to.emit(registry, "RoleGranted")
        .withArgs(role, agent.address, owner.address);
      expect(await registry.hasRole(role, agent.address)).to.equal(true);
      await registry.connect(owner).revokeRole(role, agent.address);
      expect(await registry.hasRole(role, agent.address)).to.equal(false);
    });
  });

  describe("Création et consultation", () => {
    it("crée un signalement et stocke toutes les données", async () => {
      const { registry, citizen } = await loadFixture(deployFixture);
      const data = input({ issueId: "CITY-2026-001" });
      const key = ethers.keccak256(ethers.toUtf8Bytes(data.issueId));

      await expect(registry.connect(citizen).createIssue(data))
        .to.emit(registry, "IssueCreated")
        .withArgs(key, data.issueId, data.issueType, data.location, data.priority, citizen.address);

      const stored = await registry.getIssue(data.issueId);
      expect(stored.issueId).to.equal(data.issueId);
      expect(stored.issueType).to.equal(data.issueType);
      expect(stored.location).to.equal(data.location);
      expect(stored.description).to.equal(data.description);
      expect(stored.reportDate).to.equal(data.reportDate);
      expect(stored.priority).to.equal(data.priority);
      expect(stored.reportedBy).to.equal(data.reportedBy);
      expect(stored.status).to.equal(STATUS.Reported);
      expect(stored.exists).to.equal(true);
      expect(stored.createdAt).to.be.greaterThan(0n);
      expect(await registry.totalIssues()).to.equal(1n);
      expect(await registry.issueExists(data.issueId)).to.equal(true);
    });

    it("ajoute une entrée d'historique à la création avec l'acteur", async () => {
      const { registry, citizen } = await loadFixture(deployFixture);
      await create(registry, {}, citizen);
      const history = await registry.getHistory("CITY-2026-001");
      expect(history.length).to.equal(1);
      expect(history[0].status).to.equal(STATUS.Reported);
      expect(history[0].comment).to.equal("Signalement cree");
      expect(history[0].actor).to.equal(citizen.address);
      expect(history[0].timestamp).to.be.greaterThan(0n);
    });

    it("refuse un identifiant déjà utilisé", async () => {
      const { registry } = await loadFixture(deployFixture);
      await create(registry);
      await expect(registry.createIssue(input()))
        .to.be.revertedWithCustomError(registry, "IssueAlreadyExists")
        .withArgs("CITY-2026-001");
    });

    it("refuse un champ obligatoire vide", async () => {
      const { registry } = await loadFixture(deployFixture);
      await expect(registry.createIssue(input({ description: "" })))
        .to.be.revertedWithCustomError(registry, "EmptyField")
        .withArgs("description");
    });

    it("refuse un texte trop long", async () => {
      const { registry } = await loadFixture(deployFixture);
      await expect(registry.createIssue(input({ issueId: "X".repeat(65) })))
        .to.be.revertedWithCustomError(registry, "StringTooLong");
    });

    it("accepte un import avec un statut initial et une équipe", async () => {
      const { registry } = await loadFixture(deployFixture);
      await create(registry, { issueId: "CITY-2026-002", status: STATUS.Assigned, assignedTo: "UrbanTeam01" });
      const stored = await registry.getIssue("CITY-2026-002");
      expect(stored.status).to.equal(STATUS.Assigned);
      expect(stored.assignedTo).to.equal("UrbanTeam01");
      const history = await registry.getHistory("CITY-2026-002");
      expect(history[0].status).to.equal(STATUS.Assigned);
    });

    it("refuse un statut initial sans équipe", async () => {
      const { registry } = await loadFixture(deployFixture);
      await expect(registry.createIssue(input({ status: STATUS.InProgress })))
        .to.be.revertedWithCustomError(registry, "TeamRequired");
    });

    it("refuse la consultation d'un signalement inconnu", async () => {
      const { registry } = await loadFixture(deployFixture);
      await expect(registry.getIssue("UNKNOWN"))
        .to.be.revertedWithCustomError(registry, "IssueNotFound")
        .withArgs("UNKNOWN");
      await expect(registry.getHistory("UNKNOWN"))
        .to.be.revertedWithCustomError(registry, "IssueNotFound");
      expect(await registry.issueExists("UNKNOWN")).to.equal(false);
    });

    it("liste les identifiants avec pagination", async () => {
      const { registry } = await loadFixture(deployFixture);
      for (let i = 1; i <= 3; i++) await create(registry, { issueId: `CITY-2026-00${i}` });
      expect(await registry.getIssueIds(0, 2)).to.deep.equal(["CITY-2026-001", "CITY-2026-002"]);
      expect(await registry.getIssueIds(2, 5)).to.deep.equal(["CITY-2026-003"]);
      expect(await registry.getIssueIds(9, 5)).to.deep.equal([]);
    });
  });

  describe("Affectation d'équipe", () => {
    it("affecte une équipe et fait passer Reported → Assigned", async () => {
      const { registry, owner } = await loadFixture(deployFixture);
      await create(registry);
      await expect(registry.assignTeam("CITY-2026-001", "UrbanTeam01", "Equipe affectee"))
        .to.emit(registry, "IssueAssigned")
        .withArgs(
          ethers.keccak256(ethers.toUtf8Bytes("CITY-2026-001")),
          "CITY-2026-001",
          "UrbanTeam01",
          owner.address,
        );
      const stored = await registry.getIssue("CITY-2026-001");
      expect(stored.status).to.equal(STATUS.Assigned);
      expect(stored.assignedTo).to.equal("UrbanTeam01");
      const history = await registry.getHistory("CITY-2026-001");
      expect(history.length).to.equal(2);
      expect(history[1].status).to.equal(STATUS.Assigned);
      expect(history[1].assignedTo).to.equal("UrbanTeam01");
      expect(history[1].actor).to.equal(owner.address);
    });

    it("permet de changer d'équipe pendant le traitement", async () => {
      const { registry } = await loadFixture(deployFixture);
      await create(registry, { status: STATUS.InProgress, assignedTo: "UrbanTeam01" });
      await registry.assignTeam("CITY-2026-001", "UrbanTeam02", "Relève d'équipe");
      const stored = await registry.getIssue("CITY-2026-001");
      expect(stored.status).to.equal(STATUS.InProgress);
      expect(stored.assignedTo).to.equal("UrbanTeam02");
    });

    it("refuse un changement d'équipe après clôture", async () => {
      const { registry } = await loadFixture(deployFixture);
      await create(registry, { status: STATUS.Closed, assignedTo: "UrbanTeam01" });
      await expect(registry.assignTeam("CITY-2026-001", "UrbanTeam02", ""))
        .to.be.revertedWithCustomError(registry, "TeamChangeNotAllowed")
        .withArgs(STATUS.Closed);
    });

    it("refuse une équipe vide", async () => {
      const { registry } = await loadFixture(deployFixture);
      await create(registry);
      await expect(registry.assignTeam("CITY-2026-001", "", ""))
        .to.be.revertedWithCustomError(registry, "EmptyField")
        .withArgs("team");
    });

    it("réserve l'affectation aux agents", async () => {
      const { registry, stranger } = await loadFixture(deployFixture);
      await create(registry);
      await expect(registry.connect(stranger).assignTeam("CITY-2026-001", "UrbanTeam01", ""))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, await registry.AGENT_ROLE());
    });
  });

  describe("Changements de statut", () => {
    async function seeded() {
      const fixture = await loadFixture(deployFixture);
      await create(fixture.registry);
      await fixture.registry.assignTeam("CITY-2026-001", "UrbanTeam01", "Affectation");
      return fixture;
    }

    it("suit toute la chaîne Reported → Assigned → InProgress → Resolved → Closed", async () => {
      const { registry, owner } = await loadFixture(seeded);
      const key = ethers.keccak256(ethers.toUtf8Bytes("CITY-2026-001"));

      await expect(registry.updateStatus("CITY-2026-001", STATUS.InProgress, "Intervention demarree"))
        .to.emit(registry, "IssueStatusUpdated")
        .withArgs(key, "CITY-2026-001", STATUS.Assigned, STATUS.InProgress, "Intervention demarree", owner.address);
      await registry.updateStatus("CITY-2026-001", STATUS.Resolved, "Lampadaire remplace");
      await registry.updateStatus("CITY-2026-001", STATUS.Closed, "Dossier clos");

      expect((await registry.getIssue("CITY-2026-001")).status).to.equal(STATUS.Closed);
      const history = await registry.getHistory("CITY-2026-001");
      expect(history.map((entry) => entry.status)).to.deep.equal([
        STATUS.Reported,
        STATUS.Assigned,
        STATUS.InProgress,
        STATUS.Resolved,
        STATUS.Closed,
      ]);
      expect(history[3].comment).to.equal("Lampadaire remplace");
    });

    it("refuse de sauter une étape", async () => {
      const { registry } = await loadFixture(seeded);
      await expect(registry.updateStatus("CITY-2026-001", STATUS.Resolved, " Trop vite"))
        .to.be.revertedWithCustomError(registry, "InvalidStatusTransition")
        .withArgs(STATUS.Assigned, STATUS.Resolved);
    });

    it("refuse de revenir en arrière", async () => {
      const { registry } = await loadFixture(seeded);
      await registry.updateStatus("CITY-2026-001", STATUS.InProgress, "Intervention demarree");
      await expect(registry.updateStatus("CITY-2026-001", STATUS.Assigned, "Retour arriere"))
        .to.be.revertedWithCustomError(registry, "InvalidStatusTransition")
        .withArgs(STATUS.InProgress, STATUS.Assigned);
    });

    it("refuse Assigned sans équipe", async () => {
      const { registry } = await loadFixture(deployFixture);
      await create(registry);
      await expect(registry.updateStatus("CITY-2026-001", STATUS.Assigned, ""))
        .to.be.revertedWithCustomError(registry, "TeamRequired");
    });

    it("réserve les changements aux agents", async () => {
      const { registry, stranger } = await loadFixture(seeded);
      await expect(registry.connect(stranger).updateStatus("CITY-2026-001", STATUS.InProgress, "x"))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, await registry.AGENT_ROLE());
    });

    it("met à jour updatedAt à chaque changement", async () => {
      const { registry } = await loadFixture(seeded);
      const before = (await registry.getIssue("CITY-2026-001")).updatedAt;
      await registry.updateStatus("CITY-2026-001", STATUS.InProgress, "Intervention demarree");
      const after = (await registry.getIssue("CITY-2026-001")).updatedAt;
      expect(after).to.be.greaterThanOrEqual(before);
    });
  });

  describe("Import par lot", () => {
    it("importe plusieurs signalements en une transaction", async () => {
      const { registry } = await loadFixture(deployFixture);
      await expect(
        registry.batchCreateIssues([
          input({ issueId: "CITY-2026-001" }),
          input({ issueId: "CITY-2026-002", issueType: "Road" }),
          input({ issueId: "CITY-2026-003", priority: PRIORITY.Low }),
        ]),
      ).to.emit(registry, "IssueCreated");
      expect(await registry.totalIssues()).to.equal(3n);
    });

    it("refuse un lot vide", async () => {
      const { registry } = await loadFixture(deployFixture);
      await expect(registry.batchCreateIssues([]))
        .to.be.revertedWithCustomError(registry, "EmptyBatch");
    });

    it("refuse un lot de plus de 50", async () => {
      const { registry } = await loadFixture(deployFixture);
      const rows = Array.from({ length: 51 }, (_, index) => input({ issueId: `CITY-2026-${100 + index}` }));
      await expect(registry.batchCreateIssues(rows))
        .to.be.revertedWithCustomError(registry, "BatchTooLarge")
        .withArgs(51);
    });

    it("refuse un doublon dans le lot", async () => {
      const { registry } = await loadFixture(deployFixture);
      await expect(
        registry.batchCreateIssues([input({ issueId: "CITY-2026-001" }), input({ issueId: "CITY-2026-001" })]),
      ).to.be.revertedWithCustomError(registry, "IssueAlreadyExists");
    });

    it("refuse un doublon déjà on-chain", async () => {
      const { registry } = await loadFixture(deployFixture);
      await create(registry);
      await expect(registry.batchCreateIssues([input({ issueId: "CITY-2026-001" })]))
        .to.be.revertedWithCustomError(registry, "IssueAlreadyExists");
    });

    it("réserve l'import aux agents", async () => {
      const { registry, stranger } = await loadFixture(deployFixture);
      await expect(registry.connect(stranger).batchCreateIssues([input()]))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, await registry.AGENT_ROLE());
    });
  });

  describe("Pause", () => {
    it("bloque les écritures quand le contrat est en pause", async () => {
      const { registry, owner } = await loadFixture(deployFixture);
      await create(registry);
      await registry.connect(owner).pause();
      expect(await registry.paused()).to.equal(true);
      await expect(registry.createIssue(input({ issueId: "CITY-2026-002" })))
        .to.be.revertedWithCustomError(registry, "EnforcedPause");
      await expect(registry.assignTeam("CITY-2026-001", "UrbanTeam01", ""))
        .to.be.revertedWithCustomError(registry, "EnforcedPause");
      await expect(registry.updateStatus("CITY-2026-001", STATUS.Assigned, ""))
        .to.be.revertedWithCustomError(registry, "EnforcedPause");
      await registry.connect(owner).unpause();
      await expect(registry.createIssue(input({ issueId: "CITY-2026-002" }))).to.emit(registry, "IssueCreated");
    });

    it("réserve pause/unpause à l'admin", async () => {
      const { registry, stranger } = await loadFixture(deployFixture);
      await expect(registry.connect(stranger).pause())
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("laisse la lecture disponible en pause", async () => {
      const { registry, owner } = await loadFixture(deployFixture);
      await create(registry);
      await registry.connect(owner).pause();
      expect((await registry.getIssue("CITY-2026-001")).issueId).to.equal("CITY-2026-001");
      expect((await registry.getHistory("CITY-2026-001")).length).to.equal(1);
    });
  });
});
