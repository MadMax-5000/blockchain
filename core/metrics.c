/* metrics.c - Extraction des metriques reseau par fenetre + etiquetage */
#include "sim.h"

const char *FEATURE_NAMES[NF] = {
    "orphan_rate",
    "stale_rate",
    "fork_rate",
    "max_reorg_depth_norm",
    "block_interval_ratio",
    "block_interval_cv",
    "prop_delay_p50_norm",
    "prop_delay_p95_norm",
    "tip_divergence_norm",
    "difficulty_norm",
    "max_node_share",
    "reward_gini",
    "pool_share_deviation",
    "withheld_rate",
    "sybil_peer_ratio",
    "invalid_rate",
    "msg_concentration",
    "subnet_concentration",
    "chain_inconsistency",
    "rollback_rate",
    "duplicate_rate",
    "dominant_miner_orphan_rate",
    "hash_share_deviation",
    "active_miner_ratio"
};

static int cmp_i64(const void *a, const void *b) {
    int64_t x = *(const int64_t *)a, y = *(const int64_t *)b;
    return (x > y) - (x < y);
}

static int cmp_long(const void *a, const void *b) {
    long x = *(const long *)a, y = *(const long *)b;
    return (x > y) - (x < y);
}

static double gini(const long *v, int n) {
    if (n <= 0) return 0.0;
    long *tmp = malloc(sizeof(long) * (size_t)n);
    if (!tmp) return 0.0;
    long sum = 0;
    for (int i = 0; i < n; i++) { tmp[i] = v[i]; sum += v[i]; }
    if (sum <= 0) { free(tmp); return 0.0; }
    qsort(tmp, (size_t)n, sizeof(long), cmp_long);
    double acc = 0.0;
    for (int i = 0; i < n; i++) acc += (double)(i + 1) * (double)tmp[i];
    double g = 2.0 * acc / ((double)n * (double)sum) - ((double)n + 1.0) / (double)n;
    free(tmp);
    return g < 0 ? 0 : g;
}

static double safe_ratio(double a, double b) {
    return b > 1e-9 ? a / b : 0.0;
}

