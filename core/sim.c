/* sim.c - Simulateur evenementiel, reseau P2P, consensus et orchestration */
#include "sim.h"
#include "rng.h"
#include <time.h>
#include <limits.h>

#define MIN(a,b) ((a) < (b) ? (a) : (b))
#define MAX(a,b) ((a) > (b) ? (a) : (b))

/* ------------------------------------------------------------------ */
/* File de priorite (tas binaire)                                      */
/* ------------------------------------------------------------------ */
static int ev_less(const Event *a, const Event *b) {
    if (a->t != b->t) return a->t < b->t;
    return a->seq < b->seq;
}

void schedule(Sim *s, simtime_t t, int type, int src, int dst, int block, int data) {
    if (s->q.n >= MAX_EVENTS) return;
    Event e;
    e.t = t; e.seq = s->q.seq++; e.type = type;
    e.src = src; e.dst = dst; e.block = block; e.data = data;
    int i = s->q.n++;
    s->q.heap[i] = e;
    while (i > 0) {
        int p = (i - 1) / 2;
        if (!ev_less(&s->q.heap[i], &s->q.heap[p])) break;
        Event tmp = s->q.heap[i]; s->q.heap[i] = s->q.heap[p]; s->q.heap[p] = tmp;
        i = p;
    }
}

Event pop_event(Sim *s) {
    Event e = s->q.heap[0];
    s->q.n--;
    if (s->q.n > 0) {
        s->q.heap[0] = s->q.heap[s->q.n];
        int i = 0;
        for (;;) {
            int l = 2 * i + 1, r = 2 * i + 2, m = i;
            if (l < s->q.n && ev_less(&s->q.heap[l], &s->q.heap[m])) m = l;
            if (r < s->q.n && ev_less(&s->q.heap[r], &s->q.heap[m])) m = r;
            if (m == i) break;
            Event tmp = s->q.heap[i]; s->q.heap[i] = s->q.heap[m]; s->q.heap[m] = tmp;
            i = m;
        }
    }
    return e;
}

simtime_t event_time(Sim *s) {
    return s->q.n > 0 ? s->q.heap[0].t : (simtime_t)INT64_MAX / 4;
}

/* ------------------------------------------------------------------ */
/* Journalisation                                                      */
/* ------------------------------------------------------------------ */
void log_event(Sim *s, const char *type, int src, int dst, int block, const char *detail) {
    if (!s->fevents) return;
    fprintf(s->fevents,
            "{\"t\":%lld,\"type\":\"%s\",\"src\":%d,\"dst\":%d,\"block\":%d,\"detail\":\"%s\"}\n",
            (long long)s->now, type, src, dst, block, detail ? detail : "");
}

static const char *role_name(NodeRole r) {
    switch (r) {
        case ROLE_ATTACKER: return "attacker";
        case ROLE_SYBIL: return "sybil";
        case ROLE_SABOTEUR: return "saboteur";
        default: return "honest";
    }
}

/* ------------------------------------------------------------------ */
/* Reseau                                                              */
/* ------------------------------------------------------------------ */
static int is_victim(Sim *s, int node) {
    for (int i = 0; i < s->atk.nvictims; i++)
        if (s->atk.victims[i] == node) return 1;
    return 0;
}

static int subnet_peer_count(Sim *s, int a, int subnet) {
    int c = 0;
    for (int i = 0; i < s->nodes[a].npeers; i++)
        if (s->nodes[s->nodes[a].peers[i]].subnet == subnet) c++;
    return c;
}

static void add_peer(Sim *s, int a, int b) {
    if (a == b || a < 0 || b < 0 || a >= s->nnodes || b >= s->nnodes) return;
    Node *na = &s->nodes[a];
    for (int i = 0; i < na->npeers; i++) if (na->peers[i] == b) return;
    if (na->npeers >= MAX_PEERS) return;
    if (s->def.enabled && s->def.peer_diversity) {
        if (subnet_peer_count(s, a, s->nodes[b].subnet) >= 2) return;
    }
    na->peers[na->npeers++] = b;
}

static int has_peer(Sim *s, int node, int peer) {
    for (int i = 0; i < s->nodes[node].npeers; i++)
        if (s->nodes[node].peers[i] == peer) return 1;
    return 0;
}

void broadcast_block(Sim *s, int from, int bid, simtime_t extra_delay) {
    if (from < 0 || from >= s->nnodes) return;
    Node *f = &s->nodes[from];
    for (int i = 0; i < f->npeers; i++) {
        int dst = f->peers[i];
        if (dst < 0 || dst >= s->nnodes || dst == from) continue;
        if (!has_peer(s, dst, from)) continue;   /* lien bidirectionnel */
        if (s->cfg.loss > 0 && rng_double(&s->rng) < s->cfg.loss) continue;

        /* eclipse : un noeud sybil ne relaie pas vers la victime */
        if (s->atk.active && s->atk.type == ATK_SYBIL &&
            f->role == ROLE_SYBIL && is_victim(s, dst)) {
            s->sybil_msgs++;
            continue;
        }

        simtime_t delay = s->cfg.latency;
        if (s->cfg.jitter > 0)
            delay += (simtime_t)(rng_double(&s->rng) * (double)s->cfg.jitter);
        delay += extra_delay;
        if (delay < 0) delay = 0;
        schedule(s, s->now + delay, EV_BLOCK, from, dst, bid, 0);
        f->msgs_sent++;
    }
}

