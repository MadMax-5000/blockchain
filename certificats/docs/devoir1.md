# Devoir 1 — Registre de certificats académiques

**Contrat :** `contracts/contracts/CertificateRegistry.sol`
**Solidity :** `0.8.24`
**Réseau :** Hardhat local (chainId 31337), scripts prêts pour Sepolia
**Frontend :** `frontend/` (onglet v1 · registre)

---

## 1. Objectif

Construire un système de bout en bout : un contrat qui stocke les certificats on-chain,
un frontend admin qui émet à l'unité ou depuis un fichier Excel, et une page publique
de vérification. Aucune base de données centrale, aucune clé privée dans le navigateur.

---

## 2. Modèle de données

```solidity
struct Certificate {
    string studentName;
    string studentId;
    string diplomaTitle;
    string issueDate;
    string grade;
    address recipient;
    bool revoked;
}
```

Les métadonnées sont stockées directement dans une struct, conformément au sujet.
Le `studentId` est indexé par `keccak256(bytes(studentId))` dans un mapping
`bytes32 → uint256` pour bloquer le double enregistrement en O(1).

---

## 3. API

| Fonction | Type | Accès |
|---|---|---|
| `mintCertificate(to, name, id, diploma, date, grade)` | écriture | owner / admin |
| `batchMint(recipients[], names[], ids[], diplomas[], dates[], grades[])` | écriture | owner / admin |
| `getCertificate(certId)` | lecture | public |
| `getCertificateByStudentId(studentId)` | lecture | public |
| `certificateIdByStudentId(studentId)` | lecture | public |
| `revoke(certId)` | écriture | owner / admin |
| `setAdmin(account, enabled)` | écriture | owner |
| `pause()` / `unpause()` | écriture | owner |
| `totalCertificates()` | lecture | public |

Events :

```solidity
event CertificateMinted(uint256 indexed certId, address indexed recipient, string studentId, string diplomaTitle, string issueDate);
event CertificateRevoked(uint256 indexed certId, address indexed revokedBy);
event AdminUpdated(address indexed account, bool enabled);
```

---

## 4. Choix de conception

| Choix | Raison |
|---|---|
| Owner + mapping `isAdmin` | le sujet demande « owner ou mapping d'admins » ; le mapping évite de redéployer pour ajouter un émetteur |
| `keccak256(studentId)` en clé | comparaison O(1), pas de tableau à parcourir |
| `certId` incrémental à partir de 1 | identifiants courts, `0` réservé à « inexistant » |
| Batch plafonné à 50 | limite de gas raisonnable, cohérent avec le conseil « lots de 5–15 » côté UI |
| Révocation par flag | le certificat reste consultable pour l'historique et la vérification |
| `Pausable` | coupe-circuit administratif sans supprimer de données |
| Custom errors | gas réduit et messages exploitables par le frontend |
| `issueDate` en `string` ISO | le contrat ne parse pas les dates ; la validation forte est côté client |

La validation métier (format ISO, adresse, colonnes) est faite côté client **avant** la
transaction. Le contrat applique les invariants critiques : adresse non nulle, champs
requis non vides, unicité du `studentId`, longueurs de batch cohérentes.

---

## 5. Tests

```bash
cd certificats/contracts
npm test
```

**20 tests** couvrent :

- déploiement, owner, ajout/retrait d'admin, refus d'un owner nul ;
- mint réussi, admin désigné, accès refusé, adresse nulle, champs vides ;
- double `studentId` bloqué, recherche par `studentId`, certificat inexistant ;
- batch réussi, batch vide, longueurs incohérentes, dépassement de 50 ;
- révocation, double révocation, révocation non autorisée ;
- pause / unpause et contrôle d'accès.

---

## 6. Frontend

- **Admin** : formulaire unitaire, import Excel avec aperçu et sélection, émission batch
  ou lots séquentiels, hash par lot, erreurs décodées.
- **Public** : recherche par `certId` ou `studentId`, fiche complète, statut, QR code.

Le frontend interroge les deux contrats en parallèle sur la page de vérification, ce qui
permet de comparer les deux devoirs sans changer de version.

---

## 7. Déploiement

```bash
npm run node            # terminal 1
npm run deploy:local    # terminal 2
npm run seed:local
```

Adresses écrites dans `contracts/deployments/31337.json` et
`frontend/src/contracts/deployments.json`. Elles sont injectées dans l'interface ;
aucune adresse n'est codée en dur.

Pour Sepolia, voir la section correspondante du [README](../README.md).

---

## 8. Captures à produire

Le parcours de démonstration est :

1. `/admin` → émission unitaire → toast de succès + hash de transaction ;
2. `/admin` → import Excel → aperçu → émission batch → hash ;
3. `/verify` → recherche `1` → fiche valide avec QR code ;
4. `/verify` → recherche `2023-INF-042` → fiche valide.

Les captures peuvent être ajoutées dans `docs/screenshots/` après un déploiement local.
