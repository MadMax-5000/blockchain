/* Exercice 3 : Proof of Stake + comparaison avec Proof of Work */
#include "sha256.h"
#include <stdlib.h>
#include <time.h>

#define ZEROS "0000000000000000000000000000000000000000000000000000000000000000"
#define NV 4

typedef struct { char name[16]; int stake; } Validator;
Validator vals[NV] = { {"Alice", 50}, {"Bob", 30}, {"Charlie", 15}, {"Dave", 5} };

typedef struct { int index; char data[64]; char prev[65]; char hash[65]; unsigned long nonce; char validator[16]; } Block;

void calc_hash(const Block *b, char out[65]) {
    char buf[256];
    snprintf(buf, sizeof buf, "%d|%s|%s|%lu|%s", b->index, b->data, b->prev, b->nonce, b->validator);
    sha256_hex(buf, out);
}

/* PoW : minage */
void pow_create(Block *b, int d) {
    for (b->nonce = 0;; b->nonce++) { calc_hash(b, b->hash); if (hash_has_zeros(b->hash, d)) return; }
}
int pow_valid(const Block *b, int d) {
    char h[65]; calc_hash(b, h);
    return !strcmp(h, b->hash) && hash_has_zeros(h, d);
}

/* PoS : le validateur est tire au sort avec une probabilite proportionnelle a sa mise */
int select_validator(void) {
    int total = 0, acc = 0;
    for (int i = 0; i < NV; i++) total += vals[i].stake;
    int r = rand() % total;
    for (int i = 0; i < NV; i++) { acc += vals[i].stake; if (r < acc) return i; }
    return NV - 1;
}
void pos_create(Block *b) {
    strcpy(b->validator, vals[select_validator()].name);
    b->nonce = 0;
    calc_hash(b, b->hash);                 /* un seul hash, pas de minage */
}
int pos_valid(const Block *b) {
    char h[65]; calc_hash(b, h);
    for (int i = 0; i < NV; i++)
        if (!strcmp(vals[i].name, b->validator) && vals[i].stake > 0) return !strcmp(h, b->hash);
    return 0;
}

double ms(clock_t t0) { return (double)(clock() - t0) * 1000.0 / CLOCKS_PER_SEC; }

int main(void) {
    srand(42);

    printf("=== Selection du validateur (1000 tirages) ===\n");
    int count[NV] = {0};
    for (int i = 0; i < 1000; i++) count[select_validator()]++;
    for (int i = 0; i < NV; i++)
        printf("%-8s stake=%2d%% | choisi %.1f%% du temps\n", vals[i].name, vals[i].stake, count[i] / 10.0);

    printf("\n=== Validation d'un bloc PoS ===\n");
    Block b = { .index = 1 };
    strcpy(b.data, "Alice->Bob:10"); strcpy(b.prev, ZEROS);
    pos_create(&b);
    printf("Validateur : %s | valide ? %s\n", b.validator, pos_valid(&b) ? "OUI" : "NON");
    strcpy(b.data, "Alice->Bob:1000");
    printf("Apres falsification : valide ? %s\n", pos_valid(&b) ? "OUI" : "NON");

    printf("\n=== PoW (difficulte 4) vs PoS : 10 blocs ===\n");
    Block blocks[10];
    clock_t t0 = clock();
    for (int i = 0; i < 10; i++) {
        memset(&blocks[i], 0, sizeof(Block));
        blocks[i].index = i; strcpy(blocks[i].data, "tx");
        strcpy(blocks[i].prev, i ? blocks[i - 1].hash : ZEROS);
        pow_create(&blocks[i], 4);
    }
    double t_pow = ms(t0);
    t0 = clock();
    for (int i = 0; i < 10; i++) {
        memset(&blocks[i], 0, sizeof(Block));
        blocks[i].index = i; strcpy(blocks[i].data, "tx");
        strcpy(blocks[i].prev, i ? blocks[i - 1].hash : ZEROS);
        pos_create(&blocks[i]);
    }
    double t_pos = ms(t0);
    printf("PoW : %.3f ms\nPoS : %.3f ms\n", t_pow, t_pos);
    printf("Le plus rapide : %s\n", t_pos < t_pow ? "PoS (pas de minage)" : "PoW");
    return 0;
}
