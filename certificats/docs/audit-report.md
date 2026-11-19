# Rapport d'audit — Certificats académiques (Devoir 2)

**Projet :** Certify — système de certification académique on-chain
**Périmètre audité :** `CertificateRegistry.sol` (v1) et `CertificateNFT.sol` (v2)
**Version des contrats :** Solidity `0.8.24`, OpenZeppelin Contracts `5.1`
**Réseau de référence :** Hardhat local (chainId 31337)
**Date :** novembre 2026
**Nature :** audit pédagogique, réalisé dans le cadre du Devoir 2

---

## 1. Résumé exécutif

Le système est composé de deux contrats et d'un frontend React. Le Devoir 1 pose un
registre custom ; le Devoir 2 le refactore en NFT ERC-721 standard avec OpenZeppelin,
rôles `AccessControl`, métadonnées `tokenURI` générées on-chain et protection contre
la reentrancy.

**Conclusion :** aucune vulnérabilité critique ou haute n'a été identifiée dans le
périmètre. Trois risques de sévérité faible à moyenne sont acceptés et documentés
(§5). Deux contrôles de sécurité complémentaires (Slither, fuzzing Foundry) n'ont pas
été exécutés dans cet environnement Windows et restent à faire avant toute mise en
production (§7).

**Résultat des tests :** `41 / 41` tests Hardhat passent.

| Sévérité | Nombre |
|---|---|
| Critique | 0 |
| Haute | 0 |
| Moyenne | 2 |
| Faible | 2 |
| Informative | 3 |

---

## 2. Périmètre

### Audité

| Fichier | Lignes | Rôle |
|---|---|---|
| `contracts/contracts/CertificateRegistry.sol` | ~200 | registre v1 (Devoir 1) |
| `contracts/contracts/CertificateNFT.sol` | ~340 | NFT ERC-721 v2 (Devoir 2) |
| `contracts/contracts/mocks/ReentrantMinter.sol` | ~35 | contrat de test (non déployé) |
| `frontend/src/hooks/use-contract-status.ts` | — | lecture des rôles avant écriture |
| `frontend/src/lib/excel.ts` | — | validation des imports |

### Hors périmètre

- contrats OpenZeppelin eux-mêmes (considérés comme audités en amont) ;
- infrastructure RPC, fournisseurs d'accès, wallet MetaMask ;
- sécurité de l'hébergement du frontend ;
- contrats déployés sur un réseau public avec des fonds réels.

---

## 3. Méthodologie

1. **Revue manuelle** ligne par ligne des deux contrats et de leurs dépendances OZ.
2. **Analyse des flux** : mint unitaire, batch, révocation, pause, gestion des rôles.
3. **Scénarios d'abus ciblés** : accès non autorisé, double mint, reentrancy via
   `onERC721Received`, transfert de token soulbound, injection JSON, batchs malformés.
4. **Tests automatisés** : 41 cas Hardhat couvrant les chemins heureux et les rejets.
5. **Revue frontend** : validation des entrées avant transaction, absence de secrets,
   lecture des rôles pour bloquer les actions non autorisées côté UI.

Outils exécutés : Hardhat, TypeScript (`tsc`), Vite (build de production).
Outils **non exécutés** : Slither, Mythril, fuzzing Foundry (voir §7).

---

## 4. Architecture et contrôles

### 4.1 Contrôle d'accès

| Contrat | Mint | Révocation | Pause | Gestion des rôles |
|---|---|---|---|---|
| `CertificateRegistry` (v1) | `owner` ou `isAdmin` | `owner` ou `isAdmin` | `owner` | `owner` (`setAdmin`) |
| `CertificateNFT` (v2) | `MINTER_ROLE` | `DEFAULT_ADMIN_ROLE` | `DEFAULT_ADMIN_ROLE` | `DEFAULT_ADMIN_ROLE` |

- Aucune utilisation de `tx.origin`.
- Aucune fonction d'écriture publique non protégée.
- Les rôles sont lus par le frontend (`hasRole`, `isAdmin`, `owner`) pour désactiver
  les boutons et afficher un message explicite, mais **la décision finale reste
  on-chain** : le contrat rejette toute transaction non autorisée.

### 4.2 Reentrancy

