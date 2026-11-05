/* config.c - Lecture d'un scenario au format cle=valeur */
#include "sim.h"
#include <ctype.h>
#include <errno.h>

static char *trim(char *s) {
    while (*s && isspace((unsigned char)*s)) s++;
    char *e = s + strlen(s);
    while (e > s && isspace((unsigned char)e[-1])) *--e = '\0';
    return s;
}

void config_defaults(Config *c) {
    memset(c, 0, sizeof *c);
    snprintf(c->name, sizeof c->name, "run");
    c->seed = 42;
    c->consensus = CONS_POW;
    c->nnodes = 30;
    c->duration_blocks = 300;
    c->duration_ms = -1;
    c->difficulty = 2;
    c->block_interval = 10000;
    c->latency = 100;
    c->jitter = 30;
    c->gossip_degree = 8;
    c->loss = 0.0;
    c->window_blocks = 20;
    c->window_ms = -1;
    c->observer = 0;
    c->log_events = 0;

    c->attack_type = ATK_NONE;
    c->attacker_share = 0.60;
    c->attack_start_height = 20;
    c->attack_start_ms = -1;
    c->confirm_depth = 6;
    c->gamma = 0.5;
    c->pool_share = 0.40;
    c->saboteur_share = 0.30;
    c->sybil_count = 20;
    c->eclipse_victims = 4;

    c->block_reward = 50.0;
    c->victim_value = 1000.0;
    c->pool_fee = 0.02;

    snprintf(c->outdir, sizeof c->outdir, "results/runs/default");
    snprintf(c->model_file, sizeof c->model_file, "models/logreg.txt");

    c->defense.enabled = 0;
    c->defense.max_reorg_depth = 100;
    c->defense.checkpoint_interval = 0;
    c->defense.checkpoint_height = -1;
    c->defense.pool_audit = 0;
    c->defense.peer_diversity = 0;
    c->defense.tie_random = 0;
    c->defense.rate_limit = 0;
    c->defense.confirmation_depth = 6;
    c->defense.freeze_on_alert = 0;
    c->defense.freshness_ms = 0;
    c->defense.selfish_penalty = 0;

    c->detector_mode = DET_NONE;
}

static int parse_bool(const char *v) {
    return (!strcmp(v, "1") || !strcmp(v, "true") || !strcmp(v, "yes") ||
            !strcmp(v, "on"));
}

