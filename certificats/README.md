# Certificats académiques sur blockchain

Système complet de certification académique vérifiable, construit en deux étapes :

- **Devoir 1** — registre custom `CertificateRegistry` : émission unitaire, batch, import Excel, vérification publique.
- **Devoir 2** — migration vers **ERC-721** (`CertificateNFT`) avec OpenZeppelin, `AccessControl`, métadonnées on-chain et rapport d'audit.

Une seule application React permet de basculer entre les deux contrats (`v1 · registre` / `v2 · erc-721`).

```text
certificats/
├── contracts/                 Hardhat + TypeScript + OpenZeppelin 5
│   ├── contracts/
│   │   ├── CertificateRegistry.sol      Devoir 1
│   │   ├── CertificateNFT.sol           Devoir 2 (ERC-721)
│   │   └── mocks/ReentrantMinter.sol    test de reentrancy
│   ├── test/                  41 tests Hardhat
│   ├── scripts/               deploy, seed, export ABI, génération Excel
│   └── deployments/           adresses par chainId
├── frontend/                  Vite + React + TypeScript
│   └── src/                   shadcn/ui, wagmi/viem, SheetJS
├── data/
│   ├── etudiants.json         source des données d'exemple
│   ├── etudiants.xlsx         8 lignes (déjà émises par le seed + 1 doublon)
│   ├── etudiants-import.json  source du fichier de démo
│   └── etudiants-import.xlsx  5 lignes dont 4 identifiants neufs (démo en direct)
├── docs/
│   ├── devoir1.md             choix de conception du registre
│   ├── audit-report.md        rapport d'audit du Devoir 2
│   ├── presentation-guide.md  aide pour la soutenance (scénarios de démo)
│   └── latex/                 rapports PDF des deux devoirs (sources .tex)
└── package.json               npm workspaces
```

---

## Stack

| Couche | Choix |
|---|---|
| Contrats | Solidity 0.8.24, Hardhat 2, OpenZeppelin 5 |
| Frontend | React 18, Vite 6, TypeScript, Tailwind CSS |
| UI | shadcn/ui (style new-york), Radix, lucide-react |
| Web3 | wagmi 2, viem 2, React Query |
| Excel | SheetJS (`xlsx`) — parsing 100 % côté client |
| Design | dark only, accent `#22C55E`, Inter + Satoshi |

---

## Démarrage rapide

Prérequis : Node.js ≥ 20, npm ≥ 10, MetaMask (optionnel pour la vérification publique).

```bash
cd certificats
npm install
```

Trois terminaux :

```bash
# 1 — nœud Hardhat local (chainId 31337)
npm run node

# 2 — déploiement des deux contrats + export des adresses/ABI
npm run deploy:local
npm run seed:local          # émission de 7 certificats de démonstration

# 3 — frontend
npm run dev
```

Ouvrir <http://localhost:5173>.

Le déploiement écrit les adresses dans `contracts/deployments/31337.json` **et** dans
`frontend/src/contracts/deployments.json`, puis génère `frontend/src/contracts/abis.ts`.
Le frontend n'a donc aucune adresse codée en dur.

### Déploiement local de référence

