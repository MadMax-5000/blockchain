/* bc_core.c - Coeur blockchain : Merkle, SHA-256, PoW/PoS, chaines et forks */
#include "sim.h"

/* ------------------------------------------------------------------ */
/* Table de hachage des blocs                                          */
/* ------------------------------------------------------------------ */
static uint64_t hash_key(const char *h) {
    uint64_t v = 0;
    for (int i = 0; i < 16; i++) {
        char c = h[i];
        int d;
        if (c >= '0' && c <= '9') d = c - '0';
        else if (c >= 'a' && c <= 'f') d = c - 'a' + 10;
        else if (c >= 'A' && c <= 'F') d = c - 'A' + 10;
        else d = 0;
        v = (v << 4) | (uint64_t)d;
    }
    return v;
}

void store_init(BlockStore *s) {
    s->nblocks = 0;
    memset(s->map, 0, sizeof s->map);
}

int store_find(BlockStore *s, const char *hash) {
    uint64_t k = hash_key(hash);
    uint32_t i = (uint32_t)(k & (MAP_SIZE - 1));
    for (int probe = 0; probe < MAP_SIZE; probe++) {
        int slot = s->map[i];
        if (slot == 0) return -1;
        int id = slot - 1;
        if (!strcmp(s->blocks[id].hash, hash)) return id;
        i = (i + 1) & (MAP_SIZE - 1);
    }
    return -1;
}

int store_add(BlockStore *s, Block *b) {
    if (s->nblocks >= MAX_BLOCKS) return -1;
    int id = s->nblocks++;
    s->blocks[id] = *b;
    uint64_t k = hash_key(b->hash);
    uint32_t i = (uint32_t)(k & (MAP_SIZE - 1));
    while (s->map[i] != 0) i = (i + 1) & (MAP_SIZE - 1);
    s->map[i] = id + 1;
    return id;
}

/* ------------------------------------------------------------------ */
/* Merkle et hash                                                      */
/* ------------------------------------------------------------------ */
void merkle_root_block(const Block *b, char out[65]) {
    char lv[MAX_TX * 2][65], buf[129];
    if (b->ntx <= 0) { strcpy(out, ZERO_HASH); return; }
    for (int i = 0; i < b->ntx; i++) sha256_hex(b->tx[i], lv[i]);
    int cnt = b->ntx;
    while (cnt > 1) {
        if (cnt % 2) { strcpy(lv[cnt], lv[cnt - 1]); cnt++; }
        for (int i = 0; i < cnt / 2; i++) {
            memcpy(buf, lv[2 * i], 64);
            memcpy(buf + 64, lv[2 * i + 1], 64);
            buf[128] = '\0';
            sha256_hex(buf, lv[i]);
        }
        cnt /= 2;
    }
    strcpy(out, lv[0]);
}

void calc_block_hash(const Block *b, char out[65]) {
    char buf[512];
    snprintf(buf, sizeof buf, "%d|%s|%s|%lu|%s",
             b->index, b->merkle, b->prev, (unsigned long)b->nonce, b->validator);
    sha256_hex(buf, out);
}

uint64_t block_work(const Block *b) {
    if (b->difficulty <= 0) return 1;
    if (b->difficulty >= 63) return 1ULL << 62;
    return 1ULL << b->difficulty;
}

int mine_block(Block *b, int difficulty, RNG *rng) {
    b->nonce = rng_u64(rng);
    for (;;) {
        calc_block_hash(b, b->hash);
        if (hash_has_zeros(b->hash, difficulty)) return 1;
        b->nonce++;
    }
}