/* ------------------------------------------------------------------ */
/* Initialisation                                                      */
/* ------------------------------------------------------------------ */
static void setup_roles(Sim *s) {
    Config *c = &s->cfg;
    int base = s->base_nodes;
    int total = s->nnodes;

    for (int i = 0; i < total; i++) {
        Node *n = &s->nodes[i];
        n->id = i;
        n->role = ROLE_HONEST;
        n->hash_share = 0.0;
        n->stake = 0.0;
        n->subnet = i % 8;
        n->npeers = 0;
        n->pool = -1;
        n->mining = 0;
        n->banned = 0;
        n->alerted = 0;
        n->risk = 0.0;
    }

    if (c->attack_type == ATK_51 || c->attack_type == ATK_SELFISH) {
        if (base < 3) base = 3;
        int a = base - 1;
        s->nodes[a].role = ROLE_ATTACKER;
        s->nodes[a].hash_share = c->attacker_share;
        s->nodes[a].stake = c->attacker_share;
        s->nodes[a].mining = 1;
        s->nodes[a].pool = 0;
        double rest = base > 1 ? (1.0 - c->attacker_share) / (base - 1) : 0.0;
        for (int i = 0; i < base; i++) {
            if (i == a) continue;
            s->nodes[i].hash_share = rest;
            s->nodes[i].stake = rest;
            s->nodes[i].mining = 1;
            s->nodes[i].pool = 0;
        }
    } else if (c->attack_type == ATK_WITHHOLD) {
        int pm = (int)(base * 0.4);
        if (pm < 2) pm = 2;
        if (pm > base - 1) pm = base - 1;
        if (pm < 1) pm = 1;
        double sab = c->pool_share * c->saboteur_share;
        double other = pm > 1 ? (c->pool_share - sab) / (pm - 1) : 0.0;
        if (other < 0) other = 0;
        int saboteur = pm; /* dernier membre du pool (indice pm) */
        for (int i = 1; i <= pm; i++) {
            s->nodes[i].pool = 0;
            s->nodes[i].mining = 1;
            s->nodes[i].hash_share = (i == saboteur) ? sab : other;
            s->nodes[i].stake = s->nodes[i].hash_share;
            if (i == saboteur) s->nodes[i].role = ROLE_SABOTEUR;
        }
        int non = base - pm; /* noeud 0 + autres */
        double rest = non > 0 ? (1.0 - c->pool_share) / non : 0.0;
        for (int i = 0; i < base; i++) {
            if (i >= 1 && i <= pm) continue;
            s->nodes[i].hash_share = rest;
            s->nodes[i].stake = rest;
            s->nodes[i].mining = 1;
            s->nodes[i].pool = -1;
        }
        s->pools[0].id = 0;
        s->pools[0].share = c->pool_share;
        s->pools[0].nmembers = 0;
        for (int i = 1; i <= pm; i++) s->pools[0].members[s->pools[0].nmembers++] = i;
        s->npools = 1;
    } else if (c->attack_type == ATK_SYBIL) {
        double rest = base > 0 ? 1.0 / base : 0.0;
        for (int i = 0; i < base; i++) {
            s->nodes[i].hash_share = rest;
            s->nodes[i].stake = rest;
            s->nodes[i].mining = 1;
            s->nodes[i].pool = 0;
        }
        for (int i = base; i < total; i++) {
            s->nodes[i].role = ROLE_SYBIL;
            s->nodes[i].subnet = 100;
            s->nodes[i].hash_share = 0;
            s->nodes[i].mining = 0;
            s->nodes[i].pool = -1;
        }
        s->pools[0].id = 0;
        s->pools[0].share = 1.0;
        s->pools[0].nmembers = 0;
        for (int i = 0; i < base; i++) s->pools[0].members[s->pools[0].nmembers++] = i;
        s->npools = 1;
    } else {
        double rest = base > 0 ? 1.0 / base : 0.0;
        for (int i = 0; i < base; i++) {
            s->nodes[i].hash_share = rest;
            s->nodes[i].stake = rest;
            s->nodes[i].mining = 1;
            s->nodes[i].pool = 0;
        }
        s->pools[0].id = 0;
        s->pools[0].share = 1.0;
        s->pools[0].nmembers = 0;
        for (int i = 0; i < base; i++) s->pools[0].members[s->pools[0].nmembers++] = i;
        s->npools = 1;
    }

    /* normalisation de securite */
    double sum = 0.0;
    for (int i = 0; i < total; i++) sum += s->nodes[i].hash_share;
    if (sum > 1e-9) {
        for (int i = 0; i < total; i++) {
            s->nodes[i].hash_share /= sum;
            if (s->cfg.consensus == CONS_POS) s->nodes[i].stake = s->nodes[i].hash_share;
        }
    }
}

