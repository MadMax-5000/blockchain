# Atelier 3 — MiniSocial en Solidity

Contrat minimal de réseau social on-chain : publier un message, lire un message,
compter les messages.

## Fichier

```text
MiniSocial.sol
```

Le contrat ne dépend d'aucune bibliothèque externe. Il n'y a ni owner, ni suppression,
ni modification de message : chaque publication est immuable.

## API

| Fonction | Type | Rôle |
|---|---|---|
| `publishPost(string _message)` | transaction | ajoute un `Post(message, msg.sender)` |
| `getPost(uint index)` | lecture | retourne `(message, author)` |
| `getTotalPosts()` | lecture | retourne le nombre de posts |

## Remix

1. Ouvrir <https://remix.ethereum.org>.
2. Créer `MiniSocial.sol` et coller le contenu de `atelier3/MiniSocial.sol`.
3. Compiler avec Solidity `0.8.20` ou plus récent.
4. Dans **Deploy & Run Transactions**, choisir :
   - `Remix VM` pour un test local immédiat ;
   - `Injected Provider - MetaMask` pour Sepolia.
5. Déployer, puis publier des messages avec plusieurs comptes.
6. Lire `getTotalPosts()` puis `getPost(0)`, `getPost(1)`, etc.

## Résultat de référence

Les tests locaux (Ganache, chainId 1337, trois comptes) sont détaillés dans
`report/rapport_atelier3.md` : 3 messages publiés, 3 auteurs distincts, total = 3,
et `getPost(99)` revert correctement.

## Remarque

Le déploiement Sepolia nécessite un compte MetaMask financé en SepoliaETH. Aucune clé
privée n'est stockée dans ce dépôt.
