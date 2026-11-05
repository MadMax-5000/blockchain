/* Exercice 2 : Proof of Work (blocs + chaine + difficulte variable) */
#include "sha256.h"
#include <time.h>

#define MAX 16
#define ZEROS "0000000000000000000000000000000000000000000000000000000000000000"

typedef struct { int index; char data[64]; char prev[65]; char hash[65]; unsigned long nonce; } Block;

void calc_hash(const Block *b, char out[65]) {
    char buf[256];
    snprintf(buf, sizeof buf, "%d|%s|%s|%lu", b->index, b->data, b->prev, b->nonce);
    sha256_hex(buf, out);
}

/* Minage : on incremente le nonce jusqu'a obtenir 'd' zeros au debut du hash */
void mine(Block *b, int d) {
    b->nonce = 0;
    for (;;) {
        calc_hash(b, b->hash);
        if (hash_has_zeros(b->hash, d)) return;
        b->nonce++;
    }
}

void add_block(Block *chain, int *n, const char *data, int d) {
    Block *b = &chain[*n];
    b->index = *n;
    snprintf(b->data, sizeof b->data, "%s", data);
    strcpy(b->prev, *n ? chain[*n - 1].hash : ZEROS);
    mine(b, d);
    (*n)++;
}

int is_valid(const Block *chain, int n, int d) {
    char h[65];
    for (int i = 0; i < n; i++) {
        calc_hash(&chain[i], h);
        if (strcmp(h, chain[i].hash) || !hash_has_zeros(h, d)) { printf("  Bloc %d invalide (hash/PoW)\n", i); return 0; }
        if (i && strcmp(chain[i].prev, chain[i - 1].hash))     { printf("  Bloc %d invalide (chainage)\n", i); return 0; }
    }
    return 1;
}

int main(void) {
    Block chain[MAX];
    int n = 0;

    printf("=== Chaine de 4 blocs (difficulte 3) ===\n");
    const char *data[] = { "Genesis", "Alice->Bob:10", "Bob->Charlie:5", "Charlie->Dave:2" };
    for (int i = 0; i < 4; i++) add_block(chain, &n, data[i], 3);
    for (int i = 0; i < n; i++)
        printf("Bloc %d | nonce=%-6lu | hash=%.16s... | %s\n", i, chain[i].nonce, chain[i].hash, chain[i].data);
    printf("Chaine valide ? %s\n\n", is_valid(chain, n, 3) ? "OUI" : "NON");

    printf("=== Falsification du bloc 1 ===\n");
    strcpy(chain[1].data, "Alice->Bob:1000");
    printf("Chaine valide ? %s\n\n", is_valid(chain, n, 3) ? "OUI" : "NON");

    printf("=== Temps de minage par difficulte (moyenne de 3 blocs) ===\n");
    printf("Difficulte | Temps (ms)\n");
    for (int d = 1; d <= 5; d++) {
        n = 0;
        clock_t t0 = clock();
        for (int i = 0; i < 3; i++) add_block(chain, &n, "tx", d);
        printf("%10d | %.2f\n", d, (double)(clock() - t0) * 1000.0 / CLOCKS_PER_SEC / 3);
    }
    return 0;
}