static void setup_network(Sim *s) {
    int base = s->base_nodes;
    int deg = s->cfg.gossip_degree;
    if (deg < 1) deg = 1;
    if (deg > MAX_PEERS) deg = MAX_PEERS;

    /* anneau + liens aleatoires entre noeuds honnetes */
    for (int i = 0; i < base; i++) {
        int j = (i + 1) % base;
        add_peer(s, i, j);
        add_peer(s, j, i);
    }
    for (int i = 0; i < base; i++) {
        int attempts = 0;
        while (s->nodes[i].npeers < deg && attempts < 200) {
            int j = rng_int(&s->rng, base);
            add_peer(s, i, j);
            add_peer(s, j, i);
            attempts++;
        }
    }

    if (s->cfg.attack_type == ATK_SYBIL) {
        int nbase = base;
        int nsy = s->nnodes - base;
        if (nsy <= 0) return;
        /* les sybils se connectent entre eux et a quelques honnetes */
        for (int i = 0; i < nsy; i++) {
            int si = base + i;
            add_peer(s, si, base + (i + 1) % nsy);
            add_peer(s, base + (i + 1) % nsy, si);
            for (int k = 0; k < 2; k++) {
                int h = rng_int(&s->rng, nbase);
                if (is_victim(s, h)) continue;
                add_peer(s, si, h);
                add_peer(s, h, si);
            }
        }
        for (int v = 0; v < s->atk.nvictims; v++) {
            int vi = s->atk.victims[v];
            if (!s->def.peer_diversity) {
                s->nodes[vi].npeers = 0;
            }
            int added = 0;
            for (int i = 0; i < nsy; i++) {
                int si = base + i;
                if (s->nodes[vi].npeers >= deg) break;
                if (s->def.peer_diversity && added >= 2) break;
                add_peer(s, vi, si);
                add_peer(s, si, vi);
                added++;
            }
        }
    }
}

static void open_outputs(Sim *s) {
    char path[512];
    snprintf(path, sizeof path, "%s/events.jsonl", s->cfg.outdir);
    s->fevents = fopen(path, "w");
    snprintf(path, sizeof path, "%s/blocks.csv", s->cfg.outdir);
    s->fblocks = fopen(path, "w");
    snprintf(path, sizeof path, "%s/nodes.csv", s->cfg.outdir);
    s->fnodes = fopen(path, "w");
    snprintf(path, sizeof path, "%s/windows.csv", s->cfg.outdir);
    s->fwindows = fopen(path, "w");
    snprintf(path, sizeof path, "%s/alerts.csv", s->cfg.outdir);
    s->falerts = fopen(path, "w");

    if (s->fblocks)
        fprintf(s->fblocks, "id,height,hash,prev,miner,pool,validator,difficulty,nonce,t_found,parent,work,private,selfish,canonical,ntx,tx0\n");
    if (s->fnodes)
        fprintf(s->fnodes, "id,role,hash_share,stake,subnet,npeers,blocks_found,blocks_canonical,blocks_orphan,blocks_received,invalid,withheld,shares,payout,banned,label_malicious\n");
    if (s->fwindows) {
        fprintf(s->fwindows, "window,t_start,t_end,label");
        for (int i = 0; i < NF; i++) fprintf(s->fwindows, ",%s", FEATURE_NAMES[i]);
        fprintf(s->fwindows, ",predicted,score,detected\n");
    }
    if (s->falerts) fprintf(s->falerts, "window,t,score,label,suspect,type\n");
}

