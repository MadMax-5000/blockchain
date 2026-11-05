# Rapport — Atelier 2

## Simulation, détection et mitigation d'attaques sur une blockchain PoW/PoS

**Projet :** extension de la blockchain de l'atelier 1
**Langages :** C11 pour le simulateur, Python 3 pour l'orchestration et le tableau de bord
**Périmètre :** quatre attaques, un détecteur à règles, des contre-mesures ciblées,
une matrice reproductible de 108 exécutions.

---

## 1. Objectif

L'atelier 1 fournit une blockchain minimale : blocs, Merkle, preuve de travail, preuve
d'enjeu et choix de chaîne. L'atelier 2 ajoute une couche expérimentale pour répondre à
trois questions :

1. Peut-on reproduire quatre attaques classiques sur cette blockchain ?
2. Peut-on les détecter à partir de métriques réseau observables ?
3. Les contre-mesures bloquent-elles les attaques, et à quel coût ?

Le projet reste volontairement minimal. Le simulateur C existant n'a pas été réécrit :
il a été conservé comme cœur. Le travail porte sur l'orchestration, la mesure, la
comparaison et la restitution.

---

## 2. Choix de conception

| Choix | Raison |
|---|---|
| Cœur C11 déterministe | reproduire exactement une exécution à partir d'une graine |
| Détecteur à règles | interprétable, rapide, suffisant pour les quatre scénarios |
| Pas de ML Python | éviter une dépendance et une complexité inutiles |
| Fichiers CSV/JSON | résultats lisibles, versionnables, exploitables sans base de données |
| Dashboard FastAPI + Jinja2 | interface locale légère, sans framework front |
| Matrice courte | 108 exécutions, moins d'une minute sur une machine de bureau |

Les modes `adaptive`, `ml` et `ensemble` restent présents dans le cœur C, mais la matrice
utilise uniquement `detector=rule`.

---

## 3. Architecture

```text
core/                 simulateur C : blocs, consensus, réseau, attaques, métriques, détecteur
dashboard/            FastAPI + templates Jinja2 + CSS
scenarios/generated/  un fichier .cfg par exécution
results/runs/         summary.json, windows.csv, alerts.csv, blocks.csv, nodes.csv
results/summaries.csv tableau agrégé des 108 exécutions
results/summary.md    tableau Markdown agrégé
run_experiments.py    génération des scénarios et exécution de la matrice
report/               ce rapport
```

Le simulateur est à événements discrets. Le temps est exprimé en millisecondes simulées.
Un bloc cible est produit toutes les 10 secondes ; la difficulté PoW est fixée à 2 pour
garder les exécutions rapides. Le réseau applique une latence, une gigue et un degré de
gossip dépendant de la taille du réseau.

Chaque nœud possède un rôle (`honest`, `attacker`, `saboteur`, `sybil`), une part de hash
ou d'enjeu, une vue locale de la chaîne et un ensemble de pairs. Les blocs sont propagés
par événements ; les fourches sont arbitrées par le travail cumulé (PoW) ou par le choix
de chaîne (PoS).

---

## 4. Attaques simulées

| Attaque | Configuration | Critère de succès |
|---|---|---|
| Double dépense 51 % | part attaquant 80 %, 600 blocs | paiement inclus, accepté, puis absent de la chaîne canonique |
| Selfish mining | part attaquant 60 %, 300 blocs | revenu de l'attaquant > part de hash + 2 points |
| Block withholding | pool 40 %, saboteur 30 %, 300 blocs | taux de blocs retenus ≥ 10 % |
| Sybil / eclipse | `nodes/2` nœuds Sybil, `nodes/10` victimes | retard victime ≥ 3 blocs ou chaîne divergente |

L'attaque 51 % utilise une part de 80 % et une durée de 600 blocs : avec 60 % et 300 blocs,
la chaîne privée n'a pas toujours le temps de dépasser la profondeur de confirmation dans
ce modèle. Le choix de 80 % reste une attaque majoritaire et permet d'observer proprement
le double spend. Les autres attaques utilisent 60 % et 300 blocs.

---

## 5. Détection

Le détecteur calcule **24 métriques par fenêtre de 10 blocs** :

- taux d'orphelins, de blocs périmés, de fourches ;
- profondeur de réorganisation, ratio et coefficient de variation des intervalles ;
- délais de propagation p50/p95, divergence de tip ;
- part du mineur dominant, Gini des récompenses, écart de part de pool ;
- taux de blocs retenus, ratio de pairs Sybil, taux d'invalidité ;
- concentration des messages, concentration par sous-réseau, incohérence de chaîne ;
- taux de rollback, doublons, orphelins du mineur dominant, écart de hash, miniers actifs.

