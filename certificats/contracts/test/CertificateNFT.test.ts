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

function decodeDataURI(uri: string): unknown {
  const [header, payload] = uri.split(",");
  expect(header).to.equal("data:application/json;base64");
  return JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
}

async function deployFixture() {
  const [admin, minter, stranger, alice, bob] = await ethers.getSigners();
  const NFT = await ethers.getContractFactory("CertificateNFT");
  const nft = await NFT.deploy(admin.address, true);
  await nft.waitForDeployment();
  await nft.connect(admin).grantRole(await nft.MINTER_ROLE(), minter.address);
  return { nft, admin, minter, stranger, alice, bob };
}

describe("CertificateNFT (Devoir 2)", () => {
  describe("Déploiement et rôles", () => {
    it("accorde les rôles admin et minter au déployeur", async () => {
      const { nft, admin } = await loadFixture(deployFixture);
      const minterRole = await nft.MINTER_ROLE();
      expect(await nft.hasRole(await nft.DEFAULT_ADMIN_ROLE(), admin.address)).to.equal(true);
      expect(await nft.hasRole(minterRole, admin.address)).to.equal(true);
      expect(await nft.soulbound()).to.equal(true);
      expect(await nft.totalCertificates()).to.equal(0n);
    });

    it("refuse un admin nul", async () => {
      const NFT = await ethers.getContractFactory("CertificateNFT");
      await expect(NFT.deploy(ethers.ZeroAddress, true)).to.be.revertedWithCustomError(
        NFT,
        "ZeroAddress",
      );
    });

    it("refuse le mint sans MINTER_ROLE", async () => {
      const { nft, stranger, alice } = await loadFixture(deployFixture);
      const minterRole = await nft.MINTER_ROLE();
      await expect(
        nft
          .connect(stranger)
          .mintCertificate(alice.address, STUDENT.name, STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade),
      )
        .to.be.revertedWithCustomError(nft, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, minterRole);
    });

    it("permet de révoquer un rôle minter", async () => {
      const { nft, admin, minter, alice } = await loadFixture(deployFixture);
      await nft.connect(admin).revokeRole(await nft.MINTER_ROLE(), minter.address);
      await expect(
        nft
          .connect(minter)
          .mintCertificate(alice.address, STUDENT.name, STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade),
      ).to.be.revertedWithCustomError(nft, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Émission et métadonnées", () => {
    it("émet un NFT et expose un tokenURI JSON on-chain", async () => {
      const { nft, minter, alice } = await loadFixture(deployFixture);

      await expect(
        nft
          .connect(minter)
          .mintCertificate(alice.address, STUDENT.name, STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade),
      )
        .to.emit(nft, "CertificateMinted")
        .withArgs(1n, alice.address, STUDENT.id, STUDENT.diploma, STUDENT.date);

      expect(await nft.ownerOf(1)).to.equal(alice.address);
      expect(await nft.tokenIdByStudentId(STUDENT.id)).to.equal(1n);

      const certificate = await nft.getCertificate(1);
      expect(certificate.studentName).to.equal(STUDENT.name);
      expect(certificate.studentId).to.equal(STUDENT.id);
      expect(certificate.grade).to.equal(STUDENT.grade);
      expect(certificate.recipient).to.equal(alice.address);
      expect(certificate.revoked).to.equal(false);

      const metadata = decodeDataURI(await nft.tokenURI(1)) as {
        name: string;
        attributes: Array<{ trait_type: string; value: string }>;
      };
      expect(metadata.name).to.contain(STUDENT.diploma);
      expect(metadata.name).to.contain(STUDENT.name);
      expect(metadata.attributes.find((a) => a.trait_type === "Statut")?.value).to.equal("Valide");
      expect(metadata.attributes.find((a) => a.trait_type === "Identifiant")?.value).to.equal(STUDENT.id);
    });

    it("échappe les guillemets dans les métadonnées", async () => {
      const { nft, minter, alice } = await loadFixture(deployFixture);
      await nft
        .connect(minter)
        .mintCertificate(
          alice.address,
          'Etudiant "Quote"',
          "ID-QUOTE",
          "Diplôme \\ Spécial",
          "2026-06-15",
          "Bien",
        );
      const metadata = decodeDataURI(await nft.tokenURI(1)) as { name: string };
      expect(metadata.name).to.contain('Etudiant "Quote"');
    });

    it("bloque le double studentId", async () => {
      const { nft, minter, alice, bob } = await loadFixture(deployFixture);
      await nft
        .connect(minter)
        .mintCertificate(alice.address, STUDENT.name, STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade);
      await expect(
        nft
          .connect(minter)
          .mintCertificate(bob.address, "Autre", STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade),
      )
        .to.be.revertedWithCustomError(nft, "DuplicateStudentId")
        .withArgs(STUDENT.id);
    });

    it("valide les entrées", async () => {
      const { nft, minter, alice } = await loadFixture(deployFixture);
      await expect(
        nft
          .connect(minter)
          .mintCertificate(ethers.ZeroAddress, STUDENT.name, STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade),
      ).to.be.revertedWithCustomError(nft, "ZeroAddress");

      await expect(
        nft
          .connect(minter)
          .mintCertificate(alice.address, "", STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade),
      )
        .to.be.revertedWithCustomError(nft, "EmptyField")
        .withArgs("studentName");
    });

    it("retourne un tokenURI vide/non existant en revert", async () => {
      const { nft } = await loadFixture(deployFixture);
      await expect(nft.tokenURI(99)).to.be.revertedWithCustomError(nft, "ERC721NonexistentToken");
      await expect(nft.getCertificate(99)).to.be.revertedWithCustomError(nft, "ERC721NonexistentToken");
      expect(await nft.tokenIdByStudentId("INCONNU")).to.equal(0n);
    });

    it("expose un contractURI", async () => {
      const { nft } = await loadFixture(deployFixture);
      const uri = await nft.contractURI();
      expect(uri).to.match(/^data:application\/json;base64,/);
      const metadata = decodeDataURI(uri) as { name: string };
      expect(metadata.name).to.equal("Certificats Academiques");
    });
  });

  describe("Batch", () => {
    it("émet un batch complet avec données", async () => {
      const { nft, minter, alice, bob } = await loadFixture(deployFixture);
      await nft.connect(minter).batchMintCertificatesWithData(
        [alice.address, bob.address],
        ["Alice", "Bob"],
        ["ID-A", "ID-B"],
        ["Licence", "Master"],
        ["2026-06-15", "2026-06-16"],
        ["Bien", "Passable"],
      );
      expect(await nft.totalCertificates()).to.equal(2n);
      expect((await nft.getCertificate(2)).studentName).to.equal("Bob");
    });

    it("émet un batch de type URI (signature du sujet)", async () => {
      const { nft, minter, alice } = await loadFixture(deployFixture);
      const uri = "ipfs://bafy-test-certificat";
      await nft.connect(minter).batchMintCertificates([alice.address], [uri]);
      expect(await nft.tokenURI(1)).to.equal(uri);
      expect(await nft.ownerOf(1)).to.equal(alice.address);
    });

    it("refuse les batchs invalides", async () => {
      const { nft, minter, alice } = await loadFixture(deployFixture);
      await expect(
        nft.connect(minter).batchMintCertificatesWithData([], [], [], [], [], []),
      ).to.be.revertedWithCustomError(nft, "EmptyBatch");

      await expect(
        nft.connect(minter).batchMintCertificates([alice.address], []),
      ).to.be.revertedWithCustomError(nft, "LengthMismatch");

      const size = 51;
      const addresses = Array(size).fill(alice.address);
      const uris = Array(size).fill("ipfs://x");
      await expect(
        nft.connect(minter).batchMintCertificates(addresses, uris),
      )
        .to.be.revertedWithCustomError(nft, "BatchTooLarge")
        .withArgs(size, 50);
    });
  });

  describe("Révocation", () => {
    it("révoque avec le rôle admin et met à jour les métadonnées", async () => {
      const { nft, admin, minter, alice } = await loadFixture(deployFixture);
      await nft
        .connect(minter)
        .mintCertificate(alice.address, STUDENT.name, STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade);

      await expect(nft.connect(admin).revokeCertificate(1))
        .to.emit(nft, "CertificateRevoked")
        .withArgs(1n, admin.address);

      expect((await nft.getCertificate(1)).revoked).to.equal(true);
      const metadata = decodeDataURI(await nft.tokenURI(1)) as {
        attributes: Array<{ trait_type: string; value: string }>;
      };
      expect(metadata.attributes.find((a) => a.trait_type === "Statut")?.value).to.equal("Revoque");

      await expect(nft.connect(admin).revokeCertificate(1))
        .to.be.revertedWithCustomError(nft, "AlreadyRevoked")
        .withArgs(1n);
    });

    it("interdit la révocation par un simple minter", async () => {
      const { nft, minter, alice } = await loadFixture(deployFixture);
      await nft
        .connect(minter)
        .mintCertificate(alice.address, STUDENT.name, STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade);
      await expect(nft.connect(minter).revokeCertificate(1))
        .to.be.revertedWithCustomError(nft, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Soulbound et pause", () => {
    it("bloque les transferts et les approbations", async () => {
      const { nft, minter, alice, bob } = await loadFixture(deployFixture);
      await nft
        .connect(minter)
        .mintCertificate(alice.address, STUDENT.name, STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade);

      await expect(nft.connect(alice).transferFrom(alice.address, bob.address, 1))
        .to.be.revertedWithCustomError(nft, "TransferNotAllowed")
        .withArgs(1n);
      await expect(nft.connect(alice).approve(bob.address, 1)).to.be.revertedWithCustomError(
        nft,
        "ApprovalsDisabled",
      );
      await expect(nft.connect(alice).setApprovalForAll(bob.address, true)).to.be.revertedWithCustomError(
        nft,
        "ApprovalsDisabled",
      );
    });

    it("autorise le transfert si soulbound est désactivé", async () => {
      const [admin, minter, , alice, bob] = await ethers.getSigners();
      const NFT = await ethers.getContractFactory("CertificateNFT");
      const nft = await NFT.deploy(admin.address, false);
      await nft.waitForDeployment();
      await nft.connect(admin).grantRole(await nft.MINTER_ROLE(), minter.address);
      await nft
        .connect(minter)
        .mintCertificate(alice.address, STUDENT.name, STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade);

      await nft.connect(alice).transferFrom(alice.address, bob.address, 1);
      expect(await nft.ownerOf(1)).to.equal(bob.address);
    });

    it("bloque le mint quand le contrat est en pause", async () => {
      const { nft, admin, minter, alice } = await loadFixture(deployFixture);
      await nft.connect(admin).pause();
      await expect(
        nft
          .connect(minter)
          .mintCertificate(alice.address, STUDENT.name, STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade),
      ).to.be.revertedWithCustomError(nft, "EnforcedPause");
      await nft.connect(admin).unpause();
      await expect(
        nft
          .connect(minter)
          .mintCertificate(alice.address, STUDENT.name, STUDENT.id, STUDENT.diploma, STUDENT.date, STUDENT.grade),
      ).to.emit(nft, "CertificateMinted");
    });

    it("refuse pause à un non-admin", async () => {
      const { nft, minter } = await loadFixture(deployFixture);
      await expect(nft.connect(minter).pause()).to.be.revertedWithCustomError(
        nft,
        "AccessControlUnauthorizedAccount",
      );
    });
  });

  describe("Sécurité", () => {
    it("protège le mint contre la reentrancy via onERC721Received", async () => {
      const { nft, admin } = await loadFixture(deployFixture);
      const Receiver = await ethers.getContractFactory("ReentrantMinter");
      const receiver = await Receiver.deploy(await nft.getAddress());
      await receiver.waitForDeployment();
      await nft.connect(admin).grantRole(await nft.MINTER_ROLE(), await receiver.getAddress());

      await expect(
        nft
          .connect(admin)
          .mintCertificate(
            await receiver.getAddress(),
            "Reentrant",
            "REENTRANT-ROOT",
            "Diplome",
            "2026-01-01",
            "Aucune",
          ),
      ).to.be.reverted;

      expect(await nft.totalCertificates()).to.equal(0n);
    });

    it("supporte les interfaces ERC-721 et AccessControl", async () => {
      const { nft } = await loadFixture(deployFixture);
      expect(await nft.supportsInterface("0x80ac58cd")).to.equal(true);
      expect(await nft.supportsInterface("0x7965db0b")).to.equal(true);
      expect(await nft.supportsInterface("0xffffffff")).to.equal(false);
    });
  });
});