void sim_init(Sim *s, const Config *c) {
    memset(s, 0, sizeof *s);
    s->cfg = *c;
    s->def = c->defense;
    rng_seed(&s->rng, c->seed);
    store_init(&s->store);
    s->now = 0;
    s->q.n = 0;
    s->q.seq = 0;
    s->det.first_alert = -1;
    s->detection_time = -1;
    s->detection_window = -1;
    s->attack_start = -1;

    /* genesis */
    Block g;
    memset(&g, 0, sizeof g);
    g.index = 0;
    g.ntx = 1;
    snprintf(g.tx[0], 64, "Genesis");
    merkle_root_block(&g, g.merkle);
    snprintf(g.prev, sizeof g.prev, "%s", ZERO_HASH);
    snprintf(g.validator, sizeof g.validator, "genesis");
    g.miner = -1;
    g.pool = -1;
    g.parent = -1;
    g.difficulty = 0;
    g.work = 0;
    g.t_found = 0;
    g.canonical = 1;
    calc_block_hash(&g, g.hash);
    int genesis = store_add(&s->store, &g);

    s->base_nodes = c->nnodes < 4 ? 4 : c->nnodes;
    int total = s->base_nodes;
    if (c->attack_type == ATK_SYBIL) total += c->sybil_count;
    if (total > MAX_NODES) total = MAX_NODES;
    s->nnodes = total;
    if (s->base_nodes > total) s->base_nodes = total;
    if (s->cfg.observer >= s->base_nodes) s->cfg.observer = 0;

    s->npools = 0;
    memset(s->pools, 0, sizeof s->pools);
    setup_roles(s);
    for (int i = 0; i < s->nnodes; i++) view_init(&s->nodes[i].view, genesis);
    attack_init(s);
    setup_network(s);
    detector_init(s);

    open_outputs(s);

    /* planification du minage */
    simtime_t mean_base = s->cfg.block_interval;
    for (int i = 0; i < s->nnodes; i++) {
        Node *n = &s->nodes[i];
        if (!n->mining || n->hash_share <= 0) continue;
        double mean = (double)mean_base / n->hash_share;
        simtime_t t = s->now + (simtime_t)rng_exp(&s->rng, mean);
        schedule(s, t, EV_MINE, i, -1, -1, 0);
    }

    if (s->cfg.window_ms <= 0) s->cfg.window_ms = s->cfg.block_interval * 20;
    schedule(s, s->cfg.window_ms, EV_WINDOW, -1, -1, -1, 0);

    schedule(s, s->cfg.attack_start_ms, EV_ATTACK, -1, -1, -1, 0);
    schedule(s, s->cfg.duration_ms, EV_STOP, -1, -1, -1, 0);

    s->window_start_time = 0;
    config_print(&s->cfg);
}

/* ------------------------------------------------------------------ */
/* Minage                                                              */
/* ------------------------------------------------------------------ */
static void schedule_next_mine(Sim *s, int id) {
    Node *n = &s->nodes[id];
    if (!n->mining || n->hash_share <= 0 || n->banned) return;
    double mean = (double)s->cfg.block_interval / n->hash_share;
    simtime_t t = s->now + (simtime_t)rng_exp(&s->rng, mean);
    schedule(s, t, EV_MINE, id, -1, -1, 0);
}

static void handle_mine(Sim *s, Event *e) {
    int id = e->src;
    if (id < 0 || id >= s->nnodes) return;
    Node *n = &s->nodes[id];
    if (n->banned) return;
    schedule_next_mine(s, id);

    int private_mode = s->atk.active &&
        (s->atk.type == ATK_51 || s->atk.type == ATK_SELFISH) &&
        attack_is_suspect(s, id) && s->atk.private_mode;
    int withholding = s->atk.active && s->atk.type == ATK_WITHHOLD &&
                      id == s->atk.saboteur;

    if (private_mode) {
        int parent = s->atk.private_len > 0 && s->atk.private_tip >= 0
                     ? s->atk.private_tip : n->view.tip;
        const char *tx = s->atk.type == ATK_51 ? "ATTACKER->SELF:1000" : "selfish";
        int bid = bc_create(s, id, n->pool, parent, tx, 1, 1);
        if (bid < 0) return;
        n->blocks_found++;
        s->blocks_mined++;
        s->blocks_attacker++;
        if (n->pool >= 0) { n->shares++; s->pools[n->pool].shares++; }
        attack_on_block(s, id, bid, 1);
        return;
    }

    if (withholding) {
        int bid = bc_create(s, id, n->pool, n->view.tip, "withhold", 0, 0);
        if (bid < 0) return;
        n->blocks_found++;
        s->blocks_mined++;
        s->blocks_attacker++;
        if (n->pool >= 0) { n->shares++; s->pools[n->pool].shares++; }
        attack_on_block(s, id, bid, 0);
        return;
    }

    char tx[64];
    tx[0] = '\0';
    if (s->atk.active && s->atk.type == ATK_51 && !s->atk.payment_included &&
        !attack_is_suspect(s, id) &&
        s->store.blocks[n->view.tip].index >= s->atk.start_height) {
        snprintf(tx, sizeof tx, "VICTIM->MERCHANT:%.0f", s->cfg.victim_value);
    }

    int bid = bc_create(s, id, n->pool, n->view.tip, tx, 0, 0);
    if (bid < 0) return;
    view_mark(&n->view, bid);
    view_build(&s->store, &n->view, bid);
    n->blocks_found++;
    s->blocks_mined++;
    if (n->role == ROLE_ATTACKER || n->role == ROLE_SABOTEUR)
        s->blocks_attacker++;
    else
        s->blocks_honest++;
    if (n->pool >= 0) { n->shares++; s->pools[n->pool].shares++; }

    attack_on_block(s, id, bid, 0);
    broadcast_block(s, id, bid, 0);
}

