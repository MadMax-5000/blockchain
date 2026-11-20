# Scénario de démonstration — CityTrace (7–8 minutes)

Feuille de route pour la soutenance. Chaque étape indique ce qu'il faut faire,
ce qui doit apparaître et la phrase à dire. Les données sont fictives.

---

## 0. Avant de commencer (30 s)

Trois terminaux doivent tourner :

```bash
# terminal 1
npm run node

# terminal 2
npm run deploy:local
npm run seed:local
npm run smoke:local

# terminal 3
npm run dev
```

Ouvrir <http://localhost:5173>. Dans MetaMask : compte #0
(`0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`), réseau Hardhat local / 31337.
Le contrat est à `0x5FbDB2315678afecb367f032d93F642f64180aa3`.

> « CityTrace suit le cycle de vie d'un signalement urbain : un citoyen déclare,
> la municipalité affecte une équipe, puis fait avancer le dossier jusqu'à la
> clôture. Chaque étape est signée et stockée on-chain. J'ai déjà déployé le
> contrat et créé huit signalements fictifs. »

---

## 1. Vue d'ensemble (45 s)

1. Rester sur `/`.
2. Montrer les compteurs : **8** déclarés, **4** en attente, **2** en cours,
   **1** clôturé.
3. Montrer la chaîne de traitement à droite et l'adresse du contrat.

> « L'accueil lit le contrat en direct : il n'y a aucune valeur codée en dur
> dans l'interface. La colonne de droite montre la répartition par statut.
> La chaîne est stricte : pas de saut d'étape, pas de retour en arrière. »

---

## 2. Consultation publique et historique (1 min)

1. Ouvrir **Signalements** dans la barre latérale.
2. Filtrer sur **Signalé** puis sur **Clôturé**.
3. Ouvrir `CITY-2026-005`.
4. Montrer la barre de progression complète et les **5 entrées** de l'historique :
   création, affectation, intervention démarrée, intervention terminée, clôture.

> « La liste est publique : aucun wallet n'est nécessaire. Ici le dossier
> `005` est passé par les cinq états. Chaque ligne porte un horodatage, un
> commentaire, l'équipe affectée et l'adresse du wallet qui a signé l'action.
> On ne peut pas modifier le passé sans écrire une nouvelle transaction. »

---

## 3. Déclaration citoyenne (1 min 15)

1. Aller sur **Nouveau signalement**.
2. Remplir :
   - identifiant : `CITY-2026-301`
   - type : `StreetLight`
   - localisation : `Rue de Toulouse, Rabat`
   - description : `Lampadaire clignotant devant la pharmacie`
   - date : `2026-11-20`
   - priorité : `High`
   - déclarant : `Citizen301`
3. Cliquer **Enregistrer on-chain**, signer dans MetaMask.
4. Attendre le toast, montrer le hash de transaction.
5. Revenir sur **Signalements** : le dossier apparaît en tête avec le statut
   **Signalé**.

> « Le formulaire n'envoie aucune donnée à un serveur. La transaction est
> signée par MetaMask, le frontend attend le reçu, puis invalide le cache de
> lecture. Le statut initial est toujours *Signalé* : l'affectation est une
> décision municipale séparée. »

---

## 4. Espace municipal : affectation et progression (1 min 30)

1. Aller sur **Espace municipal**.
2. Montrer `Rôle municipal : accordé` et `Registre : actif`.
3. Sélectionner `CITY-2026-301` dans la liste des dossiers ouverts.
4. Vérifier l'équipe `UrbanTeam01`, cliquer **Affecter l'équipe**, signer.
5. Montrer le nouveau statut **Affecté** et l'entrée ajoutée à l'historique.
6. Cliquer **Passer à En cours**, signer.

> « Les actions d'agent sont protégées par `AGENT_ROLE` dans le contrat.
> L'affectation fait automatiquement passer *Signalé* à *Affecté* et écrit
> une entrée d'historique. Le changement de statut suivant vérifie la
> transition côté contrat, pas seulement côté interface. »

---

## 5. Refus d'une transition invalide (45 s)

