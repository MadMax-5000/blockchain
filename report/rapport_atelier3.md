# Rapport — Atelier 3

## MiniSocial : mini réseau social en Solidity

**Contrat :** `atelier3/MiniSocial.sol`
**Langage :** Solidity `^0.8.20`
**Compilateur utilisé :** Solidity 0.8.24
**Réseau de test local :** Ganache 7, chainId 1337
**Réseau public visé :** Sepolia (MetaMask)

---

## 1. Objectif

Créer un smart contract minimal qui permet à plusieurs utilisateurs de publier des
messages et de les consulter. Le contrat doit contenir :

- une structure `Post` avec un message et l'adresse de l'auteur ;
- un tableau dynamique `posts` ;
- une fonction `publishPost` ;
- une fonction `getPost` ;
- une fonction `getTotalPosts`.

Le périmètre reste volontairement réduit : pas de suppression, pas de modification,
pas de propriétaire, pas de bibliothèque externe, pas de front-end.

---

## 2. Choix de conception

| Choix | Raison |
|---|---|
| `Post[] private posts` | encapsuler le stockage et exposer uniquement les getters demandés |
| `msg.sender` comme auteur | l'adresse qui signe la transaction est l'auteur du post |
| `posts.push(...)` | ajout en fin de tableau, index stable et croissant |
| `getPost` en `view` | lecture seule, aucun coût de gas pour l'appelant |
| Aucun `owner` | le contrat est ouvert à tous, comme un mini réseau social |
| Aucun événement | non demandé ; le tableau et les getters suffisent |

Le tableau est privé : cela ne rend pas les données secrètes (tout est lisible on-chain),
mais cela oblige à passer par `getPost` et `getTotalPosts`, ce qui correspond à l'API
demandée.

---

## 3. Code source

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MiniSocial
/// @notice Mini réseau social on-chain : publication et lecture de messages.
contract MiniSocial {
    struct Post {
        string message;
        address author;
    }

    Post[] private posts;

    /// @notice Publie un message depuis l'adresse de l'appelant.
    function publishPost(string memory _message) public {
        posts.push(Post(_message, msg.sender));
    }

    /// @notice Retourne le message et son auteur pour un index donné.
    function getPost(uint index) public view returns (string memory, address) {
        Post storage post = posts[index];
        return (post.message, post.author);
    }

    /// @notice Retourne le nombre total de messages publiés.
    function getTotalPosts() public view returns (uint) {
        return posts.length;
    }
}
```

---

## 4. Explication du contrat

### 4.1 Structure `Post`

```solidity
struct Post {
    string message;
    address author;
}
```

`Post` regroupe les deux informations demandées : le texte du message et l'adresse de
l'utilisateur qui l'a publié. `string` est dynamique : la taille du message n'est pas
fixée à la compilation.

### 4.2 Tableau `posts`

```solidity
Post[] private posts;
```

C'est un tableau dynamique : sa taille augmente à chaque publication. L'index du premier
message est `0`, le deuxième `1`, etc. Aucun message n'est supprimé, donc les index
restent valides.

### 4.3 Publication

```solidity
function publishPost(string memory _message) public {
    posts.push(Post(_message, msg.sender));
}
```

- `_message` est passé en `memory` car c'est une donnée temporaire lue depuis l'appel.
- `msg.sender` est l'adresse du compte qui envoie la transaction. C'est elle qui devient
  l'auteur, pas une adresse passée en paramètre : un utilisateur ne peut donc pas publier
  à la place d'un autre.
- `posts.push(...)` ajoute le post à la fin du tableau.

La fonction est une transaction : elle modifie l'état et coûte du gas.

### 4.4 Consultation d'un message

```solidity
function getPost(uint index) public view returns (string memory, address) {
    Post storage post = posts[index];
    return (post.message, post.author);
}
```

- `view` indique que la fonction ne modifie pas l'état.
- `Post storage post` évite une copie inutile en mémoire.
- L'accès `posts[index]` effectue automatiquement un contrôle de borne : si l'index est
  supérieur ou égal à `posts.length`, la transaction revert.
- La fonction retourne un tuple `(string, address)`.

### 4.5 Nombre de messages

```solidity
function getTotalPosts() public view returns (uint) {
    return posts.length;
}
```

`posts.length` donne le nombre total de publications. C'est aussi la borne supérieure
exclusive des index valides : les index vont de `0` à `getTotalPosts() - 1`.

---

## 5. Déploiement dans Remix

### 5.1 Préparation

1. Ouvrir <https://remix.ethereum.org>.
2. Créer un fichier `MiniSocial.sol`.
3. Coller le code de la section 3.
4. Dans l'onglet **Solidity Compiler**, choisir `0.8.24` (ou une version `^0.8.20`).
5. Cliquer sur **Compile MiniSocial.sol**. Le compilateur doit afficher un statut vert.

### 5.2 Déploiement local dans Remix VM

1. Ouvrir **Deploy & Run Transactions**.
2. Choisir `Remix VM` comme environnement.
3. Vérifier que le contrat sélectionné est `MiniSocial`.
4. Cliquer sur **Deploy**.
5. Le contrat apparaît dans **Deployed Contracts**.

Ce mode permet de tester immédiatement sans MetaMask ni gas réel.

### 5.3 Déploiement sur Sepolia avec MetaMask

1. Installer MetaMask et créer ou importer un compte.
2. Ajouter le réseau Sepolia :
   - nom : `Sepolia`
   - chain ID : `11155111`
   - RPC : un endpoint Sepolia (Infura, Alchemy, ou `https://rpc.sepolia.org`)
   - symbole : `SepoliaETH`
   - explorateur : `https://sepolia.etherscan.io`