/* ------------------------------------------------------------------ */
/* Reception d'un bloc et choix de fork                                */
/* ------------------------------------------------------------------ */
static int build_candidate(Sim *s, int tip, int *out) {
    int tmp[MAX_CHAIN];
    int n = 0, cur = tip;
    while (cur >= 0 && n < MAX_CHAIN) {
        tmp[n++] = cur;
        if (s->store.blocks[cur].parent < 0) break;
        cur = s->store.blocks[cur].parent;
    }
    for (int i = 0; i < n; i++) out[i] = tmp[n - 1 - i];
    return n;
}

static void handle_block(Sim *s, Event *e) {
    int dst = e->dst, bid = e->block;
    if (dst < 0 || dst >= s->nnodes) return;
    Node *n = &s->nodes[dst];
    if (n->banned) return;
    if (bid < 0 || bid >= s->store.nblocks) return;
    Block *b = &s->store.blocks[bid];

    n->msgs_recv++;
    s->window_received++;

    if (view_has(&n->view, bid)) { s->window_duplicate++; return; }
    view_mark(&n->view, bid);
    n->blocks_received++;

    if (bid == 0) return;
    if (b->parent < 0 || !view_has(&n->view, b->parent)) {
        n->blocks_orphan++;
        return;
    }
    if (!bc_validate(&s->store, b)) {
        n->invalid_blocks++;
        s->window_invalid++;
        return;
    }

    /* contre-mesure : rejet des blocs trop anciens (fraicheur) */
    if (s->def.enabled && s->def.freshness_ms > 0 &&
        s->now - b->t_found > s->def.freshness_ms) {
        n->invalid_blocks++;
        s->window_invalid++;
        return;
    }

    if (dst == s->cfg.observer) {
        simtime_t d = s->now - b->t_found;
        if (d >= 0) {
            if (s->ndelays < MAX_DELAYS) s->delays[s->ndelays++] = d;
            n->relay_delay_sum += d;
            n->relay_delay_n++;
        }
    }

    int cand[MAX_CHAIN];
    int cn = build_candidate(s, bid, cand);
    int common = 0;
    while (common < cn && common < n->view.len &&
           !strcmp(s->store.blocks[cand[common]].hash,
                   s->store.blocks[n->view.chain[common]].hash)) common++;
    int depth = n->view.len - common;
    int cur_h = s->store.blocks[n->view.tip].index;
    int better = 0, equal = 0;

    if (s->cfg.consensus == CONS_POW) {
        if (b->work > n->view.work) better = 1;
        else if (b->work == n->view.work) equal = 1;
    } else {
        if (b->index > cur_h) better = 1;
        else if (b->index == cur_h) equal = 1;
    }

    if (equal) {
        int sw = 0;
        if (s->def.enabled && s->def.tie_random) {
            sw = rng_double(&s->rng) < 0.5;
        } else if (s->atk.active && s->atk.type == ATK_SELFISH) {
            int cs = b->selfish, ts = s->store.blocks[n->view.tip].selfish;
            if (cs && !ts) sw = rng_double(&s->rng) < s->cfg.gamma;
            else if (!cs && ts) sw = rng_double(&s->rng) > s->cfg.gamma;
            else sw = strcmp(b->hash, s->store.blocks[n->view.tip].hash) < 0;
        } else {
            sw = strcmp(b->hash, s->store.blocks[n->view.tip].hash) < 0;
        }
        if (sw) better = 1;
    }

    if (better) {
        int reject = 0;
        if (depth > 0 && s->def.enabled && depth > s->def.max_reorg_depth)
            reject = 1;
        if (!reject && s->def.enabled && s->def.checkpoint_height >= 0 &&
            cn > s->def.checkpoint_height) {
            int cp = s->def.checkpoint_height;
            if (strcmp(s->store.blocks[cand[cp]].hash, s->def.checkpoint_hash))
                reject = 1;
        }
        if (!reject) {
            if (depth > 0) {
                s->reorg_count++;
                s->window_reorgs++;
                if (depth > s->max_reorg_depth) s->max_reorg_depth = depth;
                if (depth > s->window_max_reorg) s->window_max_reorg = depth;
                s->reorg_depth_sum += depth;
                attack_on_reorg(s, depth);
                log_event(s, "reorg", dst, -1, bid, "fork");
            }
            view_build(&s->store, &n->view, bid);
        }
    }

    broadcast_block(s, dst, bid, 0);
    attack_on_receive(s, dst, bid);
}

/* ------------------------------------------------------------------ */
/* Boucle principale                                                   */
/* ------------------------------------------------------------------ */
void sim_run(Sim *s) {
    while (s->q.n > 0) {
        Event e = pop_event(s);
        if (e.t > s->cfg.duration_ms) break;
        s->now = e.t;
        switch (e.type) {
            case EV_MINE: handle_mine(s, &e); break;
            case EV_BLOCK: handle_block(s, &e); break;
            case EV_WINDOW:
                metrics_window(s);
                schedule(s, s->now + s->cfg.window_ms, EV_WINDOW, -1, -1, -1, 0);
                break;
            case EV_ATTACK:
                attack_tick(s);
                schedule(s, s->now + MAX(1, s->cfg.window_ms / 2), EV_ATTACK, -1, -1, -1, 0);
                break;
            case EV_STOP:
                goto done;
            default:
                break;
        }
    }
done:
    /* derniere fenetre partielle */
    if (s->now > s->window_start_time && s->nwindows < MAX_WINDOWS)
        metrics_window(s);

    metrics_finalize(s);
    sim_write_summary(s);
}

