/* Exercice 4 : Blockchain simple (transactions + Merkle + chainage + PoW / PoS) */
#include "sha256.h"
#include <stdlib.h>
#include <time.h>

#define MAX 16
#define ZEROS "0000000000000000000000000000000000000000000000000000000000000000"
#define DIFF 4
#define NV 3
enum { POW, POS };

typedef struct {
    int index;
    char tx[4][32];  int ntx;
    char merkle[65], prev[65], hash[65];
    unsigned long nonce;
    char validator[16];
} Block;

Block chain[MAX];
int len, mode;
const char *validators[NV] = { "Alice", "Bob", "Charlie" };
const int stakes[NV] = { 50, 30, 20 };

/* Racine de Merkle des transactions du bloc */
void merkle_root(const Block *b, char root[65]) {
    char lv[8][65], buf[129];
    for (int i = 0; i < b->ntx; i++) sha256_hex(b->tx[i], lv[i]);
    int cnt = b->ntx;
    while (cnt > 1) {
        if (cnt % 2) { strcpy(lv[cnt], lv[cnt - 1]); cnt++; }
        for (int i = 0; i < cnt / 2; i++) {
            memcpy(buf, lv[2 * i], 64); memcpy(buf + 64, lv[2 * i + 1], 64); buf[128] = '\0';
            sha256_hex(buf, lv[i]);
        }
        cnt /= 2;
    }
    strcpy(root, lv[0]);
}

void calc_hash(const Block *b, char out[65]) {
    char buf[300];
    snprintf(buf, sizeof buf, "%d|%s|%s|%lu|%s", b->index, b->merkle, b->prev, b->nonce, b->validator);
    sha256_hex(buf, out);
}

/* Creation d'un bloc : consensus PoW (minage) ou PoS (validateur tire selon sa mise) */
void add_block(const char *txs[], int ntx) {
    Block *b = &chain[len];
    memset(b, 0, sizeof *b);
    b->index = len;
    b->ntx = ntx;
    for (int i = 0; i < ntx; i++) strcpy(b->tx[i], txs[i]);
    merkle_root(b, b->merkle);
    strcpy(b->prev, len ? chain[len - 1].hash : ZEROS);

    if (mode == POW) {
        for (;; b->nonce++) { calc_hash(b, b->hash); if (hash_has_zeros(b->hash, DIFF)) break; }
    } else {
        int r = rand() % 100, acc = 0, v = NV - 1;
        for (int i = 0; i < NV; i++) { acc += stakes[i]; if (r < acc) { v = i; break; } }
        strcpy(b->validator, validators[v]);
        calc_hash(b, b->hash);
    }
    len++;
}

/* Verification d'integrite de toute la chaine */
int verify(void) {
    char tmp[65];
    for (int i = 0; i < len; i++) {
        Block *b = &chain[i];
        merkle_root(b, tmp);
        if (strcmp(tmp, b->merkle)) { printf("  Bloc %d invalide : transactions modifiees (Merkle)\n", i); return 0; }
        calc_hash(b, tmp);
        if (strcmp(tmp, b->hash))   { printf("  Bloc %d invalide : hash incorrect\n", i); return 0; }
        if (mode == POW && !hash_has_zeros(b->hash, DIFF)) { printf("  Bloc %d invalide : preuve de travail absente\n", i); return 0; }
        if (mode == POS) {
            int ok = 0;
            for (int k = 0; k < NV; k++) if (!strcmp(validators[k], b->validator)) ok = 1;
            if (!ok) { printf("  Bloc %d invalide : validateur inconnu\n", i); return 0; }
        }
        if (i && strcmp(b->prev, chain[i - 1].hash)) { printf("  Bloc %d invalide : chainage rompu\n", i); return 0; }
    }
    return 1;
}

void print_chain(void) {
    for (int i = 0; i < len; i++) {
        printf("Bloc %d | %d tx | prev=%.8s | hash=%.8s | ", i, chain[i].ntx, chain[i].prev, chain[i].hash);
        if (mode == POW) printf("nonce=%lu\n", chain[i].nonce); else printf("validateur=%s\n", chain[i].validator);
    }
}

double scenario(int m) {
    mode = m; len = 0;
    printf("\n========== %s ==========\n", m == POW ? "PROOF OF WORK (difficulte 4)" : "PROOF OF STAKE");

    clock_t t0 = clock();
    const char *g[]  = { "Genesis" };
    const char *b1[] = { "Alice->Bob:10", "Bob->Charlie:5" };
    const char *b2[] = { "Charlie->Dave:2", "Dave->Alice:1", "Alice->Charlie:3" };
    const char *b3[] = { "Bob->Dave:8" };
    add_block(g, 1); add_block(b1, 2); add_block(b2, 3); add_block(b3, 1);
    double t = (double)(clock() - t0) * 1000.0 / CLOCKS_PER_SEC;

    print_chain();
    printf("Creation : %.3f ms | Chaine valide ? %s\n", t, verify() ? "OUI" : "NON");

    Block backup[MAX];
    memcpy(backup, chain, sizeof chain);

    printf("\nAttaque 1 : modification d'une transaction du bloc 1\n");
    strcpy(chain[1].tx[0], "Alice->Bob:1000");
    printf("  Chaine valide ? %s\n", verify() ? "OUI" : "NON");

    memcpy(chain, backup, sizeof chain);
    printf("\nAttaque 2 : modification + recalcul du Merkle et du hash du bloc 1\n");
    strcpy(chain[1].tx[0], "Alice->Bob:1000");
    merkle_root(&chain[1], chain[1].merkle);
    calc_hash(&chain[1], chain[1].hash);
    printf("  Chaine valide ? %s\n", verify() ? "OUI" : "NON");

    memcpy(chain, backup, sizeof chain);
    return t;
}

int main(void) {
    srand(42);
    double t_pow = scenario(POW);
    double t_pos = scenario(POS);
    printf("\n========== Comparaison ==========\n");
    printf("PoW : %.3f ms | PoS : %.3f ms\n", t_pow, t_pos);
    return 0;
}
