# Aide de présentation — Certify

Ce document est une feuille de route pour la soutenance. Il est écrit comme si tu
parlais au prof : phrases courtes, gestes à faire, résultats attendus.

---

## 1. Ce que c'est (30 secondes)

> « J'ai construit un système de certificats académiques vérifiables sur blockchain.
> Le Devoir 1 pose un registre simple : les données du certificat sont stockées
> directement dans un contrat Solidity, avec émission à l'unité, import Excel et
> vérification publique. Le Devoir 2 reprend la même idée mais sous forme de NFT
> ERC-721 avec OpenZeppelin : rôles d'émission, métadonnées générées on-chain,
> non-transférable par défaut et un petit audit de sécurité. Il n'y a ni base de
> données ni serveur à faire confiance : la vérité est dans les deux contrats. »

Le produit s'appelle **Certify**. C'est une seule application React qui sait
parler aux deux contrats. Le sélecteur en haut à gauche de l'en-tête permet de
passer de `v1 · registre` à `v2 · erc-721`.

---

## 2. Les pièces, concrètement

| Pièce | Où c'est | Ce que c'est | Comment je le lance |
|---|---|---|---|
| Nœud Hardhat | `contracts/` | Une blockchain locale sur `127.0.0.1:8545`, chainId `31337`. Elle donne 20 comptes de test avec de l'ETH gratuit. | `npm run node` (terminal 1) |
| Contrats | `contracts/contracts/` | `CertificateRegistry.sol` (Devoir 1) et `CertificateNFT.sol` (Devoir 2). Ce sont les deux programmes déployés on-chain. | `npm run deploy:local` (terminal 2) |
| Données d'exemple | `data/etudiants.xlsx` | 8 lignes d'étudiants, avec un doublon volontaire sur `2023-INF-042` pour montrer la validation. | téléchargeable depuis l'accueil |
| Frontend | `frontend/` | React + Vite + shadcn/ui. Trois écrans utiles : accueil, admin, vérification. Plus la page audit. | `npm run dev` (terminal 3) |
| Rapports | `docs/latex/` | Les deux rapports de devoir en PDF, plus le rapport d'audit en Markdown. | déjà compilés |

Les scripts du dossier `contracts/scripts` font le sale travail : déployer les
deux contrats, écrire les adresses dans le frontend, émettre les 7 certificats de
démo et vérifier que tout est cohérent (`smoke.ts`).

**Point important à dire :** MetaMask ne déploie rien. Le déploiement est fait par
Hardhat avec le compte #0. MetaMask sert uniquement à signer les transactions
quand on utilise l'interface. C'est pour ça que le wallet doit être le compte #0
pour émettre.

---

## 3. Ce que contient l'application

### En-tête (présent partout)

De droite à gauche :

- le bouton **Connecter** : affiche l'adresse du compte MetaMask ;
- le badge réseau **Local / Sepolia** : indique le réseau choisi dans l'app, pas le
  compte. Le point devient vert quand MetaMask est sur le même réseau ;
- le sélecteur **v1 · registre / v2 · erc-721** : choisit le contrat utilisé par
  les écrans admin.

### Accueil `/`

Trois compteurs : nombre de certificats, réseau actif, contrats déployés. Ensuite
les adresses des deux contrats, les deux cartes de présentation des versions, et
un lien pour télécharger `etudiants.xlsx`.

Phrase à dire : « L'accueil sert à montrer qu'il y a bien deux contrats déployés
et que le frontend lit leurs compteurs en direct, sans valeur codée en dur. »

### Administration `/admin`

Quatre onglets :

1. **Émission unitaire** — formulaire avec nom, identifiant étudiant, diplôme,
   date, mention et adresse du destinataire. Bouton « Mon adresse » pour remplir
   automatiquement. Après signature, un hash de transaction s'affiche.
2. **Import Excel** — dépôt du `.xlsx`, aperçu des lignes, cases à cocher, choix
   entre une transaction batch ou des lots séquentiels de 5/10/15.
3. **Certificats récents** — reconstruit à partir des événements
   `CertificateMinted` depuis le bloc de déploiement.
4. **Administration** — affiche l'owner, permet d'ajouter un admin (v1) ou
   d'accorder `MINTER_ROLE` (v2), de mettre en pause et de révoquer un certificat.

### Vérification `/verify`

Recherche par `certId`/`tokenId` ou par `studentId`. La recherche interroge **les
deux contrats en parallèle**, donc un seul champ couvre les deux devoirs. Aucune
signature n'est demandée. La fiche affiche le statut, les métadonnées décodées, un
QR code et un lien partageable.

### Audit `/audit`

La checklist de sécurité, les résultats des tests, les risques résiduels et les
recommandations. Le rapport long est dans `docs/audit-report.md`.

---

## 4. Démo pas à pas

