# Atelier 2 — attaques, détection et mitigation sur une blockchain PoW/PoS

Petite plateforme expérimentale construite au-dessus de la blockchain de l'atelier 1.
Un simulateur **C11 déterministe** exécute un réseau de nœuds, quatre attaques, un
détecteur à règles et des contre-mesures. Un tableau de bord local **FastAPI + Jinja2**
permet de lancer un scénario et de lire les résultats.

Le projet reste volontairement minimal : pas de dépendance à un framework front, pas de
pipeline ML Python, pas de base de données. Les résultats sont des fichiers CSV/JSON.

> **Atelier 3 (Solidity)** : le contrat `MiniSocial` se trouve dans `atelier3/MiniSocial.sol`.
> Le rapport détaillé est dans `report/rapport_atelier3.md`.

---

## Démarrage rapide

```bash
# 1. Compiler le simulateur
mingw32-make sim          # Windows / MinGW
# ou : make sim           # Linux / macOS

# 2. Lancer la matrice courte (18 exécutions)
python run_experiments.py --quick --clean

# 3. Lancer la matrice complète (108 exécutions, 3 graines)
python run_experiments.py --clean

# 4. Ouvrir le tableau de bord
python -m pip install -r requirements.txt
python -m uvicorn dashboard.app:app --host 127.0.0.1 --port 8000
```

Ouvrir ensuite <http://127.0.0.1:8000>.

Un scénario peut aussi être exécuté directement :

```bash
.\sim.exe scenarios/generated/51-pow-n50-s1-raw.cfg
```

---

## Architecture

```text
core/                 simulateur C : blocs, PoW/PoS, réseau, attaques, métriques, détecteur
dashboard/            interface FastAPI + templates Jinja2 + CSS
scenarios/generated/  scénarios .cfg produits par le runner et le dashboard
results/runs/         une sortie par exécution
results/summaries.csv tableau agrégé des exécutions
results/summary.md    tableau Markdown prêt pour le rapport
run_experiments.py    matrice reproductible (stdlib uniquement)
report/               rapport technique
Makefile
sha256.h, merkle_tree.c, proof_of_work.c, proof_of_stake.c, blockchain_core.c
                      fichiers de l'atelier 1, renommés sans modification du code
```

Le simulateur est déterministe pour un couple `(scénario, graine)`. Le temps est simulé
en millisecondes ; un bloc cible est produit toutes les 10 s. La difficulté PoW est fixée
à 2 pour garder les exécutions rapides.

---

## Attaques simulées

| Attaque | Mécanisme | Indicateur d'échec / succès |
|---|---|---|
| `51` | chaîne privée majoritaire, paiement victime puis réorganisation | paiement accepté, inclus, puis retiré de la chaîne canonique |
| `selfish` | rétention puis publication stratégique de blocs | part de revenu de l'attaquant > sa part de hash + 2 points |
| `withholding` | un saboteur dans un pool retient ses blocs | taux de blocs retenus ≥ 10 % |
| `sybil` | nœuds Sybil et eclipse de victimes | retard de la victime ≥ 3 blocs ou chaîne divergente |

Chaque attaque est comparée à une exécution sans défense et à une exécution avec défense.

---

## Détection et mitigation

Le détecteur utilisé par la matrice est **à règles**. Il calcule 24 métriques par fenêtre
de 10 blocs (taux d'orphelins, réorganisations, part du mineur dominant, déséquilibre de
pool, concentration de messages, retard de propagation, etc.) et lève une alerte au-delà
de seuils interprétables. Les modes `adaptive`, `ml` et `ensemble` restent présents dans
le cœur C mais ne sont pas utilisés ici.

Les contre-mesures sont activées par `defense=1` :

| Contre-mesure | Attaque ciblée |
|---|---|
| profondeur de confirmation portée à 9 | double dépense |
| plafond de réorganisation à 6 blocs | double dépense |
| audit de pool | block withholding |
| diversité de pairs | Sybil / eclipse |
| randomisation des ex æquo | selfish mining |
| pénalité de revenu de 50 % | selfish mining |
| gel des paiements sur alerte | double dépense |