3. Obtenir des SepoliaETH depuis un faucet Sepolia.
4. Dans Remix, choisir **Injected Provider - MetaMask**.
5. Vérifier que MetaMask est sur Sepolia et que le compte affiché est le bon.
6. Cliquer sur **Deploy**, puis confirmer la transaction dans MetaMask.
7. Attendre la confirmation et copier l'adresse du contrat depuis Remix ou Etherscan.

> Le déploiement Sepolia dépend du compte MetaMask et d'un faucet. Aucune clé privée
> n'est stockée dans le dépôt.

---

## 6. Tests réalisés

### 6.1 Environnement de test

Les tests ont été exécutés sur un réseau local **Ganache 7** (chainId `1337`), avec
Solidity 0.8.24 et trois comptes déterministes. Ce réseau de test permet de reproduire
exactement les publications, les adresses et les reçus de transaction sans consommer de
SepoliaETH.

| Élément | Valeur |
|---|---|
| Compilateur | Solidity 0.8.24 |
| Optimiseur | activé |
| Réseau | Ganache local, chainId 1337 |
| Contrat déployé | `0xe78A0F7E598Cc8b0Bb87894B0F60dD2a88d6a8Ab` |
| Comptes utilisés | 3 |

Adresses des comptes :

```text
Compte 1 : 0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1
Compte 2 : 0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0
Compte 3 : 0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b
```

### 6.2 Test 1 — publication depuis le compte 1

**Étape :** appeler `publishPost("Bonjour depuis le compte 1")` avec le compte 1.

**Résultat :**

| Champ | Valeur |
|---|---|
| Auteur attendu | `0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1` |
| Transaction | `0xd407479c8c1d286dcf0a645aaede5b44c6546e9de3c3b106eebebd2b5c1cb711` |
| Bloc | 2 |
| Gas utilisé | 89 244 |

Le message est ajouté à l'index `0`.

### 6.3 Test 2 — publication depuis le compte 2

**Étape :** appeler `publishPost("Deuxieme message depuis le compte 2")` avec le compte 2.

**Résultat :**

| Champ | Valeur |
|---|---|
| Auteur attendu | `0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0` |
| Transaction | `0xb31908925e37d45deebeaf02530bf1f666bc6ba0b5221422bf925907c758adfd` |
| Bloc | 3 |
| Gas utilisé | 116 773 |

Le message est ajouté à l'index `1`.

### 6.4 Test 3 — publication depuis le compte 3

**Étape :** appeler `publishPost("Troisieme message depuis le compte 3")` avec le compte 3.

**Résultat :**

| Champ | Valeur |
|---|---|
| Auteur attendu | `0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b` |
| Transaction | `0x8f5a2f959564dd3dfea40f637908df6dc58562295aad95eebbf295c51e15ff5a` |
| Bloc | 4 |
| Gas utilisé | 116 785 |

Le message est ajouté à l'index `2`.

### 6.5 Test 4 — nombre total de messages