Le mode `rule` combine des seuils interprétables. Une alerte contient la fenêtre, le temps,
le score, le label, le nœud suspect et le type d'anomalie. Les alertes sont écrites dans
`alerts.csv` et rappelées dans `summary.json`.

La détection est évaluée sur les exécutions **sans défense** : une contre-mesure peut
arrêter l'attaque avant que le détecteur n'ait accumulé assez de fenêtres, ce qui rendrait
le temps de détection artificiellement court ou absent.

---

## 6. Mitigations

| Contre-mesure | Paramètre | Attaque ciblée |
|---|---|---|
| Profondeur de confirmation | 6 → 9 blocs | double dépense |
| Plafond de réorganisation | 6 blocs | double dépense |
| Audit de pool | bannissement du saboteur | block withholding |
| Diversité de pairs | pairs hors sous-réseau | Sybil / eclipse |
| Randomisation des ex æquo | tirage aléatoire | selfish mining |
| Pénalité de revenu | 50 % | selfish mining |
| Gel sur alerte | paiement gelé | double dépense |

Ces mesures sont activées ensemble par `defense=1`. Le but n'est pas de mesurer chaque
mesure isolément, mais de vérifier qu'un ensemble cohérent bloque les quatre attaques.

---

## 7. Protocole expérimental

La matrice complète contient **108 exécutions** :

- 4 attaques × 2 consensus (PoW, PoS) × 2 tailles (50, 100 nœuds)
  × 2 états de défense × 3 graines (1, 2, 3) = 96 ;
- 12 références sans attaque (2 consensus × 2 tailles × 3 graines).

Paramètres communs :

```text
difficulty=2
block_interval_ms=10000
window_blocks=10
confirm_depth=6
detector=rule
attack_start_height=20
```

Commande de reproduction :

```bash
mingw32-make sim
python run_experiments.py --clean
```

Le runner est déterministe : chaque scénario est écrit dans
`scenarios/generated/<nom>.cfg`, puis exécuté par `sim.exe`. Les résultats sont agrégés
dans `results/summaries.csv` et `results/summary.md`.

---

## 8. Résultats

### 8.1 Taux de succès

Moyennes sur 12 exécutions par ligne (deux consensus, deux tailles, trois graines).

| Attaque | Sans défense | Avec défense |
|---|---:|---:|
| 51 % | **83 %** | **0 %** |
| Selfish mining | **100 %** | **0 %** |
| Block withholding | **100 %** | **0 %** |
| Sybil / eclipse | **100 %** | **0 %** |

Les quatre attaques réussissent sans défense et sont bloquées avec défense. Pour l'attaque
51 %, le taux de 83 % s'explique par les deux tailles de réseau : 100 % à 50 nœuds,
67 % à 100 nœuds, car la latence et la propagation laissent moins de temps à la chaîne
privée pour dépasser la confirmation.

### 8.2 Détection

| Attaque | Temps moyen (sans défense) | Alertes / exécution | Faux positifs / exécution |
|---|---:|---:|---:|
| 51 % | 442 s | 1,1 | 0,00 |
| Selfish mining | 1 333 s | 1,9 | 0,00 |
| Block withholding | 283 s | 8,3 | 0,00 |
| Sybil / eclipse | 408 s | 6,5 | 0,00 |

Les 48 exécutions attaquées sans défense sont toutes détectées, soit un taux de 100 %.
Sur l'ensemble des 108 exécutions, 4 alertes sont classées fausses : une sur une référence
sans attaque et trois sur des exécutions défendues. Le détecteur est donc très sensible
sur ces scénarios, avec un bruit résiduel faible.

Le selfish mining est le plus lent à détecter (≈ 22 minutes simulées) : la chaîne privée
reste longtemps indistinguable d'une fourche normale, et le signal devient net seulement
quand la part de revenu dévie durablement.

### 8.3 Impact économique

| Attaque | Perte victime (sans défense) | Profit attaquant (sans défense) | Perte victime (avec défense) | Profit attaquant (avec défense) |
|---|---:|---:|---:|---:|
| 51 % | 833 | 24 733 | 0 | 708 |
| Selfish mining | 3 629 | 2 088 | 3 008 | −2 786 |
| Block withholding | 1 662 | 855 | 121 | −1 157 |
| Sybil / eclipse | 1 412 | 141 | 50 | 5 |

La défense ne supprime pas toute perte résiduelle : en selfish mining, les orphelins
honnêtes existent avant que la pénalité ne s'applique. En revanche, le profit de
l'attaquant devient négatif pour le selfish mining et le block withholding, ce qui
désincite l'attaque.