1. Dans le même dossier `CITY-2026-301`, essayer de passer directement à
   **Résolu** en utilisant la console du navigateur ou un appel direct au
   contrat ; ou simplement expliquer que le bouton n'existe pas dans l'UI.
2. Montrer le toast traduit si un appel direct est tenté :
   « Transition de statut impossible : la chaîne doit être respectée. »

> « Même si quelqu'un contourne l'interface et appelle `updateStatus` avec
> l'état `Resolved` depuis `InProgress`, le contrat rejette la transaction.
> La règle est dans le Solidity, pas dans le React. »

Variante rapide : utiliser un compte sans `AGENT_ROLE` et montrer le message
« Ce compte n'a pas le rôle municipal requis ».

---

## 6. Import Excel — validation (1 min)

1. Aller sur **Import Excel**.
2. Télécharger **Jeu de validation (erreurs)** puis le déposer.
3. Montrer le résumé : 10 lignes lues, 5 valides, 5 invalides.
4. Pointer les erreurs : doublon `CITY-2026-202`, priorité `Urgent`,
   localisation vide, statut `EnCours`, date `2026-13-45`, description vide.
5. Montrer que les cases des lignes invalides sont désactivées.

> « SheetJS lit le classeur dans le navigateur. Les erreurs sont détectées
> avant la signature : aucune transaction n'est envoyée pour une ligne
> invalide. Les doublons on-chain sont aussi détectés par comparaison avec
> le registre. »

---

## 7. Import Excel — signature réussie (1 min 15)

1. Télécharger **Modèle valide (8 lignes)** puis le déposer.
2. Montrer les 8 lignes `CITY-2026-101` … `108`, toutes « Valide ».
3. Décocher une ligne pour montrer que la sélection est respectée, puis la
   recocher.
4. Cliquer **Importer 8 ligne(s)**, signer une seule transaction.
5. Montrer le hash, puis ouvrir `CITY-2026-101` dans la liste des signalements.

> « Les huit lignes partent dans une seule transaction `batchCreateIssues`.
> Le contrat plafonne un lot à 50 lignes et vérifie à nouveau chaque
> identifiant : si un seul existe déjà, tout le lot est annulé. C'est le
> comportement atomique voulu pour un import officiel. »

---

## 8. Pause d'urgence et tests (45 s)

1. Dans **Espace municipal**, cliquer **Mettre en pause**, signer.
2. Retourner sur **Nouveau signalement** et montrer que la signature est
   bloquée par le contrat (`EnforcedPause`).
3. Réactiver le registre.
4. Montrer le résultat de `npm test` dans le terminal : **31 passing**.

> « La pause est réservée à l'administrateur. Elle bloque toutes les écritures
> mais laisse la lecture disponible, ce qui permet de continuer à consulter
> l'historique pendant un incident. Les 31 tests couvrent les rôles, les
> doublons, les transitions, les lots, la pause et les événements. »

---

## Repères à avoir sous les yeux

| Élément | Valeur |
|---|---|
| Réseau | Hardhat local, chainId `31337` |
| RPC | `http://127.0.0.1:8545` |
| Contrat | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| Compte agent | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| Clé privée du compte #0 | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| Signalement clos de démo | `CITY-2026-005` (5 entrées d'historique) |
| Fichier Excel valide | `urban_issues-import.xlsx` (`101`–`108`) |
| Fichier Excel avec erreurs | `urban_issues.xlsx` |

---

## Si ça bloque

- **« Aucun contrat déployé »** : relancer `npm run node`, `npm run deploy:local`,
  `npm run seed:local`.
- **« Aucun wallet détecté »** : active MetaMask et recharge la page.
- **« Le wallet n'est pas sur le bon réseau »** : choisir **Hardhat local**
  dans le menu réseau de l'application.
- **« Rôle municipal non accordé »** : utiliser le compte #0 importé.
- **Toutes les lignes marquées « déjà présent on-chain »** : c'est le fichier
  `urban_issues.xlsx` après plusieurs imports ; reprendre
  `urban_issues-import.xlsx`.
- **Transaction en attente après redémarrage du nœud** : les anciens hashes
  n'existent plus ; redéployer et refaire le seed.