void sim_free(Sim *s) {
    if (s->fevents) fclose(s->fevents);
    if (s->fblocks) fclose(s->fblocks);
    if (s->fnodes) fclose(s->fnodes);
    if (s->fwindows) fclose(s->fwindows);
    if (s->falerts) fclose(s->falerts);
    s->fevents = s->fblocks = s->fnodes = s->fwindows = s->falerts = NULL;
}

/* ------------------------------------------------------------------ */
/* Resume et sorties                                                   */
/* ------------------------------------------------------------------ */
void sim_write_summary(Sim *s) {
    View *ref = &s->nodes[s->cfg.observer].view;
    int ref_h = s->store.blocks[ref->tip].index;
    int canonical = s->blocks_canonical;

    /* paiement / 51% */
    int payment_canon = 0;
    if (s->atk.payment_block >= 0 && s->atk.payment_block < s->store.nblocks)
        payment_canon = view_canonical(&s->store, ref, s->atk.payment_block);

    double attacker_reward = 0.0;
    long honest_orphans = 0;
    for (int i = 0; i < s->nnodes; i++) {
        if (attack_is_suspect(s, i))
            attacker_reward += (double)s->nodes[i].blocks_canonical * s->cfg.block_reward;
        else
            honest_orphans += s->nodes[i].blocks_orphan;
    }

    /* payouts de pool */
    double pool_rewards = 0.0, pool_loss = 0.0, sab_payout = 0.0, sab_fair = 0.0;
    double pool_expected = 0.0, pool_actual = 0.0;
    double withheld_ratio = 0.0, withheld_loss = (double)s->atk.withheld * s->cfg.block_reward;
    if (s->npools > 0) {
        Pool *p = &s->pools[0];
        pool_actual = (double)p->blocks_canonical;
        pool_expected = p->share * (double)canonical;
        pool_rewards = pool_actual * s->cfg.block_reward * (1.0 - s->cfg.pool_fee);
        if (p->shares > 0) {
            for (int i = 0; i < p->nmembers; i++) {
                int id = p->members[i];
                s->nodes[id].payout = pool_rewards *
                    (double)s->nodes[id].shares / (double)p->shares;
            }
        }
        if (pool_expected > pool_actual)
            pool_loss = (pool_expected - pool_actual) * s->cfg.block_reward;
        if (s->atk.saboteur >= 0 && p->share > 1e-9) {
            sab_payout = s->nodes[s->atk.saboteur].payout;
            sab_fair = pool_rewards *
                (s->nodes[s->atk.saboteur].hash_share / p->share);
        }
    }

    /* penalite de revenu appliquee apres detection d'un selfish mining */
    double selfish_factor = (s->atk.type == ATK_SELFISH && s->atk.selfish_penalty) ? 0.5 : 1.0;
    if (s->atk.type == ATK_SELFISH) attacker_reward *= selfish_factor;
    double honest_orphan_rate = s->blocks_mined > 0 ?
        (double)honest_orphans / (double)s->blocks_mined : 0.0;

    /* issue selon l'attaque */
    int success = 0;
    if (s->atk.type == ATK_51) {
        success = s->atk.payment_included && s->atk.payment_accepted &&
                  !payment_canon && !s->atk.defense_prevented;
    } else if (s->atk.type == ATK_SELFISH) {
        double ratio = canonical > 0 ?
            (double)s->atk.selfish_canonical / (double)canonical : 0.0;
        ratio *= selfish_factor;
        success = ratio > s->cfg.attacker_share + 0.02;
    } else if (s->atk.type == ATK_WITHHOLD) {
        withheld_ratio = (pool_actual + (double)s->atk.withheld > 0) ?
            (double)s->atk.withheld / (pool_actual + (double)s->atk.withheld) : 0.0;
        success = withheld_ratio >= 0.10;
    } else if (s->atk.type == ATK_SYBIL) {
        for (int i = 0; i < s->atk.nvictims; i++) {
            int v = s->atk.victims[i];
            int vh = s->store.blocks[s->nodes[v].view.tip].index;
            if (ref_h - vh >= 3 ||
                (ref_h > vh && strcmp(s->store.blocks[s->nodes[v].view.tip].hash,
                                      s->store.blocks[ref->tip].hash))) {
                success = 1;
                break;
            }
        }
    }

    double selfish_ratio = canonical > 0 ?
        (double)s->atk.selfish_canonical / (double)canonical : 0.0;
    selfish_ratio *= selfish_factor;
    double victim_lag = 0;
    for (int i = 0; i < s->atk.nvictims; i++) {
        int v = s->atk.victims[i];
        int vh = s->store.blocks[s->nodes[v].view.tip].index;
        if (ref_h - vh > victim_lag) victim_lag = ref_h - vh;
    }

    double victim_loss = 0.0, attacker_profit = attacker_reward;
    if (s->atk.type == ATK_51) {
        if (success) {
            victim_loss = s->cfg.victim_value;
            attacker_profit += s->cfg.victim_value;
        }
    } else if (s->atk.type == ATK_SELFISH) {
        victim_loss = (double)honest_orphans * s->cfg.block_reward;
        attacker_profit = attacker_reward - s->cfg.attacker_share *
                          (double)canonical * s->cfg.block_reward;
    } else if (s->atk.type == ATK_WITHHOLD) {
        victim_loss = withheld_loss;
        attacker_profit = sab_payout - sab_fair + 0.5 * withheld_loss;
    } else if (s->atk.type == ATK_SYBIL) {
        long vorph = 0;
        for (int i = 0; i < s->atk.nvictims; i++)
            vorph += s->nodes[s->atk.victims[i]].blocks_orphan;
        victim_loss = (double)vorph * s->cfg.block_reward;
        attacker_profit = 0.1 * victim_loss;
    }

    long false_alerts = 0;
    for (int i = 0; i < s->nwindows; i++)
        if (s->windows[i].predicted && !s->windows[i].label) false_alerts++;

    long extra_conf = 0;
    if (s->def.enabled) {
        extra_conf = s->def.confirmation_depth - s->cfg.confirm_depth;
        if (extra_conf < 0) extra_conf = 0;
    }
    double defense_delay = (double)extra_conf * (double)s->cfg.block_interval;
    long detect_ms = -1;
    if (s->detection_time >= 0 && s->attack_start >= 0) {
        detect_ms = (long)(s->detection_time - s->attack_start);
        if (detect_ms < 0) detect_ms = -1;
    }

    double orphan_rate = s->blocks_mined > 0 ?
        (double)(s->blocks_mined - canonical) / (double)s->blocks_mined : 0.0;

    if (s->fblocks) {
        for (int i = 0; i < s->store.nblocks; i++) {
            Block *b = &s->store.blocks[i];
            fprintf(s->fblocks, "%d,%d,%s,%s,%d,%d,%s,%d,%lu,%lld,%d,%llu,%d,%d,%d,%d,%s\n",
                    i, b->index, b->hash, b->prev, b->miner, b->pool, b->validator,
                    b->difficulty, (unsigned long)b->nonce, (long long)b->t_found,
                    b->parent, (unsigned long long)b->work, b->private_block,
                    b->selfish, b->canonical, b->ntx, b->ntx > 0 ? b->tx[0] : "");
        }
    }
    if (s->fnodes) {
        for (int i = 0; i < s->nnodes; i++) {
            Node *n = &s->nodes[i];
            fprintf(s->fnodes, "%d,%s,%.6f,%.6f,%d,%d,%ld,%ld,%ld,%ld,%ld,%ld,%ld,%.4f,%d,%d\n",
                    i, role_name(n->role), n->hash_share, n->stake, n->subnet,
                    n->npeers, n->blocks_found, n->blocks_canonical,
                    n->blocks_orphan, n->blocks_received, n->invalid_blocks,
                    n->withheld, n->shares, n->payout, n->banned,
                    n->role != ROLE_HONEST);
        }
    }

    char path[512];
    snprintf(path, sizeof path, "%s/summary.json", s->cfg.outdir);
    FILE *f = fopen(path, "w");
    if (f) {
        const char *atk_names[] = { "none", "51", "selfish", "withholding", "sybil" };
        fprintf(f, "{\n");
        fprintf(f, "  \"name\": \"%s\",\n", s->cfg.name);
        fprintf(f, "  \"seed\": %llu,\n", (unsigned long long)s->cfg.seed);
        fprintf(f, "  \"consensus\": \"%s\",\n", s->cfg.consensus == CONS_POW ? "pow" : "pos");
        fprintf(f, "  \"attack\": \"%s\",\n", atk_names[s->atk.type]);
        fprintf(f, "  \"defense\": %d,\n", s->def.enabled);
        fprintf(f, "  \"detector\": \"%s\",\n", detector_name(s->cfg.detector_mode));
        fprintf(f, "  \"nodes\": %d,\n", s->nnodes);
        fprintf(f, "  \"base_nodes\": %d,\n", s->base_nodes);
        fprintf(f, "  \"attack_share\": %.4f,\n", s->cfg.attacker_share);
        fprintf(f, "  \"attack_start_ms\": %lld,\n", (long long)s->cfg.attack_start_ms);
        fprintf(f, "  \"block_interval_ms\": %lld,\n", (long long)s->cfg.block_interval);
        fprintf(f, "  \"attack_success\": %d,\n", success);
        fprintf(f, "  \"reorg_depth\": %d,\n", s->atk.reorg_depth);
        fprintf(f, "  \"max_reorg_depth\": %d,\n", s->max_reorg_depth);
        fprintf(f, "  \"reorg_count\": %ld,\n", s->reorg_count);
        fprintf(f, "  \"orphan_rate\": %.6f,\n", orphan_rate);
        fprintf(f, "  \"honest_orphans\": %ld,\n", honest_orphans);
        fprintf(f, "  \"honest_orphan_rate\": %.6f,\n", honest_orphan_rate);
        fprintf(f, "  \"canonical_blocks\": %d,\n", canonical);
        fprintf(f, "  \"blocks_mined\": %ld,\n", s->blocks_mined);
        fprintf(f, "  \"attacker_reward\": %.4f,\n", attacker_reward);
        fprintf(f, "  \"attacker_profit\": %.4f,\n", attacker_profit);
        fprintf(f, "  \"victim_loss\": %.4f,\n", victim_loss);
        fprintf(f, "  \"pool_expected\": %.4f,\n", pool_expected);
        fprintf(f, "  \"pool_actual\": %.4f,\n", pool_actual);
        fprintf(f, "  \"pool_loss\": %.4f,\n", pool_loss);
        fprintf(f, "  \"withheld_loss\": %.4f,\n", withheld_loss);
        fprintf(f, "  \"withheld_ratio\": %.6f,\n", withheld_ratio);
        fprintf(f, "  \"saboteur_payout\": %.4f,\n", sab_payout);
        fprintf(f, "  \"saboteur_gain\": %.4f,\n", sab_payout - sab_fair + 0.5 * withheld_loss);
        fprintf(f, "  \"selfish_revenue_ratio\": %.6f,\n", selfish_ratio);
        fprintf(f, "  \"victim_lag\": %.0f,\n", victim_lag);
        fprintf(f, "  \"nvictims\": %d,\n", s->atk.nvictims);
        fprintf(f, "  \"nsybils\": %d,\n", s->atk.nsybils);
        fprintf(f, "  \"payment_included\": %d,\n", s->atk.payment_included);
        fprintf(f, "  \"payment_accepted\": %d,\n", s->atk.payment_accepted);
        fprintf(f, "  \"payment_reversed\": %d,\n", s->atk.payment_reversed);
        fprintf(f, "  \"defense_prevented\": %d,\n", s->atk.defense_prevented);
        fprintf(f, "  \"defense_delay_ms\": %.0f,\n", defense_delay);
        fprintf(f, "  \"extra_confirmations\": %ld,\n", extra_conf);
        fprintf(f, "  \"detection_time_ms\": %ld,\n", detect_ms);
        fprintf(f, "  \"detection_window\": %d,\n", s->detection_window);
        fprintf(f, "  \"alerts\": %ld,\n", s->alerts_total);
        fprintf(f, "  \"false_alerts\": %ld,\n", false_alerts);
        fprintf(f, "  \"mitigation\": %d,\n", s->mitigation_triggered);
        fprintf(f, "  \"selfish_penalty\": %d,\n", s->atk.selfish_penalty);
        fprintf(f, "  \"window_ms\": %lld,\n", (long long)s->cfg.window_ms);
        fprintf(f, "  \"duration_ms\": %lld\n", (long long)s->cfg.duration_ms);
        fprintf(f, "}\n");
        fclose(f);
    }
}

