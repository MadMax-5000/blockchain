# CityTrace — signalements urbains on-chain

CityTrace est une application décentralisée de suivi des signalements urbains. Un
citoyen déclare un problème, un agent municipal affecte une équipe, puis fait
avancer le dossier le long d'une chaîne de statuts strictement séquentielle.
Chaque étape est horodatée, signée par une adresse MetaMask et consultable par
tous. Il n'y a ni base de données ni serveur applicatif : la source de vérité est
le contrat `UrbanIssueRegistry` déployé sur une blockchain locale Hardhat.

> Toutes les données sont fictives : pseudonymes (`Citizen01`), équipes
> (`UrbanTeam01`), quartiers et identifiants `CITY-2026-*`. Aucune donnée
> personnelle réelle n'est stockée on-chain.

---

## Structure

```text
smartcity/
├── contracts/                       Hardhat 2 + TypeScript + OpenZeppelin 5
│   ├── contracts/
│   │   └── UrbanIssueRegistry.sol   registre unique du mini-projet
│   ├── test/
│   │   └── UrbanIssueRegistry.test.ts   31 tests
│   ├── scripts/
│   │   ├── deploy.ts                déploiement + export ABI/adresses
│   │   ├── seed.ts                  8 signalements fictifs
│   │   ├── smoke.ts                 vérification post-déploiement
│   │   ├── export-frontend.ts       génère src/contracts/abis.ts
│   │   └── generate-excel.ts        génère les deux classeurs de démo
│   └── deployments/31337.json       adresse locale par chainId
├── frontend/                        Vite 6 + React 18 + TypeScript
│   └── src/
│       ├── pages/                   tableau de bord, déclaration, liste, détail,
│       │                            espace municipal, import, 404
│       ├── components/              shell, tableaux, historique, import Excel
│       ├── hooks/                   lecture contrat, rôles, actions, réseau
│       ├── lib/                     types, parsing Excel, erreurs, contrats
│       └── contracts/               ABI et adresses générés (ne pas éditer)
├── data/
│   ├── urban_issues.json            8 signalements du seed
│   ├── urban_issues-import.json     8 lignes propres pour la démo
│   ├── urban_issues.xlsx            10 lignes dont 5 erreurs volontaires
│   └── urban_issues-import.xlsx     8 lignes valides, identifiants 101–108
├── docs/
│   ├── demo-script.md               scénario de démonstration 7–8 min
│   └── screenshots/                 captures desktop, tablette et mobile
└── package.json                     npm workspaces
```

---

## Stack

| Couche | Choix |
|---|---|
| Contrat | Solidity 0.8.24, Hardhat 2, OpenZeppelin 5 (`AccessControl`, `Pausable`, `ReentrancyGuard`) |
| Tests | Hardhat + Chai, 31 tests |
| Frontend | React 18, Vite 6, TypeScript, Tailwind CSS |
| Web3 | wagmi 2, viem 2, React Query, MetaMask injecté |
| Excel | SheetJS (`xlsx`) — lecture 100 % côté navigateur |
| Design | fond noir `#000000`, accent sky `#38BDF8`, Inter + monospace, style « data terminal » |

---

## Démarrage rapide

Prérequis : Node.js ≥ 20, npm ≥ 10, MetaMask.

```bash
cd smartcity
npm install
```

Trois terminaux :

```bash
# 1 — nœud Hardhat local (chainId 31337)
npm run node

# 2 — déploiement, seed et vérification
npm run deploy:local
npm run seed:local
npm run smoke:local

# 3 — frontend
npm run dev
```

Ouvrir <http://localhost:5173>. Le déploiement écrit l'adresse dans
`contracts/deployments/31337.json` **et** dans
`frontend/src/contracts/deployments.json`, puis régénère `abis.ts`. Le frontend
ne contient donc aucune adresse codée en dur.

### Déploiement local de référence

Obtenu sur un nœud Hardhat neuf, compte #0 comme déployeur :

| Élément | Valeur |
|---|---|
| Réseau | Hardhat local, chainId `31337`, RPC `http://127.0.0.1:8545` |
| `UrbanIssueRegistry` | `0x5FbDB2315678afecb367f032d93F642f64180aa3` (bloc 1) |
| Compte admin / agent | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| Clé privée du compte #0 | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |

La clé ci-dessus appartient au jeu de comptes public Hardhat : elle ne doit
jamais être utilisée sur un réseau réel et n'est pas présente dans le frontend.

Résultat du `smoke:local` de référence : `totalIssues = 8`, identifiants
`CITY-2026-001` … `CITY-2026-008`, 8 `IssueCreated`, 6 `IssueAssigned`,
13 `IssueStatusUpdated`, et 5 entrées d'historique sur `CITY-2026-005` (clos).

### MetaMask

1. Réseau : ajouter `http://127.0.0.1:8545`, chainId `31337`, symbole ETH.
   Le menu réseau de l'application propose aussi **Ajouter Hardhat à MetaMask**.
2. Compte : importer le compte #0 avec la clé ci-dessus. C'est le compte qui
   détient `DEFAULT_ADMIN_ROLE` et `AGENT_ROLE`.
3. Connecter le wallet depuis le bouton en haut à droite.

Sans wallet connecté, la consultation publique fonctionne quand même : les pages
`/`, `/issues` et `/issues/:id` lisent directement le RPC.

---

## Contrat

`UrbanIssueRegistry` stocke chaque signalement dans un mapping indexé par
`keccak256(issueId)` et conserve un tableau d'identifiants pour la pagination.
Les rôles sont accordés au déployeur dans le constructeur.

| Fonction | Accès | Effet |
|---|---|---|
| `createIssue(IssueInput)` | tout compte, contrat non en pause | crée un signalement au statut `Reported`, histoire initiale |
| `batchCreateIssues(IssueInput[])` | `AGENT_ROLE` | import de 1 à 50 signalements en une transaction |
| `assignTeam(id, team, comment)` | `AGENT_ROLE` | affecte une équipe et fait passer `Reported → Assigned` |
| `updateStatus(id, status, comment)` | `AGENT_ROLE` | avance d'exactement une étape dans la chaîne |
| `getIssue(id)` / `getHistory(id)` | lecture | fiche complète / historique horodaté |
| `getIssueIds(offset, limit)` | lecture | pagination de 100 identifiants maximum |
| `issueExists(id)` | lecture | existence d'un identifiant |
| `pause()` / `unpause()` | `DEFAULT_ADMIN_ROLE` | blocage des écritures, lecture conservée |

Chaîne de statuts :

```text
Reported → Assigned → InProgress → Resolved → Closed
```

Un saut d'étape, un retour en arrière ou une affectation sans équipe sont
rejetés par le contrat (`InvalidStatusTransition`, `TeamRequired`).
Une équipe ne peut plus être changée après `Resolved`.

Événements : `IssueCreated`, `IssueAssigned`, `IssueStatusUpdated`,
`IssueHistoryAdded`. Erreurs custom : `IssueAlreadyExists`, `IssueNotFound`,
`EmptyField`, `StringTooLong`, `TeamRequired`, `InvalidStatusTransition`,
`TeamChangeNotAllowed`, `EmptyBatch`, `BatchTooLarge`.

Sécurité : `AccessControl` pour les rôles, `Pausable` pour arrêt d'urgence,
`ReentrancyGuard` sur les écritures, aucune réception d'ETH, aucun appel externe.
Longueurs bornées : identifiant 64 octets, champs courts 128, description 512.

---

## Modèle Excel

Colonnes exactes attendues dans la première feuille (alias français acceptés) :

| Colonne | Exemple | Règle |
|---|---|---|
| `issueId` | `CITY-2026-101` | obligatoire, unique, normalisé en majuscules |
| `issueType` | `StreetLight` | obligatoire (texte libre) |
| `location` | `Avenue Mohammed V, Rabat` | obligatoire |
| `description` | `Lampadaire hors service` | obligatoire |
| `reportDate` | `2026-11-20` | obligatoire, ISO ou `JJ/MM/AAAA`, date réelle |
| `priority` | `High` | `Low`, `Medium`, `High`, `Critical` |
| `reportedBy` | `Citizen101` | obligatoire, pseudonyme uniquement |
| `assignedTo` | `UrbanTeam01` | obligatoire si le statut n'est pas `Reported` |
| `status` | `Reported` | `Reported`, `Assigned`, `InProgress`, `Resolved`, `Closed` |