**Étape :** appeler `getTotalPosts()`.

**Résultat attendu :** `3`.

**Résultat obtenu :** `3`.

### 6.6 Test 5 — lecture des messages

**Étape :** appeler `getPost(0)`, `getPost(1)` et `getPost(2)`.

**Résultat obtenu :**

| Index | Message | Auteur |
|---:|---|---|
| 0 | `Bonjour depuis le compte 1` | `0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1` |
| 1 | `Deuxieme message depuis le compte 2` | `0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0` |
| 2 | `Troisieme message depuis le compte 3` | `0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b` |

Chaque message est bien associé au compte qui l'a publié. Les index sont stables et
respectent l'ordre de publication.

### 6.7 Test 6 — index invalide

**Étape :** appeler `getPost(99)` alors que `getTotalPosts()` vaut `3`.

**Résultat attendu :** revert (index hors limites).

**Résultat obtenu :** revert confirmé. Aucun message n'est retourné.

C'est le comportement attendu : Solidity vérifie automatiquement la borne du tableau.

### 6.8 Synthèse des tests

| Test | Attendu | Obtenu |
|---|---|---|
| Déploiement | contrat déployé | OK, adresse `0xe78A...a8Ab` |
| Publication compte 1 | post à l'index 0 | OK |
| Publication compte 2 | post à l'index 1 | OK |
| Publication compte 3 | post à l'index 2 | OK |
| `getTotalPosts()` | 3 | 3 |
| `getPost(0..2)` | messages et auteurs corrects | OK |
| `getPost(99)` | revert | revert |

---

## 7. Procédure de test sur Sepolia

Une fois le contrat déployé sur Sepolia depuis Remix :

1. Copier l'adresse du contrat et l'ouvrir dans **Deployed Contracts**.
2. Avec le compte 1, appeler `publishPost("Premier message Sepolia")`, confirmer dans
   MetaMask, attendre la confirmation.
3. Changer de compte dans MetaMask, puis appeler
   `publishPost("Deuxieme message Sepolia")`.
4. Répéter avec un troisième compte.
5. Appeler `getTotalPosts()` : le résultat doit être `3`.
6. Appeler `getPost(0)`, `getPost(1)`, `getPost(2)` : chaque tuple doit contenir le
   message et l'adresse du compte correspondant.
7. Vérifier les transactions sur `https://sepolia.etherscan.io`.

Les résultats attendus sont identiques aux tests locaux. La seule différence est le coût
réel en SepoliaETH et le délai de confirmation du réseau.

---

## 8. Sécurité et limites

- **Tout le monde peut publier.** Il n'y a ni modération, ni liste blanche, ni coût
  dissuasif au-delà du gas. C'est volontaire pour un mini réseau social ouvert.
- **Les messages sont immuables.** Aucune fonction de suppression ou de modification
  n'existe.
- **Pas de limite de taille.** Un message très long coûte plus cher en gas ; une vraie
  application ajouterait une limite ou stockerait le texte hors chaîne (IPFS) avec un
  hash on-chain.
- **Pas d'événement.** Un événement `PostPublished` faciliterait l'indexation par un
  front-end, mais il n'est pas demandé.
- **Données publiques.** Tout message et toute adresse sont lisibles par tous.
- **`getPost` revert** si l'index est invalide ; l'appelant doit vérifier
  `getTotalPosts()` avant de lire.

---

## 9. Conclusion

Le contrat `MiniSocial` remplit les cinq exigences de l'atelier :

1. structure `Post` avec message et auteur ;
2. tableau dynamique `posts` ;
3. publication via `publishPost` et `msg.sender` ;
4. consultation via `getPost` ;
5. comptage via `getTotalPosts`.

Les tests locaux avec trois comptes confirment que les messages sont stockés dans l'ordre,
que chaque auteur est correctement enregistré et que les index invalides sont rejetés.
Le contrat est prêt à être déployé sur Sepolia avec Remix et MetaMask.

---

## Annexe — Reproduction locale

Compilation :

```bash
npx --yes solc@0.8.24 --bin --abi --optimize -o build atelier3/MiniSocial.sol
```

Le test local utilisé pour ce rapport démarre un nœud Ganache, déploie le contrat,
publie trois messages depuis trois comptes, lit les posts et vérifie le revert sur un
index invalide. Les résultats complets sont ceux des sections 6.2 à 6.7.