### Scénario 0 — état initial

Avant de commencer, les trois terminaux doivent tourner :

```bash
# terminal 1
npm run node

# terminal 2
npm run deploy:local
npm run seed:local

# terminal 3
npm run dev
```

Ouvre `http://localhost:5173`. Dans MetaMask : compte #0 (`0xf39F…2266`) et
réseau **Hardhat local / 31337**.

> « Le nœud local tourne, les deux contrats sont déployés et sept certificats de
> démonstration ont déjà été émis. Je vais d'abord montrer la vérification, puis
> émettre un certificat devant vous. »

---

### Scénario 1 — vérification publique

1. Va sur **Vérifier**.
2. Clique sur l'exemple `2023-INF-042`.
3. Montre qu'il y a **deux résultats** : un du registre v1, un du NFT v2.
4. Ouvre le résultat v2 et montre le `tokenURI` décodé.

> « Je ne connecte même pas le wallet. La page lit directement le RPC. Elle
> interroge les deux contrats, donc je vois le même étudiant dans les deux
> versions. Ici le statut est valide. »

---

### Scénario 2 — émission unitaire sur le registre v1

1. Sélecteur de version : `v1 · registre`.
2. Va sur **Admin → Émission unitaire**.
3. Remplis par exemple :
   - nom : `Test Démo`
   - identifiant : `2026-TEST-001`
   - diplôme : `Licence Informatique`
   - date : `2026-11-19`
   - mention : `Mention Bien`
   - destinataire : laisse l'adresse du compte connecté.
4. Clique **Émettre**, signe dans MetaMask.
5. Attends le toast de succès et montre le hash.

> « La transaction est signée par MetaMask, puis le frontend attend le reçu. Le
> hash affiché est la preuve que l'écriture a eu lieu. Si je retourne sur
> Vérifier et que je tape `2026-TEST-001`, je retrouve le certificat. »

---

### Scénario 3 — le doublon est refusé

1. Reste sur le formulaire, garde le même `studentId`.
2. Change juste le nom et clique à nouveau **Émettre**.
3. Signe. La transaction doit revert.
4. Montre le toast traduit : « L'identifiant étudiant … est déjà enregistré on-chain. »

> « Le contrat stocke un hash de l'identifiant étudiant dans un mapping. Deux
> certificats avec le même `studentId` sont donc impossibles, même si quelqu'un
> appelle le contrat directement sans passer par l'interface. »

Si le wallet wasn'taccount #0, c'est ici que l'alerte « Compte non autorisé »
apparaît. Montre-la si besoin : elle affiche l'adresse connectée et l'owner.

---

### Scénario 4 — import Excel

1. Sur l'accueil, télécharge `etudiants.xlsx`.
2. **Admin → Import Excel** → dépose le fichier.
3. Montre l'aperçu : 8 lignes, dont une en rouge avec le doublon `2023-INF-042` et
   une autre marquée « déjà enregistré on-chain » puisque le seed l'a émis.
4. Décoche la ligne en erreur.
5. Choisis **Une transaction batch**, puis **Émettre**.
6. Signe et montre le hash du lot.

> « SheetJS lit le fichier dans le navigateur : aucune donnée d'étudiant n'est
> envoyée à un serveur. Je vois les erreurs avant de signer. Le contrat refuse
> aussi les lots vides, les longueurs incohérentes et les lots de plus de 50. »

Le mode séquentiel est à mentionner oralement : « Si je choisis des lots de 5,
chaque lot est une transaction séparée, avec son hash. C'est pratique pour un
gros fichier, mais ce n'est pas atomique : c'est documenté dans l'audit. »

---

### Scénario 5 — passage à l'ERC-721

1. Sélecteur de version : `v2 · erc-721`.
2. Va sur **Vérifier** et cherche `1`.
3. Montre la fiche v2 : `ownerOf`, `tokenURI`, statut, QR code.
4. Va sur **Admin → Administration** et montre :
   - `soulbound` : transferts bloqués ;
   - `MINTER_ROLE` / `DEFAULT_ADMIN_ROLE` ;
   - le bouton de pause.

> « En v2, le certificat est un NFT. Il a un `tokenId`, un `owner`, et des
> métadonnées JSON générées dans le contrat sous forme de data URI base64. Je
> n'ai pas besoin d'IPFS pour cette démo. Par défaut il est soulbound : le
> diplôme appartient à l'étudiant mais ne se revend pas. »

---

### Scénario 6 — révocation

1. Toujours en v2, **Admin → Administration → Révocation manuelle**.
2. Entre `1`, clique **Révoquer**, signe.
3. Retourne sur **Vérifier**, cherche `1`.
4. Montre que la fiche existe toujours mais indique **révoqué**.