Deux classeurs sont fournis et téléchargeables depuis l'écran d'import :

- `urban_issues-import.xlsx` : 8 lignes valides (`CITY-2026-101` à `108`) pour
  une démonstration réussie ;
- `urban_issues.xlsx` : 10 lignes avec un doublon, une priorité `Urgent`, une
  localisation vide, un statut `EnCours`, une date `2026-13-45` et une
  description vide : sert à montrer la validation bloquante.

La validation est effectuée dans le navigateur avant toute signature :
en-têtes, champs requis, dates, énumérations, doublons dans le fichier et
doublons déjà présents on-chain. Les lignes invalides ne peuvent pas être
sélectionnées. Le lot est plafonné à 50 lignes, comme dans le contrat.

---

## Écrans

| Route | Rôle |
|---|---|
| `/` | compteurs en direct, distribution par statut, derniers signalements, adresse du contrat |
| `/report` | formulaire de déclaration citoyenne, statut initial `Reported` |
| `/issues` | liste publique, filtres par statut et recherche plein texte |
| `/issues/:issueId` | fiche, chaîne de progression, détails et historique complet |
| `/admin` | espace agent : rôle, pause, affectation d'équipe, avancement, historique |
| `/admin/import` | import Excel avec aperçu, validation, sélection et signature par lot |

Les erreurs de transaction sont traduites : rejet MetaMask, mauvais réseau, solde
insuffisant, rôle manquant, doublon, transition interdite, pause, lot invalide.

---

## Commandes

Depuis `smartcity/` :

| Commande | Effet |
|---|---|
| `npm test` | 31 tests Hardhat |
| `npm run compile` | compile les contrats |
| `npm run node` | nœud Hardhat local |
| `npm run deploy:local` | déploie le registre et exporte ABI + adresse |
| `npm run seed:local` | crée les 8 signalements fictifs |
| `npm run smoke:local` | vérifie comptes, historique et événements |
| `npm run excel` | régénère les deux `.xlsx` et les copie dans `frontend/public/` |
| `npm run export` | régénère `frontend/src/contracts/abis.ts` |
| `npm run dev` | serveur Vite sur `http://localhost:5173` |
| `npm run build` | typecheck + build de production |
| `npm run typecheck` | `tsc --noEmit` |

---

## Captures

Les captures ont été prises sur le build de production alimenté par le nœud
local de référence, sans donnée simulée :

| Fichier | Écran |
|---|---|
| [`docs/screenshots/01-tableau-de-bord.jpg`](docs/screenshots/01-tableau-de-bord.jpg) | tableau de bord, 8 signalements |
| [`docs/screenshots/02-nouveau-signalement.jpg`](docs/screenshots/02-nouveau-signalement.jpg) | déclaration citoyenne |
| [`docs/screenshots/03-liste-signalements.jpg`](docs/screenshots/03-liste-signalements.jpg) | liste et filtres |
| [`docs/screenshots/04-detail-historique.jpg`](docs/screenshots/04-detail-historique.jpg) | fiche `CITY-2026-005`, 5 entrées d'historique |
| [`docs/screenshots/05-espace-municipal.jpg`](docs/screenshots/05-espace-municipal.jpg) | gestion agent |
| [`docs/screenshots/06-import-excel.jpg`](docs/screenshots/06-import-excel.jpg) | import Excel |
| [`docs/screenshots/07-tablette.jpg`](docs/screenshots/07-tablette.jpg) | tablette 768 px |
| [`docs/screenshots/08-mobile.jpg`](docs/screenshots/08-mobile.jpg) | mobile 390 px |

---

## Limites connues

- Projet pédagogique : audit de sécurité professionnel non réalisé (Slither,
  fuzzing Foundry non exécutés).
- Aucune adresse Sepolia n'est fournie : le déploiement local est la référence.
- Le contrat stocke des pseudonymes, pas des identités : ce n'est pas un système
  de gestion de données personnelles conforme RGPD.
- `getIssueIds` est plafonné à 100 par appel ; le frontend charge les 500
  premiers signalements, suffisant pour la démo.
- Le lot Excel est atomique : un identifiant déjà utilisé fait échouer tout le
  lot, ce qui est le comportement voulu.

Scénario de présentation : [`docs/demo-script.md`](docs/demo-script.md).