Adresses déterministes obtenues sur un nœud Hardhat neuf (compte #0 comme déployeur) :

| Contrat | Adresse | Bloc |
|---|---|---|
| `CertificateRegistry` (v1) | `0x5FbDB2315678afecb367f032d93F642f64180aa3` | 1 |
| `CertificateNFT` (v2) | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` | 2 |

Les 7 certificats de démonstration sont émis par `npm run seed:local` :

```text
v1 CertificateRegistry : 7 certificats — tx 0xd44ffcafece30d826e8546eaf8c851c4f71ffed5a2595c4661643880e116c32d
v2 CertificateNFT      : 7 certificats — tx 0x231da73409cd21eba5081094efc982be10b6437b44278dfe31577fcfd5610f2b
```

Vérification rapide post-déploiement :

```bash
cd contracts
npx hardhat run scripts/smoke.ts --network localhost
```


### Ajouter le réseau local à MetaMask

Dans le frontend : menu réseau → **Ajouter Hardhat à MetaMask**, ou manuellement :

| Champ | Valeur |
|---|---|
| RPC | `http://127.0.0.1:8545` |
| chainId | `31337` |
| Symbole | ETH |

Importer un compte de test Hardhat avec sa clé privée affichée par `npm run node`
(compte #0 = owner/admin, comptes #1–#7 = destinataires).

Le bouton « Connecter » attend un wallet injecté (`window.ethereum`). Sans
extension MetaMask ou Brave Wallet dans le navigateur, il affiche désormais un
message explicite au lieu de l'erreur brute `Provider not found` de wagmi.
La page `/verify` n'a pas besoin de wallet : elle lit directement le RPC.

---

## Modèle Excel

Colonnes attendues dans la première feuille (les alias français sont acceptés) :

| Colonne | Exemple | Obligatoire |
|---|---|---|
| `studentName` | Amina Benali | oui |
| `studentId` | 2023-INF-042 | oui |
| `diplomaTitle` | Licence Informatique | oui |
| `issueDate` | 2026-06-15 | oui (ISO) |
| `recipientAddress` | 0x7099…79C8 | non (défaut : wallet connecté) |
| `grade` | Mention Bien | non |

Le fichier `data/etudiants.xlsx` contient 8 lignes, dont une **duplicate volontaire**
de `2023-INF-042` pour démontrer la validation. Ses 7 identifiants sont déjà émis par
`seed:local` : toutes les lignes sont donc marquées « déjà émis » après le seed.

Pour une émission en direct, utilise `data/etudiants-import.xlsx` (bouton
« Démo (nouveaux ID) » dans l'écran d'import) : 4 identifiants `2026-DEMO-00x` neufs
et un doublon volontaire dans le fichier.

La colonne diplôme est optionnelle et n'apparaît plus dans l'aperçu d'import. Si
elle est absente, le frontend envoie « Diplôme académique » au contrat.

Validation côté client avant toute transaction :

- colonnes et champs requis ;
- dates ISO (ou `JJ/MM/AAAA`) ;
- adresses via `isAddress` + checksum ;
- doublons dans le fichier ;
- doublons déjà enregistrés on-chain (`certificateIdByStudentId` / `tokenIdByStudentId`) ;
- studentId normalisé en majuscules avant envoi.

---

## Utilisation

### Émission unitaire (`/admin` → Émission unitaire)

Tous les champs du certificat, adresse du destinataire (bouton « Mon adresse »), hash de
transaction affiché après confirmation.

### Import Excel (`/admin` → Import Excel)

1. Déposer un `.xlsx`, `.xls` ou `.csv` ;
2. vérifier l'aperçu et décocher les lignes à exclure ;
3. choisir **une transaction batch** ou **des lots séquentiels de 5 / 10 / 15** ;
4. confirmer, suivre la progression et récupérer le hash de chaque lot.

Le contrat plafonne chaque transaction à **50 certificats**. En mode séquentiel, un échec
n'annule pas les lots précédents (comportement documenté dans le rapport d'audit).

### Vérification publique (`/verify`)

- recherche par **certId / tokenId** ou par **studentId** ;
- interrogation des deux contrats (v1 et v2) en parallèle ;
- statut valide / révoqué, tokenURI décodé, QR code, lien partageable ;
- fonctionne **sans wallet** via le RPC configuré.

### Audit (`/audit`)

Checklist appliquée, vulnérabilités recherchées, résultats des tests, risques résiduels
et recommandations. Rapport complet : [`docs/audit-report.md`](docs/audit-report.md).

### Rapports LaTeX

Deux rapports de devoir en français, avec les sources et les PDF générés :

- [`docs/latex/devoir1.pdf`](docs/latex/devoir1.pdf) ---
  registre, import Excel et vérification ;
- [`docs/latex/devoir2.pdf`](docs/latex/devoir2.pdf) ---
  migration ERC-721, sécurité et audit.

### Soutenance

[`docs/presentation-guide.md`](docs/presentation-guide.md) : explication du projet,
rôle de chaque écran, scénarios de démonstration, commandes, repères et réponses
aux questions probables du professeur.

---

## Contrats

### `CertificateRegistry` (v1)

| Fonction | Accès | Description |
|---|---|---|
| `mintCertificate(...)` | owner / admin | émet un certificat, retourne `certId` |
| `batchMint(...)` | owner / admin | 1–50 certificats en une transaction |
| `getCertificate(certId)` | lecture | struct complète |
| `getCertificateByStudentId(id)` | lecture | recherche par CNE |
| `certificateIdByStudentId(id)` | lecture | retourne 0 si absent |
| `revoke(certId)` | owner / admin | flag + event, pas de suppression |
| `setAdmin(account, bool)` | owner | gestion des admins |
| `pause()` / `unpause()` | owner | blocage des émissions |

### `CertificateNFT` (v2)

| Fonction | Accès | Description |
|---|---|---|
| `mintCertificate(...)` | `MINTER_ROLE` | mint ERC-721 + métadonnées |
| `batchMintCertificates(to[], uris[])` | `MINTER_ROLE` | signature du sujet (URI précalculées) |
| `batchMintCertificatesWithData(...)` | `MINTER_ROLE` | batch complet utilisé par Excel |
| `getCertificate(tokenId)` | lecture | struct complète |
| `tokenURI(tokenId)` | lecture | JSON base64 généré on-chain |
| `revokeCertificate(tokenId)` | `DEFAULT_ADMIN_ROLE` | flag + event |
| `grantRole` / `revokeRole` | admin | gestion des rôles |
| `pause()` / `unpause()` | `DEFAULT_ADMIN_ROLE` | blocage des mints |

Propriétés : `ERC721URIStorage`, `AccessControl`, `Pausable`, `ReentrancyGuard`,
`soulbound` (transferts et approbations bloqués par défaut, désactivable au déploiement).

Events : `CertificateMinted(tokenId indexed, recipient indexed, …)`,
`CertificateRevoked(tokenId indexed, revokedBy indexed)`.

---

## Scripts

Depuis `certificats/` :

| Commande | Effet |
|---|---|
| `npm test` | 41 tests Hardhat |
| `npm run compile` | compile les contrats |
| `npm run node` | nœud Hardhat local |
| `npm run deploy:local` | déploie v1 + v2, exporte ABI et adresses |
| `npm run seed:local` | émet les certificats d'exemple |
| `npm run excel` | régénère les deux `.xlsx` et les copie dans `frontend/public/` |
| `npm run export` | régénère `frontend/src/contracts/abis.ts` |
| `npm run dev` | serveur Vite |
| `npm run build` | typecheck + build de production |
| `npm run typecheck` | `tsc --noEmit` |

---

## Déploiement Sepolia (optionnel)

```bash
cd certificats/contracts
cp .env.example .env
# renseigner SEPOLIA_RPC_URL, PRIVATE_KEY (compte de test financé), ETHERSCAN_API_KEY

npm run deploy:sepolia
npm run export
```

Puis vérifier les contrats :

```bash
npx hardhat verify --network sepolia <ADRESSE_REGISTRY> <DEPLOYEUR>
npx hardhat verify --network sepolia <ADRESSE_NFT> <DEPLOYEUR> true
```

Le frontend lit `deployments/11155111.json` et propose Sepolia dans le sélecteur de réseau.
Aucune clé privée n'est utilisée côté frontend : seules les transactions MetaMask sont signées.

---

## Design

- dark mode uniquement, fond `#0A0A0A`, cartes `#0E0E0E`, bordures `#1F1F1F` ;
- accent unique `#22C55E` (primary, focus, statuts valides) ;
- **Inter** en texte (Fontsource variable) et **Satoshi** en titres (woff2 auto-hébergés) ;
- composants shadcn/ui, grille de fond subtile, labels mono, micro-animations sobres ;
- `prefers-reduced-motion` respecté, navigation clavier et focus visibles.

---

## Limites connues

- Audit pédagogique, pas une certification professionnelle.
- Slither et fuzzing Foundry non exécutés (documenté).
- Le mode séquentiel d'import n'est pas atomique.
- Les très longues chaînes ne sont pas bornées on-chain (coût de gas).
- Aucune adresse Sepolia n'est fournie dans ce dépôt : le déploiement local est la référence.

Voir [`docs/audit-report.md`](docs/audit-report.md) pour la liste complète des risques résiduels.

---

## Captures de démonstration

Après un déploiement local et `npm run seed:local`, le serveur de prévisualisation
(`npm run build` puis `npm run preview -w frontend -- --port 4173`) permet de capturer
les écrans :

```powershell
cd certificats
.\scripts\screenshots.ps1
```

Les images sont écrites dans `docs/screenshots/` :

| Fichier | Écran |
|---|---|
| `01-accueil.png` | accueil, compteurs v1/v2 et adresses |
| `02-admin.png` | espace d'émission |
| `03-verify-id.png` | vérification du certificat `#1` |
| `04-verify-student.png` | vérification par `2023-INF-042` |
| `05-audit.png` | page d'audit |

Ces captures sont générées automatiquement à partir du déploiement local de référence
(voir ci-dessus) : aucun contenu n'est simulé.