/* ------------------------------------------------------------------ */
/* Point d'entree                                                      */
/* ------------------------------------------------------------------ */
int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "Usage: %s <scenario.cfg>\n", argv[0]);
        return 1;
    }
    Config c;
    if (!config_load(&c, argv[1])) return 1;

    Sim *s = malloc(sizeof *s);
    if (!s) return 1;
    clock_t t0 = clock();
    sim_init(s, &c);
    sim_run(s);
    double ms = (double)(clock() - t0) * 1000.0 / CLOCKS_PER_SEC;

    char path[512];
    snprintf(path, sizeof path, "%s/summary.json", c.outdir);
    FILE *f = fopen(path, "r");
    if (f) {
        fseek(f, 0, SEEK_END);
        long sz = ftell(f);
        fseek(f, 0, SEEK_SET);
        char *buf = malloc((size_t)sz + 1);
        if (buf) {
            size_t got = fread(buf, 1, (size_t)sz, f);
            buf[got] = '\0';
            fclose(f);
            f = NULL;
            /* injecte le temps d'execution */
            char *p = strstr(buf, "\n}");
            if (p) {
                *p = '\0';
                FILE *g = fopen(path, "w");
                if (g) {
                    fprintf(g, "%s,\n  \"runtime_ms\": %.3f\n}\n", buf, ms);
                    fclose(g);
                }
            }
            free(buf);
        }
    }
    if (f) fclose(f);
    printf("run termine en %.1f ms\n", ms);
    sim_free(s);
    free(s);
    return 0;
}