int config_load(Config *c, const char *path) {
    config_defaults(c);
    FILE *f = fopen(path, "r");
    if (!f) {
        fprintf(stderr, "Impossible d'ouvrir le scenario : %s\n", path);
        return 0;
    }

    char line[1024];
    while (fgets(line, sizeof line, f)) {
        char *s = trim(line);
        if (!*s || *s == '#') continue;
        char *eq = strchr(s, '=');
        if (!eq) continue;
        *eq = '\0';
        char *k = trim(s);
        char *v = trim(eq + 1);

        if (!strcmp(k, "name")) snprintf(c->name, sizeof c->name, "%s", v);
        else if (!strcmp(k, "seed")) c->seed = strtoull(v, NULL, 10);
        else if (!strcmp(k, "consensus")) c->consensus = !strcmp(v, "pos") ? CONS_POS : CONS_POW;
        else if (!strcmp(k, "nodes")) c->nnodes = atoi(v);
        else if (!strcmp(k, "duration_blocks")) c->duration_blocks = atoi(v);
        else if (!strcmp(k, "duration_ms")) c->duration_ms = (simtime_t)atoll(v);
        else if (!strcmp(k, "difficulty")) c->difficulty = atoi(v);
        else if (!strcmp(k, "block_interval_ms")) c->block_interval = (simtime_t)atoll(v);
        else if (!strcmp(k, "latency_ms")) c->latency = (simtime_t)atoll(v);
        else if (!strcmp(k, "jitter_ms")) c->jitter = (simtime_t)atoll(v);
        else if (!strcmp(k, "gossip_degree")) c->gossip_degree = atoi(v);
        else if (!strcmp(k, "loss")) c->loss = atof(v);
        else if (!strcmp(k, "window_blocks")) c->window_blocks = atoi(v);
        else if (!strcmp(k, "window_ms")) c->window_ms = (simtime_t)atoll(v);
        else if (!strcmp(k, "observer")) c->observer = atoi(v);
        else if (!strcmp(k, "log_events")) c->log_events = atoi(v);
        else if (!strcmp(k, "attack")) {
            if (!strcmp(v, "51") || !strcmp(v, "51%")) c->attack_type = ATK_51;
            else if (!strcmp(v, "selfish")) c->attack_type = ATK_SELFISH;
            else if (!strcmp(v, "withholding")) c->attack_type = ATK_WITHHOLD;
            else if (!strcmp(v, "sybil")) c->attack_type = ATK_SYBIL;
            else c->attack_type = ATK_NONE;
        }
        else if (!strcmp(k, "attacker_share")) c->attacker_share = atof(v);
        else if (!strcmp(k, "attack_start_height")) c->attack_start_height = atoi(v);
        else if (!strcmp(k, "attack_start_ms")) c->attack_start_ms = (simtime_t)atoll(v);
        else if (!strcmp(k, "confirm_depth")) c->confirm_depth = atoi(v);
        else if (!strcmp(k, "gamma")) c->gamma = atof(v);
        else if (!strcmp(k, "pool_share")) c->pool_share = atof(v);
        else if (!strcmp(k, "saboteur_share")) c->saboteur_share = atof(v);
        else if (!strcmp(k, "sybil_count")) c->sybil_count = atoi(v);
        else if (!strcmp(k, "eclipse_victims")) c->eclipse_victims = atoi(v);
        else if (!strcmp(k, "block_reward")) c->block_reward = atof(v);
        else if (!strcmp(k, "victim_value")) c->victim_value = atof(v);
        else if (!strcmp(k, "pool_fee")) c->pool_fee = atof(v);
        else if (!strcmp(k, "outdir")) snprintf(c->outdir, sizeof c->outdir, "%s", v);
        else if (!strcmp(k, "model_file")) snprintf(c->model_file, sizeof c->model_file, "%s", v);
        else if (!strcmp(k, "defense")) c->defense.enabled = parse_bool(v);
        else if (!strcmp(k, "max_reorg_depth")) c->defense.max_reorg_depth = atoi(v);
        else if (!strcmp(k, "checkpoint_interval")) c->defense.checkpoint_interval = atoi(v);
        else if (!strcmp(k, "pool_audit")) c->defense.pool_audit = parse_bool(v);
        else if (!strcmp(k, "peer_diversity")) c->defense.peer_diversity = parse_bool(v);
        else if (!strcmp(k, "tie_random")) c->defense.tie_random = parse_bool(v);
        else if (!strcmp(k, "rate_limit")) c->defense.rate_limit = parse_bool(v);
        else if (!strcmp(k, "defense_confirm_depth")) c->defense.confirmation_depth = atoi(v);
        else if (!strcmp(k, "freeze_on_alert")) c->defense.freeze_on_alert = parse_bool(v);
        else if (!strcmp(k, "freshness_ms")) c->defense.freshness_ms = atoi(v);
        else if (!strcmp(k, "selfish_penalty")) c->defense.selfish_penalty = parse_bool(v);
        else if (!strcmp(k, "detector")) {
            if (!strcmp(v, "rule")) c->detector_mode = DET_RULE;
            else if (!strcmp(v, "adaptive")) c->detector_mode = DET_ADAPTIVE;
            else if (!strcmp(v, "ml")) c->detector_mode = DET_ML;
            else if (!strcmp(v, "ensemble")) c->detector_mode = DET_ENSEMBLE;
            else c->detector_mode = DET_NONE;
        }
        /* cles inconnues ignorees volontairement */
    }
    fclose(f);

    if (c->duration_ms < 0)
        c->duration_ms = c->block_interval * (simtime_t)c->duration_blocks;
    if (c->window_ms < 0)
        c->window_ms = c->block_interval * (simtime_t)c->window_blocks;
    if (c->attack_start_ms < 0)
        c->attack_start_ms = c->block_interval * (simtime_t)c->attack_start_height;
    if (c->defense.confirmation_depth <= 0)
        c->defense.confirmation_depth = c->confirm_depth;
    if (!c->defense.enabled) {
        /* les contre-mesures ne s'activent que si defense=1 */
        c->defense.max_reorg_depth = 1 << 30;
        c->defense.pool_audit = 0;
        c->defense.peer_diversity = 0;
        c->defense.tie_random = 0;
        c->defense.rate_limit = 0;
        c->defense.freeze_on_alert = 0;
        c->defense.freshness_ms = 0;
        c->defense.selfish_penalty = 0;
    }
    return 1;
}

void config_print(const Config *c) {
    const char *atk[] = { "none", "51", "selfish", "withholding", "sybil" };
    printf("scenario=%s seed=%llu consensus=%s nodes=%d attack=%s share=%.2f "
           "defense=%d detector=%s\n",
           c->name, (unsigned long long)c->seed,
           c->consensus == CONS_POW ? "pow" : "pos",
           c->nnodes, atk[c->attack_type], c->attacker_share,
           c->defense.enabled, detector_name(c->detector_mode));
}