`_safeMint` appelle `onERC721Received` sur le destinataire. Un receveur malveillant
pourrait tenter de rappeler `mintCertificate`. Les points d'entrée d'écriture sont
protégés par `nonReentrant`, et un test dédié (`ReentrantMinter`) vérifie que la
transaction entière revert et qu'aucun token n'est créé.

### 4.3 Validation des entrées

Rejetés avec des custom errors : adresse nulle (`ZeroAddress`), champ requis vide
(`EmptyField`), `studentId` déjà enregistré (`DuplicateStudentId`), batch vide
(`EmptyBatch`), longueurs incohérentes (`LengthMismatch`), batch > 50
(`BatchTooLarge`).

### 4.4 Métadonnées

`tokenURI` génère un JSON encodé en base64 directement dans le contrat. Les chaînes
contrôlées par l'admin sont échappées (`"`, `\`, retours à la ligne) avant encodage
pour éviter de casser le JSON. `contractURI` suit la même logique.

### 4.5 Soulbound

Par défaut `soulbound = true` : `_update` bloque tout transfert (`TransferNotAllowed`)
et `approve` / `setApprovalForAll` revertent (`ApprovalsDisabled`). Le mint et le burn
restent possibles. L'option est fixée au déploiement via un `immutable`.

### 4.6 Révocation

La révocation positionne un booléen et émet `CertificateRevoked`. Le token n'est jamais
supprimé : la vérification publique continue de fonctionner et affiche le statut
« révoqué ». La double révocation est rejetée.

---

## 5. Constats

### 5.1 Moyenne — Longueur des chaînes non bornée on-chain

**Fichiers :** `CertificateRegistry.sol` (`_mint`), `CertificateNFT.sol` (`_mintWithData`)

Aucune limite de longueur n'est imposée sur `studentName`, `studentId`,
`diplomaTitle`, `issueDate` ou `grade`. Un compte disposant du rôle d'émission peut
envoyer des chaînes très longues, ce qui augmente fortement le coût du gas d'un batch
et peut faire dépasser la limite de taille de transaction.

**Impact :** déni de service partiel par coût, limité aux comptes déjà privilégiés.
**Recommandation :** borner chaque champ (par exemple 128 octets) ou stocker un hash
des métadonnées volumineuses, avec les données lourdes hors chaîne (IPFS).

### 5.2 Moyenne — Normalisation du `studentId` côté client uniquement

**Fichiers :** `frontend/src/lib/excel.ts`, `components/admin/mint-form.tsx`

L'unicité repose sur `keccak256(bytes(studentId))`. Le frontend applique `trim` et
`toUpperCase`, mais un appel direct au contrat peut enregistrer `2023-inf-042` puis
`2023-INF-042` comme deux identifiants distincts.

**Impact :** doublons logiques si l'émetteur contourne l'interface.
**Recommandation :** normaliser on-chain (impossible en Solidity pur sans coût), ou
documenter que l'identifiant canonique est la forme majuscule et faire respecter cette
règle par un service d'émission unique.

### 5.3 Faible — Dépendance `xlsx` (SheetJS community)

La version communautaire de SheetJS présente des advisories connus. Le parsing est
strictement côté client, aucune donnée n'est envoyée à un serveur, et le fichier est
fourni par l'administrateur lui-même : la surface d'attaque est donc limitée au poste
de l'émetteur.

**Recommandation :** suivre les versions, ou migrer vers une bibliothèque maintenue
(`exceljs`) si le projet dépasse le cadre pédagogique.

### 5.4 Faible — Mode séquentiel non atomique

L'import Excel en lots séquentiels envoie plusieurs transactions. Un échec au milieu
du lot laisse les certificats précédents émis. C'est un comportement attendu et
documenté, mais il faut le savoir pour la reprise sur incident.