/* ------------------------------------------------------------------ */
/* Creation et validation                                              */
/* ------------------------------------------------------------------ */
int bc_create(Sim *s, int miner, int pool, int parent, const char *tx,
              int selfish, int private_block) {
    if (parent < 0 || parent >= s->store.nblocks) return -1;
    if (s->store.nblocks >= MAX_BLOCKS) return -1;

    Block b;
    memset(&b, 0, sizeof b);
    b.index = s->store.blocks[parent].index + 1;
    b.ntx = 0;
    if (tx && *tx) snprintf(b.tx[b.ntx++], 64, "%s", tx);
    /* une transaction de recompense pour rendre le bloc non vide */
    snprintf(b.tx[b.ntx++], 64, "coinbase:%d", miner);
    merkle_root_block(&b, b.merkle);
    snprintf(b.prev, sizeof b.prev, "%s", s->store.blocks[parent].hash);
    b.miner = miner;
    b.pool = pool;
    b.parent = parent;
    b.t_found = s->now;
    b.private_block = private_block;
    b.selfish = selfish;
    b.canonical = 0;

    if (s->cfg.consensus == CONS_POW) {
        b.difficulty = s->cfg.difficulty;
        b.work = s->store.blocks[parent].work + block_work(&b);
        if (!mine_block(&b, b.difficulty, &s->rng)) return -1;
    } else {
        b.difficulty = 0;
        b.work = s->store.blocks[parent].work + 1;
        snprintf(b.validator, sizeof b.validator, "n%d", miner);
        b.nonce = 0;
        calc_block_hash(&b, b.hash);
    }

    int id = store_add(&s->store, &b);
    if (id < 0) return -1;

    if (s->cfg.log_events) {
        char detail[128];
        snprintf(detail, sizeof detail, "height=%d miner=%d private=%d selfish=%d",
                 b.index, miner, private_block, selfish);
        log_event(s, "block_found", miner, -1, id, detail);
    }
    return id;
}

int bc_validate(BlockStore *s, const Block *b) {
    char tmp[65];
    merkle_root_block(b, tmp);
    if (strcmp(tmp, b->merkle)) return 0;
    calc_block_hash(b, tmp);
    if (strcmp(tmp, b->hash)) return 0;

    if (b->difficulty > 0) {
        if (!hash_has_zeros(b->hash, b->difficulty)) return 0;
    } else {
        if (b->validator[0] == '\0') return 0;
    }

    if (b->parent < 0) {
        return !strcmp(b->prev, ZERO_HASH) && b->index == 0;
    }
    if (b->parent >= s->nblocks) return 0;
    const Block *p = &s->blocks[b->parent];
    if (strcmp(b->prev, p->hash)) return 0;
    if (b->index != p->index + 1) return 0;
    return 1;
}

/* ------------------------------------------------------------------ */
/* Vues par noeud                                                      */
/* ------------------------------------------------------------------ */
void view_init(View *v, int genesis) {
    memset(v, 0, sizeof *v);
    v->chain[0] = genesis;
    v->len = 1;
    v->tip = genesis;
    v->work = 0;
    view_mark(v, genesis);
}

int view_has(View *v, int id) {
    if (id < 0 || id >= MAX_BLOCKS) return 0;
    return (v->known[id >> 6] >> (id & 63)) & 1ULL;
}

void view_mark(View *v, int id) {
    if (id < 0 || id >= MAX_BLOCKS) return;
    v->known[id >> 6] |= 1ULL << (id & 63);
}

void view_build(BlockStore *s, View *v, int tip) {
    int tmp[MAX_CHAIN];
    int n = 0;
    int cur = tip;
    while (cur >= 0 && n < MAX_CHAIN) {
        tmp[n++] = cur;
        if (s->blocks[cur].parent < 0) break;
        cur = s->blocks[cur].parent;
    }
    /* remet dans l'ordre genesis -> tip */
    for (int i = 0; i < n; i++) v->chain[i] = tmp[n - 1 - i];
    v->len = n;
    v->tip = tip;
    v->work = s->blocks[tip].work;
}

int view_canonical(BlockStore *s, View *v, int id) {
    if (id < 0 || id >= MAX_BLOCKS) return 0;
    int h = s->blocks[id].index;
    if (h < 0 || h >= v->len) return 0;
    return v->chain[h] == id;
}
