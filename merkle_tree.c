/* Exercice 1 : Arbre de Merkle basique */
#include "sha256.h"

#define MAX 16

/* Calcule la racine de Merkle de n transactions (affiche les niveaux si print=1) */
void merkle_root(char tx[][64], int n, char root[65], int print) {
    char lv[MAX][65], buf[129];
    for (int i = 0; i < n; i++) sha256_hex(tx[i], lv[i]);      /* feuilles = hash des tx */
    int cnt = n, level = 0;
    while (cnt > 1) {
        if (print) {
            printf("  Niveau %d : ", level++);
            for (int i = 0; i < cnt; i++) printf("[%.8s] ", lv[i]);
            printf("\n");
        }
        if (cnt % 2) { strcpy(lv[cnt], lv[cnt - 1]); cnt++; }  /* nombre impair : on duplique */
        for (int i = 0; i < cnt / 2; i++) {                    /* parent = H(gauche + droite) */
            memcpy(buf, lv[2 * i], 64);
            memcpy(buf + 64, lv[2 * i + 1], 64);
            buf[128] = '\0';
            sha256_hex(buf, lv[i]);
        }
        cnt /= 2;
    }
    if (print) printf("  Niveau %d : [%.8s] (racine)\n", level, lv[0]);
    strcpy(root, lv[0]);
}

int main(void) {
    char tx[][64] = { "Alice->Bob:10", "Bob->Charlie:5", "Charlie->Dave:2", "Dave->Eve:7", "Eve->Alice:1" };
    char root1[65], root2[65];

    printf("=== Arbre de Merkle (5 transactions) ===\n");
    merkle_root(tx, 5, root1, 1);
    printf("Racine : %s\n\n", root1);
    return 0;
}