**Recommandation :** conserver les hash par lot (déjà affichés dans l'UI) et reprendre
à partir des lignes non émises ; la détection de doublon on-chain empêche un double
envoi.

### 5.5 Informative — `tokenURI` en data URI base64

Certains wallets et marketplaces tronquent les URI très longues. Les métadonnées
restent lisibles via l'appel direct `tokenURI` et via la page de vérification.

### 5.6 Informative — `DEFAULT_ADMIN_ROLE` cumule révocation et administration

Le même rôle peut révoquer un certificat, mettre le contrat en pause et modifier les
rôles. Un rôle `REVOKER_ROLE` séparé appliquerait mieux le principe du moindre
privilège.

### 5.7 Informative — Pas d'indexeur d'historique

La liste des certificats récents est reconstruite à partir des events
`CertificateMinted` depuis le bloc de déploiement. Sur un réseau public avec beaucoup
d'événements, un indexeur (The Graph) serait nécessaire pour une recherche complète.

---

## 6. Tests

Exécution : `npm test` dans `certificats/contracts` (Hardhat, réseau en mémoire).

### `CertificateRegistry` (v1) — 20 / 20

| Thème | Cas couverts |
|---|---|
| Déploiement / administration | owner par défaut, owner nul, ajout/retrait d'admin, refus non-owner |
| Émission unitaire | mint réussi + event, admin désigné, accès refusé, adresse nulle, champs vides, double `studentId`, recherche par `studentId`, certificat inexistant |
| Batch | batch réussi, batch vide, longueurs incohérentes, dépassement de 50 |
| Révocation / pause | révocation + event, double révocation, révocation non autorisée, pause bloquante, reprise, pause réservée au owner |

### `CertificateNFT` (v2) — 21 / 21

| Thème | Cas couverts |
|---|---|
| Déploiement / rôles | rôles accordés, admin nul, mint sans `MINTER_ROLE`, retrait de rôle |
| Émission / métadonnées | mint + `tokenURI` base64 valide, échappement des guillemets, double `studentId`, entrées invalides, token inexistant, `contractURI` |
| Batch | batch avec données, batch d'URI (signature du sujet), batchs invalides |
| Révocation | révocation + métadonnées « Revoque », double révocation, révocation par simple minter refusée |
| Soulbound / pause | transfert bloqué, approbations bloquées, transfert autorisé si `soulbound=false`, pause, pause refusée aux non-admins |
| Sécurité | reentrancy via `onERC721Received`, `supportsInterface` ERC-721 et AccessControl |

### Frontend

| Contrôle | Résultat |
|---|---|
| `tsc --noEmit` | passe |
| `vite build` | passe (bundle ~1,2 Mo, avertissement de taille) |

---

## 7. Contrôles non exécutés

| Outil | Statut | Raison |
|---|---|---|
| Slither | non exécuté | dépendances Python non disponibles sur l'environnement Windows utilisé |
| Fuzzing Foundry | non exécuté | hors périmètre des tests Hardhat |
| Mythril | non exécuté | non installé |
| Audit professionnel | non réalisé | exercice pédagogique |

Commandes prévues pour la CI (Linux) :

```bash
pip install slither-analyzer
slither . --config-file slither.config.json

forge test --fuzz-runs 10000
```

---

## 8. Risques résiduels

1. Chaînes non bornées on-chain (coût de gas, §5.1).
2. Normalisation du `studentId` côté client seulement (§5.2).
3. Dépendance `xlsx` avec advisories connus (§5.3).
4. Import séquentiel non atomique (§5.4).
5. `tokenURI` long en data URI, troncature possible côté wallet (§5.5).
6. Rôle admin unique pour révocation et administration (§5.6).
7. Aucun déploiement Sepolia vérifié dans ce livrable.
8. Aucun audit statique automatisé exécuté (§7).

---

## 9. Recommandations prioritaires

1. Exécuter **Slither** et un **fuzz Foundry** en CI avant toute mise en production.
2. **Borner la longueur** des champs de métadonnées, ou déporter les données lourdes
   vers IPFS en ne gardant qu'un hash on-chain.
3. Séparer un **`REVOKER_ROLE`** du `DEFAULT_ADMIN_ROLE`.
4. Utiliser un **multisig** (Safe) pour le rôle admin et une clé de déploiement dédiée.
5. Ajouter un **indexeur** (The Graph) pour l'historique complet et la recherche.
6. Documenter la forme canonique du `studentId` et centraliser l'émission.

---

## 10. Conclusion

Les contrats remplissent les exigences des Devoirs 1 et 2 avec un niveau de sécurité
adapté à un usage académique : contrôle d'accès explicite, protection contre la
reentrancy, validation des invariants critiques, métadonnées échappées et
non-transférabilité par défaut. Les faiblesses identifiées sont de sévérité faible à
moyenne, concernent principalement des comptes déjà privilégiés, et sont documentées
avec des recommandations concrètes.

**Ce rapport ne constitue pas une certification de sécurité.** Un audit professionnel
et des tests sur réseau public restent nécessaires avant tout usage réel.