> « Je ne brûle pas le token. Je positionne un booléen et j'émets un événement.
> Comme ça l'historique reste consultable et la vérification publique affiche
> clairement le statut. »

Si tu veux faire la même chose en v1, le principe est identique avec `revoke(certId)`.

---

### Scénario 7 — audits et tests

1. Va sur **Audit**.
2. Montre : 0 critique, 0 haute, 41 tests réussis.
3. Ouvre `docs/latex/devoir2.pdf` ou `docs/audit-report.md` si le prof veut le détail.

> « J'ai 41 tests Hardhat : 20 pour le registre et 21 pour l'ERC-721. Ils couvrent
> les rôles, les doublons, les batchs, la pause, la révocation et un test de
> reentrancy avec un contrat malicious. Slither et le fuzzing Foundry ne sont pas
> lancés ici, c'est indiqué dans le rapport. »

---

## 5. Commandes à connaître par cœur

Depuis `certificats/` :

| Commande | Ce que ça fait |
|---|---|
| `npm run node` | démarre la blockchain locale |
| `npm run deploy:local` | déploie v1 + v2 et exporte les adresses/ABI |
| `npm run seed:local` | émet 7 certificats de démo sur les deux contrats |
| `npm run smoke:local` | vérifie les compteurs, le `tokenURI` et les mappings |
| `npm run dev` | lance le frontend sur `http://localhost:5173` |
| `npm test` | lance les 41 tests Hardhat |
| `npm run build` | typecheck + build de production |

Depuis `certificats/contracts/` : `npm run export` régénère les ABI du frontend.

---

## 6. Repères à ne pas oublier

- Registry v1 : `0x5FbDB2315678afecb367f032d93F642f64180aa3` (bloc 1)
- NFT v2 : `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` (bloc 2)
- Compte owner / minter : `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- Clé privée du compte #0 (Hardhat) :
  `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- Certificat de démo : `2023-INF-042`, certId/tokenId `1`
- Réseau : Hardhat local, chainId `31337`, RPC `http://127.0.0.1:8545`

---

## 7. Questions probables et réponses courtes

**Pourquoi deux contrats au lieu d'un ?**
Le premier répond au sujet tel qu'il est posé avec une struct. Le deuxième
montre la migration vers un standard ERC-721. Les garder tous les deux permet de
comparer les deux approches dans la même interface.

**Pourquoi stocker les métadonnées dans le contrat ?**
Pour que la vérification fonctionne sans serveur externe. `tokenURI` renvoie un
JSON encodé en base64. J'ai échappé les guillemets et les antishlashes pour ne pas
casser le JSON.

**Pourquoi soulbound ?**
Un diplôme n'est pas un objet qui doit se revendre. Le token reste la propriété
de l'étudiant, mais les transferts et les approbations sont bloqués. C'est un
`immutable`, donc fixé au déploiement.

**Pourquoi pas IPFS ?**
Pour la démo locale c'est inutile et ça ajouterait une dépendance externe. Le
rapport d'audit propose IPFS comme piste si les données deviennent volumineuses.

**Comment tu gères la reentrancy ?**
`_safeMint` appelle le receveur, donc j'ai mis `nonReentrant` sur les écritures.
Le test `ReentrantMinter` vérifie que la transaction entière revert et qu'aucun
token n'est créé.

**C'est déployé sur Sepolia ?**
Non. La référence est le déploiement local. Les scripts Sepolia sont prêts avec
un `.env.example`, mais je n'ai pas de clé ni d'adresse publique à montrer ici.

**Quelles sont les limites ?**
Les chaînes ne sont pas bornées on-chain, le `studentId` est normalisé côté
client seulement, l'import séquentiel n'est pas atomique, et Slither/Foundry
n'ont pas été exécutés. Tout est écrit dans l'audit.

**Pourquoi 41 tests ?**
20 sur le registre et 21 sur l'ERC-721. Ce sont surtout des tests de rejet :
accès refusé, doublon, lot invalide, pause, révocation double, reentrancy.

---

## 8. Si ça bloque pendant la présentation

- **« Aucun contrat déployé »** : le nœud local est éteint. Relance `npm run node`
  puis `npm run deploy:local` et `npm run seed:local`.
- **« Provider not found »** : pas de wallet injecté. Installe/active MetaMask et
  recharge.
- **« Compte non autorisé »** : regarde l'adresse affichée dans l'alerte. Elle
  doit être `0xf39F…2266`. Sinon sélectionne le compte #0 importé.
- **Badge réseau gris** : MetaMask n'est pas sur le même réseau que l'app. Choisis
  **Hardhat local** dans le menu réseau de l'en-tête.
- **Page blanche** : relance `npm run dev` et vide le cache du navigateur.
- **Transaction en attente** : sur un nœud Hardhat éteint puis relancé, les hashes
  anciens n'existent plus. Redéploie et réémet le seed.
