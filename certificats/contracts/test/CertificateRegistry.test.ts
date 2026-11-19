import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const STUDENT = {
  name: "Amina Benali",
  id: "2023-INF-042",
  diploma: "Licence Informatique",
  date: "2026-06-15",
  grade: "Mention Bien",
};

async function deployFixture() {
  const [owner, admin, stranger, recipient, recipient2] = await ethers.getSigners();
  const Registry = await ethers.getContractFactory("CertificateRegistry");
  const registry = await Registry.deploy(owner.address);
  await registry.waitForDeployment();
  return { registry, owner, admin, stranger, recipient, recipient2 };
}

describe("CertificateRegistry (Devoir 1)", () => {
  describe("Déploiement et administration", () => {
    it("définit le owner et aucun admin par défaut", async () => {
      const { registry, owner, admin } = await loadFixture(deployFixture);
      expect(await registry.owner()).to.equal(owner.address);
      expect(await registry.isAdmin(admin.address)).to.equal(false);
      expect(await registry.totalCertificates()).to.equal(0n);
    });

    it("refuse un owner nul", async () => {
      const Registry = await ethers.getContractFactory("CertificateRegistry");
      await expect(Registry.deploy(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(Registry, "OwnableInvalidOwner")
        .withArgs(ethers.ZeroAddress);
    });

    it("permet au owner d'ajouter et retirer un admin", async () => {
      const { registry, owner, admin } = await loadFixture(deployFixture);
      await expect(registry.connect(owner).setAdmin(admin.address, true))
        .to.emit(registry, "AdminUpdated")
        .withArgs(admin.address, true);
      expect(await registry.isAdmin(admin.address)).to.equal(true);

      await registry.connect(owner).setAdmin(admin.address, false);
      expect(await registry.isAdmin(admin.address)).to.equal(false);
    });

    it("interdit à un non-owner de gérer les admins", async () => {
      const { registry, stranger, admin } = await loadFixture(deployFixture);
      await expect(registry.connect(stranger).setAdmin(admin.address, true))
        .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount")
        .withArgs(stranger.address);
    });
  });

  describe("Émission unitaire", () => {
    it("émet un certificat et stocke les métadonnées", async () => {
      const { registry, owner, recipient } = await loadFixture(deployFixture);

      await expect(
        registry
          .connect(owner)
          .mintCertificate(
            recipient.address,
            STUDENT.name,
            STUDENT.id,
            STUDENT.diploma,
            STUDENT.date,
            STUDENT.grade,
          ),
      )
        .to.emit(registry, "CertificateMinted")
        .withArgs(1n, recipient.address, STUDENT.id, STUDENT.diploma, STUDENT.date);

      const certificate = await registry.getCertificate(1);
      expect(certificate.studentName).to.equal(STUDENT.name);
      expect(certificate.studentId).to.equal(STUDENT.id);
      expect(certificate.diplomaTitle).to.equal(STUDENT.diploma);
      expect(certificate.issueDate).to.equal(STUDENT.date);
      expect(certificate.grade).to.equal(STUDENT.grade);
      expect(certificate.recipient).to.equal(recipient.address);
      expect(certificate.revoked).to.equal(false);
      expect(await registry.totalCertificates()).to.equal(1n);
    });

    it("permet à un admin désigné d'émettre", async () => {
      const { registry, owner, admin, recipient } = await loadFixture(deployFixture);
      await registry.connect(owner).setAdmin(admin.address, true);
      await expect(
        registry
          .connect(admin)
          .mintCertificate(recipient.address, STUDENT.name, STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade),
      ).to.emit(registry, "CertificateMinted");
    });

    it("refuse un compte non autorisé", async () => {
      const { registry, stranger, recipient } = await loadFixture(deployFixture);
      await expect(
        registry
          .connect(stranger)
          .mintCertificate(recipient.address, STUDENT.name, STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade),
      )
        .to.be.revertedWithCustomError(registry, "NotAdmin")
        .withArgs(stranger.address);
    });

    it("refuse une adresse destinataire nulle", async () => {
      const { registry, owner } = await loadFixture(deployFixture);
      await expect(
        registry
          .connect(owner)
          .mintCertificate(ethers.ZeroAddress, STUDENT.name, STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade),
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });

    it("refuse les champs requis vides", async () => {
      const { registry, owner, recipient } = await loadFixture(deployFixture);
      await expect(
        registry.connect(owner).mintCertificate(recipient.address, "", STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade),
      )
        .to.be.revertedWithCustomError(registry, "EmptyField")
        .withArgs("studentName");

      await expect(
        registry.connect(owner).mintCertificate(recipient.address, STUDENT.name, STUDENT.id, STUDENT.diploma, "", STUDENT.grade),
      )
        .to.be.revertedWithCustomError(registry, "EmptyField")
        .withArgs("issueDate");
    });

    it("bloque le double enregistrement d'un studentId", async () => {
      const { registry, owner, recipient, recipient2 } = await loadFixture(deployFixture);
      await registry
        .connect(owner)
        .mintCertificate(recipient.address, STUDENT.name, STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade);

      await expect(
        registry
          .connect(owner)
          .mintCertificate(recipient2.address, "Autre Nom", STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade),
      )
        .to.be.revertedWithCustomError(registry, "DuplicateStudentId")
        .withArgs(STUDENT.id);
    });

    it("retrouve un certificat par studentId", async () => {
      const { registry, owner, recipient } = await loadFixture(deployFixture);
      await registry
        .connect(owner)
        .mintCertificate(recipient.address, STUDENT.name, STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade);

      expect(await registry.certificateIdByStudentId(STUDENT.id)).to.equal(1n);
      const certificate = await registry.getCertificateByStudentId(STUDENT.id);
      expect(certificate.recipient).to.equal(recipient.address);
      expect(await registry.certificateIdByStudentId("INCONNU")).to.equal(0n);
    });

    it("revert pour un certificat inexistant", async () => {
      const { registry } = await loadFixture(deployFixture);
      await expect(registry.getCertificate(99)).to.be.revertedWithCustomError(
        registry,
        "CertificateNotFound",
      );
      await expect(registry.getCertificateByStudentId("INCONNU")).to.be.revertedWithCustomError(
        registry,
        "CertificateNotFoundByStudentId",
      );
    });
  });

  describe("Batch", () => {
    it("émet plusieurs certificats en une transaction", async () => {
      const { registry, owner, recipient, recipient2 } = await loadFixture(deployFixture);
      const ids = ["2023-INF-001", "2023-INF-002"];
      const names = ["Etudiant Un", "Etudiant Deux"];
      const diplomas = ["Licence Informatique", "Licence Informatique"];
      const dates = ["2026-06-15", "2026-06-15"];
      const grades = ["Mention Bien", "Mention Passable"];

      await expect(
        registry
          .connect(owner)
          .batchMint([recipient.address, recipient2.address], names, ids, diplomas, dates, grades),
      )
        .to.emit(registry, "CertificateMinted")
        .withArgs(1n, recipient.address, ids[0], diplomas[0], dates[0]);

      expect(await registry.totalCertificates()).to.equal(2n);
      expect((await registry.getCertificate(2)).studentName).to.equal("Etudiant Deux");
    });

    it("refuse un batch vide", async () => {
      const { registry, owner } = await loadFixture(deployFixture);
      await expect(
        registry.connect(owner).batchMint([], [], [], [], [], []),
      ).to.be.revertedWithCustomError(registry, "EmptyBatch");
    });

    it("refuse des tableaux de tailles différentes", async () => {
      const { registry, owner, recipient } = await loadFixture(deployFixture);
      await expect(
        registry
          .connect(owner)
          .batchMint([recipient.address], [STUDENT.name], [STUDENT.id], [STUDENT.diploma], [STUDENT.date], []),
      ).to.be.revertedWithCustomError(registry, "LengthMismatch");
    });

    it("refuse un batch au-delà de la limite", async () => {
      const { registry, owner, recipient } = await loadFixture(deployFixture);
      const size = 51;
      const addresses = Array(size).fill(recipient.address);
      const names = Array.from({ length: size }, (_, i) => `Etudiant ${i}`);
      const ids = Array.from({ length: size }, (_, i) => `ID-${i}`);
      const diplomas = Array(size).fill("Licence");
      const dates = Array(size).fill("2026-06-15");
      const grades = Array(size).fill("Bien");

      await expect(
        registry.connect(owner).batchMint(addresses, names, ids, diplomas, dates, grades),
      )
        .to.be.revertedWithCustomError(registry, "BatchTooLarge")
        .withArgs(size, 50);
    });
  });

  describe("Révocation et pause", () => {
    it("révoque un certificat et bloque la double révocation", async () => {
      const { registry, owner, recipient } = await loadFixture(deployFixture);
      await registry
        .connect(owner)
        .mintCertificate(recipient.address, STUDENT.name, STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade);

      await expect(registry.connect(owner).revoke(1))
        .to.emit(registry, "CertificateRevoked")
        .withArgs(1n, owner.address);
      expect((await registry.getCertificate(1)).revoked).to.equal(true);

      await expect(registry.connect(owner).revoke(1))
        .to.be.revertedWithCustomError(registry, "AlreadyRevoked")
        .withArgs(1n);
    });

    it("interdit la révocation par un non-admin", async () => {
      const { registry, owner, stranger, recipient } = await loadFixture(deployFixture);
      await registry
        .connect(owner)
        .mintCertificate(recipient.address, STUDENT.name, STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade);
      await expect(registry.connect(stranger).revoke(1))
        .to.be.revertedWithCustomError(registry, "NotAdmin")
        .withArgs(stranger.address);
    });

    it("bloque l'émission quand le contrat est en pause", async () => {
      const { registry, owner, recipient } = await loadFixture(deployFixture);
      await registry.connect(owner).pause();
      await expect(
        registry
          .connect(owner)
          .mintCertificate(recipient.address, STUDENT.name, STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade),
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");

      await registry.connect(owner).unpause();
      await expect(
        registry
          .connect(owner)
          .mintCertificate(recipient.address, STUDENT.name, STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade),
      ).to.emit(registry, "CertificateMinted");
    });

    it("réserve pause/unpause au owner", async () => {
      const { registry, stranger } = await loadFixture(deployFixture);
      await expect(registry.connect(stranger).pause()).to.be.revertedWithCustomError(
        registry,
        "OwnableUnauthorizedAccount",
      );
    });
  });
});