Le compromis est explicite : le plafond de réorganisation protège la finalité mais peut
augmenter fortement le taux d'orphelins. Les résultats le montrent.

---

## Protocole expérimental

La matrice complète contient **108 exécutions** :

- 4 attaques × 2 consensus (PoW, PoS) × 2 tailles de réseau (50, 100 nœuds)
  × 2 états de défense × 3 graines (1, 2, 3) ;
- 12 exécutions de référence sans attaque (2 consensus × 2 tailles × 3 graines).

Paramètres principaux : 300 blocs (600 pour l'attaque 51 %), part attaquant 60 %
(80 % pour l'attaque 51 %), confirmation à 6 blocs, détecteur à règles.

Pour chaque exécution, le simulateur écrit :

```text
summary.json   indicateurs agrégés
windows.csv    métriques et score par fenêtre
alerts.csv     alertes du détecteur
blocks.csv     blocs, parents, mineur, travail, statut canonique
nodes.csv      rôle, part de hash/stake, blocs, paiements
events.jsonl   journal d'événements
```

---

## Résultats (matrice complète)

| Attaque | Sans défense | Avec défense | Détection (sans défense) | Perte victime | Profit attaquant |
|---|---:|---:|---:|---:|---:|
| 51 % | 83 % | 0 % | 442 s | 833 | 24 733 |
| Selfish mining | 100 % | 0 % | 1 333 s | 3 629 | 2 088 |
| Block withholding | 100 % | 0 % | 283 s | 1 662 | 855 |
| Sybil / eclipse | 100 % | 0 % | 408 s | 1 412 | 141 |

Moyennes sur 12 exécutions par ligne (attaques, deux consensus, deux tailles, trois graines).
Le détail par consensus, taille et défense est dans `results/summary.md`.

Points saillants :

- les quatre attaques réussissent sans défense et sont bloquées avec défense ;
- le détecteur à règles détecte les 48 exécutions attaquées non défendues (100 %) ;
  on compte 4 alertes classées fausses sur les 108 exécutions, dont une sur une
  référence sans attaque ;
- le selfish mining est l'attaque la plus lente à détecter (≈ 22 min simulées) ;
- la défense contre 51 % fait chuter le profit de l'attaquant mais pousse le taux
  d'orphelins à ≈ 77 % : c'est un coût de vivacité, pas un gain gratuit.

---

## Tableau de bord

- **Overview** : nombre d'exécutions, taux de détection, taux de succès par attaque,
  comparaison sans/avec défense.
- **Runs** : historique complet, filtrable visuellement par colonnes.
- **Run detail** : indicateurs, courbe orphelins/score, fenêtres, alertes, fichiers bruts.
- **New run** : formulaire qui écrit un `.cfg`, exécute `sim.exe` et redirige vers le résultat.

Le style reprend les codes de Vercel : fond blanc, texte noir, bordures fines, cartes
arrondies, typographie système, bouton principal noir, mode sombre automatique.

---

## Limites

- Le modèle réseau est simplifié : pas de mempool réaliste, pas de frais dynamiques,
  pas de difficulté ajustable.
- La détection à règles est volontairement interprétable ; elle est calibrée sur ces
  scénarios et ne prétend pas généraliser à un réseau réel.
- La défense privilégie la sécurité à la vivacité : le plafond de réorganisation peut
  retarder la chaîne canonique.
- Les résultats sont des moyennes sur 3 graines ; les intervalles de confiance ne sont
  pas calculés pour rester dans le périmètre minimal.

---

## Atelier 1

Les fichiers de l'atelier 1 ont été renommés pour être lisibles, sans modification de leur
code :

| Ancien nom | Nouveau nom |
|---|---|
| `ex1_merkle.c` | `merkle_tree.c` |
| `ex2_pow.c` | `proof_of_work.c` |
| `ex3_pos.c` | `proof_of_stake.c` |
| `ex4_blockchain.c` | `blockchain_core.c` |

Les démos se compilent avec `mingw32-make demos` dans `bin/`.