void metrics_window(Sim *s) {
    if (s->nwindows >= MAX_WINDOWS) return;
    Window *w = &s->windows[s->nwindows];
    memset(w, 0, sizeof *w);
    w->id = s->nwindows;
    w->t_start = s->window_start_time;
    w->t_end = s->now;
    w->attack_active = s->atk.active;
    w->label = s->atk.active ? 1 : 0;

    simtime_t grace = s->cfg.latency * 2 + 500;
    simtime_t cutoff = s->now - grace;

    /* --- blocs mines dans la fenetre et statut canonique --- */
    int total = 0, orphan = 0;
    long miner_count[MAX_NODES] = {0};
    long miner_orphan[MAX_NODES] = {0};
    long pool_count[MAX_POOLS] = {0};
    int active_miners = 0;
    for (int i = 0; i < s->store.nblocks; i++) {
        Block *b = &s->store.blocks[i];
        if (b->miner < 0) continue;
        if (b->t_found < w->t_start || b->t_found > cutoff) continue;
        total++;
        int canon = view_canonical(&s->store, &s->nodes[s->cfg.observer].view, i);
        if (!canon) {
            orphan++;
            miner_orphan[b->miner]++;
        }
        miner_count[b->miner]++;
        if (b->pool >= 0 && b->pool < s->npools && canon) pool_count[b->pool]++;
    }
    for (int i = 0; i < s->nnodes; i++) if (miner_count[i] > 0) active_miners++;

    w->f[0] = safe_ratio((double)orphan, (double)total);
    w->f[1] = w->f[0];
    w->f[2] = safe_ratio((double)s->window_reorgs, (double)total);
    w->f[3] = fmin(1.0, (double)s->window_max_reorg / 10.0);

    /* --- intervalles entre blocs (tous les noeuds) --- */
    int nint = 0;
    double sum_int = 0.0, sumsq_int = 0.0;
    simtime_t prev = -1;
    for (int i = 0; i < s->store.nblocks; i++) {
        Block *b = &s->store.blocks[i];
        if (b->miner < 0) continue;
        if (b->t_found < w->t_start || b->t_found > cutoff) continue;
        if (prev >= 0) {
            double d = (double)(b->t_found - prev);
            sum_int += d;
            sumsq_int += d * d;
            nint++;
        }
        prev = b->t_found;
    }
    double mean_int = nint > 0 ? sum_int / nint : (double)s->cfg.block_interval;
    double var_int = nint > 0 ? sumsq_int / nint - mean_int * mean_int : 0.0;
    if (var_int < 0) var_int = 0;
    double cv_int = mean_int > 1e-9 ? sqrt(var_int) / mean_int : 0.0;
    w->f[4] = safe_ratio(mean_int, (double)s->cfg.block_interval);
    w->f[5] = fmin(5.0, cv_int);

    /* --- delais de propagation vers l'observateur --- */
    simtime_t delays[MAX_DELAYS];
    int nd = 0;
    /* on reutilise les delais accumules pendant la fenetre */
    for (int i = 0; i < s->ndelays; i++) {
        simtime_t d = s->delays[i];
        delays[nd++] = d;
    }
    if (nd > 0) {
        qsort(delays, (size_t)nd, sizeof(simtime_t), cmp_i64);
        double p50 = (double)delays[nd / 2];
        int idx95 = (int)(0.95 * (nd - 1));
        double p95 = (double)delays[idx95];
        w->f[6] = safe_ratio(p50, (double)s->cfg.block_interval);
        w->f[7] = safe_ratio(p95, (double)s->cfg.block_interval);
    }

    /* --- divergence de vues --- */
    int minh = 1 << 30, maxh = -1;
    int on_observer = 0, honest_count = 0;
    const char *obs_tip = s->store.blocks[s->nodes[s->cfg.observer].view.tip].hash;
    int distinct_tips = 0;
    char tips[MAX_NODES][65];
    for (int i = 0; i < s->nnodes; i++) {
        Node *n = &s->nodes[i];
        if (n->role == ROLE_SYBIL) continue;
        int h = s->store.blocks[n->view.tip].index;
        if (h < minh) minh = h;
        if (h > maxh) maxh = h;
        honest_count++;
        if (!strcmp(s->store.blocks[n->view.tip].hash, obs_tip)) on_observer++;
        int seen = 0;
        for (int k = 0; k < distinct_tips; k++)
            if (!strcmp(tips[k], s->store.blocks[n->view.tip].hash)) { seen = 1; break; }
        if (!seen && distinct_tips < MAX_NODES)
            snprintf(tips[distinct_tips++], 65, "%s", s->store.blocks[n->view.tip].hash);
    }
    if (maxh < 0) maxh = 0;
    if (minh > maxh) minh = maxh;
    w->f[8] = fmin(1.0, (double)(maxh - minh) / 10.0);
    w->f[9] = (double)s->cfg.difficulty / 10.0;

    /* --- concentration des recompenses --- */
    long counts[MAX_NODES];
    int nc = 0;
    long total_canon = 0;
    for (int i = 0; i < s->nnodes; i++) {
        if (miner_count[i] > 0) {
            counts[nc++] = miner_count[i];
            total_canon += miner_count[i];
        }
    }
    double max_share = 0.0;
    for (int i = 0; i < nc; i++) {
        double sh = safe_ratio((double)counts[i], (double)total_canon);
        if (sh > max_share) max_share = sh;
    }
    w->f[10] = max_share;
    w->f[11] = gini(counts, nc);

    /* --- ecart de part des pools --- */
    double pool_dev = 0.0;
    for (int p = 0; p < s->npools; p++) {
        double actual = safe_ratio((double)pool_count[p], (double)total_canon);
        double dev = fabs(actual - s->pools[p].share);
        if (dev > pool_dev) pool_dev = dev;
    }
    w->f[12] = fmin(1.0, pool_dev);

    w->f[13] = safe_ratio((double)s->window_withheld, (double)(total > 0 ? total : 1));

    /* --- sybil : part de pairs dans un meme sous-reseau --- */
    double sybil_ratio = 0.0, entropy_conc = 0.0;
    int ent_nodes = 0;
    for (int i = 0; i < s->nnodes; i++) {
        Node *n = &s->nodes[i];
        if (n->role == ROLE_SYBIL || n->npeers == 0) continue;
        int sy = 0;
        int sub[MAX_PEERS], nsub = 0;
        for (int k = 0; k < n->npeers; k++) {
            Node *p = &s->nodes[n->peers[k]];
            if (p->role == ROLE_SYBIL) sy++;
            int seen = 0;
            for (int j = 0; j < nsub; j++) if (sub[j] == p->subnet) { seen = 1; break; }
            if (!seen) sub[nsub++] = p->subnet;
        }
        double r = safe_ratio((double)sy, (double)n->npeers);
        if (r > sybil_ratio) sybil_ratio = r;
        double ent = 0.0;
        for (int j = 0; j < nsub; j++) {
            int c = 0;
            for (int k = 0; k < n->npeers; k++)
                if (s->nodes[n->peers[k]].subnet == sub[j]) c++;
            double pr = (double)c / (double)n->npeers;
            if (pr > 0) ent -= pr * log(pr);
        }
        if (nsub > 1) ent /= log((double)nsub);
        entropy_conc += 1.0 - ent;
        ent_nodes++;
    }
    w->f[14] = sybil_ratio;
    w->f[17] = ent_nodes > 0 ? entropy_conc / ent_nodes : 0.0;

    w->f[15] = safe_ratio((double)s->window_invalid, (double)(s->window_received > 0 ? s->window_received : 1));

    long total_msgs = 0, max_msgs = 0;
    for (int i = 0; i < s->nnodes; i++) {
        total_msgs += s->nodes[i].msgs_sent;
        if (s->nodes[i].msgs_sent > max_msgs) max_msgs = s->nodes[i].msgs_sent;
    }
    w->f[16] = safe_ratio((double)max_msgs, (double)(total_msgs > 0 ? total_msgs : 1));

    w->f[18] = honest_count > 0 ? 1.0 - safe_ratio((double)on_observer, (double)honest_count) : 0.0;
    w->f[19] = safe_ratio((double)s->confirmation_rollbacks, (double)(total > 0 ? total : 1));
    w->f[20] = safe_ratio((double)s->window_duplicate, (double)(s->window_received > 0 ? s->window_received : 1));

    /* --- mineur dominant : part de ses blocs non canoniques --- */
    int dom = -1;
    long dom_n = 0;
    for (int i = 0; i < s->nnodes; i++) {
        if (miner_count[i] > dom_n) { dom_n = miner_count[i]; dom = i; }
    }
    w->f[21] = dom >= 0 ? safe_ratio((double)miner_orphan[dom], (double)dom_n) : 0.0;

    /* --- ecart entre part observee et part attendue --- */
    double hash_dev = 0.0;
    for (int i = 0; i < s->nnodes; i++) {
        if (s->nodes[i].role == ROLE_SYBIL) continue;
        double expected = s->nodes[i].hash_share;
        double observed = safe_ratio((double)miner_count[i], (double)total_canon);
        if (expected > 1e-6) {
            double dev = fabs(observed - expected) / expected;
            if (dev > hash_dev) hash_dev = dev;
        }
    }
    w->f[22] = fmin(5.0, hash_dev);
    w->f[23] = s->nnodes > 0 ? safe_ratio((double)active_miners, (double)(s->nnodes - (s->nnodes - s->base_nodes))) : 0.0;

    /* --- detection en ligne --- */
    detector_eval(s, w);

    /* --- ecriture CSV --- */
    if (s->fwindows) {
        fprintf(s->fwindows, "%d,%lld,%lld,%d", w->id, (long long)w->t_start, (long long)w->t_end, w->label);
        for (int i = 0; i < NF; i++) fprintf(s->fwindows, ",%.6f", w->f[i]);
        fprintf(s->fwindows, ",%d,%.6f,%d\n", w->predicted, w->score, w->detected);
    }

    s->nwindows++;
    s->window_start_time = s->now;
    s->window_start_blocks = (int)s->blocks_mined;
    s->window_reorgs = 0;
    s->window_max_reorg = 0;
    s->window_withheld = 0;
    s->window_blocks_mined = 0;
    s->window_received = 0;
    s->window_invalid = 0;
    s->window_duplicate = 0;
    s->ndelays = 0;
}

void metrics_finalize(Sim *s) {
    View *ref = &s->nodes[s->cfg.observer].view;
    for (int i = 0; i < s->store.nblocks; i++) s->store.blocks[i].canonical = 0;
    for (int i = 0; i < ref->len; i++) {
        int id = ref->chain[i];
        s->store.blocks[id].canonical = 1;
        if (s->store.blocks[id].miner >= 0)
            s->nodes[s->store.blocks[id].miner].blocks_canonical++;
    }
    s->blocks_canonical = ref->len > 0 ? ref->len - 1 : 0;

    for (int i = 0; i < s->store.nblocks; i++) {
        Block *b = &s->store.blocks[i];
        if (b->miner < 0) continue;
        if (!b->canonical) s->nodes[b->miner].blocks_orphan++;
        if (b->pool >= 0 && b->pool < s->npools) {
            s->pools[b->pool].blocks_found++;
            if (b->canonical) s->pools[b->pool].blocks_canonical++;
        }
    }
    s->atk.selfish_canonical = 0;
    for (int i = 0; i < s->store.nblocks; i++) {
        Block *b = &s->store.blocks[i];
        if (b->canonical && b->selfish) s->atk.selfish_canonical++;
    }
}