Pour le block withholding, la perte du pool reste élevée (≈ 1 038 sans défense,
≈ 1 092 avec défense) car l'audit bannit le saboteur mais ne récupère pas les blocs déjà
reténus. La perte de la victime, elle, chute de 1 662 à 121.

### 8.4 Coût de la défense

| Attaque | Orphelins sans défense | Orphelins avec défense | Temps moyen sans défense | Temps moyen avec défense |
|---|---:|---:|---:|---:|
| 51 % | 2,7 % | **77,3 %** | 1 048 ms | 745 ms |
| Selfish mining | 23,2 % | 24,4 % | 626 ms | 664 ms |
| Block withholding | 14,5 % | 5,3 % | 598 ms | 499 ms |
| Sybil / eclipse | 12,9 % | 3,8 % | 600 ms | 686 ms |

Le coût principal concerne l'attaque 51 % : le plafond de réorganisation empêche la
chaîne privée de remplacer la chaîne publique, mais il orpheline aussi la majorité des
blocs de l'attaquant. Avec 80 % de la puissance de calcul, cela représente ≈ 77 % des
blocs produits. C'est un choix **sécurité contre vivacité** : la double dépense est
bloquée, mais la chaîne canonique progresse lentement.

Pour les autres attaques, la défense ne dégrade pas les orphelins ; elle les réduit même
pour le block withholding et le Sybil, car le saboteur ou les nœuds Sybil sont neutralisés.

### 8.5 Différences PoW / PoS

Les taux de succès et les pertes sont proches entre PoW et PoS. Les écarts observés
relèvent surtout de la variabilité des graines et de la propagation :

- 51 % : 83 % en PoW comme en PoS ;
- selfish mining : 100 % dans les deux consensus ;
- block withholding : 100 % dans les deux consensus ;
- Sybil : 100 % dans les deux consensus.

La défense bloque les quatre attaques dans les deux consensus. Le détail par consensus,
taille et défense est disponible dans `results/summary.md`.

---

## 9. Reproductibilité

```bash
# matrice courte : 1 graine, 50 nœuds, 18 exécutions
python run_experiments.py --quick --clean

# matrice complète : 3 graines, 50 et 100 nœuds, 108 exécutions
python run_experiments.py --clean

# dashboard local
python -m uvicorn dashboard.app:app --host 127.0.0.1 --port 8000
```

Chaque exécution est identifiée par son nom et sa graine. Les fichiers
`scenarios/generated/*.cfg` permettent de rejouer une exécution isolée :

```bash
.\sim.exe scenarios/generated/selfish-pow-n50-s1-raw.cfg
```

Le tableau de bord lit directement `results/runs/*/summary.json` et affiche :

- le taux de succès par attaque, sans et avec défense ;
- le temps de détection et le nombre d'alertes ;
- les courbes orphelins / score par fenêtre ;
- les fenêtres et alertes d'une exécution ;
- un formulaire pour lancer un nouveau scénario.

---

## 10. Limites

- Réseau simplifié : pas de mempool réaliste, pas de frais dynamiques, pas d'ajustement
  de difficulté.
- Détecteur à règles calibré sur ces scénarios ; la généralisation à un réseau réel n'est
  pas démontrée.
- Trois graines seulement : les résultats sont des tendances, pas des intervalles de
  confiance.
- La défense est un ensemble de mesures activées simultanément ; l'ablation mesure par
  mesure n'est pas incluse.
- Le coût de la défense 51 % est sévère en termes de vivacité ; une vraie plateforme
  ajouterait des points de contrôle ou une finalité externe.

---

## 11. Conclusion

La plateforme répond aux objectifs de l'atelier avec un périmètre réduit :

- les quatre attaques sont reproduites de façon déterministe ;
- le détecteur à règles les identifie toutes sans défense, avec peu de faux positifs ;
- les contre-mesures bloquent les quatre attaques ;
- les résultats chiffrés montrent le compromis entre sécurité, profit et vivacité.

Le point le plus instructif est l'attaque 51 % : la défense est efficace, mais elle
transforme une attaque réussie en une perte de vivacité mesurable. C'est précisément le
type d'arbitrage qu'une plateforme de sécurité doit rendre visible.

---

## Annexe — Fichiers produits

| Fichier | Contenu |
|---|---|
| `summary.json` | indicateurs agrégés d'une exécution |
| `windows.csv` | 24 métriques, label, score et détection par fenêtre |
| `alerts.csv` | alertes du détecteur |
| `blocks.csv` | blocs, parents, mineur, travail, statut canonique |
| `nodes.csv` | rôle, hash/stake, blocs, paiements, bannissement |
| `events.jsonl` | journal d'événements du simulateur |
| `results/summaries.csv` | agrégat des 108 exécutions |
| `results/summary.md` | tableau Markdown prêt à intégrer |
