/* sim.h - Structures et API de la plateforme de simulation (atelier 2) */
#ifndef SIM_H
#define SIM_H

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#include "sha256.h"
#include "rng.h"

#define MAX_NODES      256
#define MAX_BLOCKS     16384
#define MAX_TX         8
#define MAX_PEERS      32
#define MAX_CHAIN      8192
#define MAX_POOLS      8
#define MAX_WINDOWS    1024
#define MAX_EVENTS     262144
#define MAX_DELAYS     16384
#define MAX_FEATURES   32
#define MAP_SIZE       32768
#define HASH_LEN       65

#define ZERO_HASH "0000000000000000000000000000000000000000000000000000000000000000"

/* Nombre de variables utilisees par le detecteur */
#define NF 24

typedef int64_t simtime_t;

typedef enum { CONS_POW, CONS_POS } Consensus;
typedef enum { ATK_NONE, ATK_51, ATK_SELFISH, ATK_WITHHOLD, ATK_SYBIL } AttackType;
typedef enum { DET_NONE, DET_RULE, DET_ADAPTIVE, DET_ML, DET_ENSEMBLE } DetectorMode;
typedef enum { EV_MINE, EV_BLOCK, EV_WINDOW, EV_ATTACK, EV_CHURN, EV_STOP } EventType;
typedef enum { ROLE_HONEST, ROLE_ATTACKER, ROLE_SYBIL, ROLE_SABOTEUR } NodeRole;

/* ------------------------------------------------------------------ */
/* Bloc et chaine                                                      */
/* ------------------------------------------------------------------ */
typedef struct {
    int index;                  /* hauteur (genesis = 0) */
    char tx[MAX_TX][64];
    int ntx;
    char merkle[65];
    char prev[65];
    char hash[65];
    uint64_t nonce;
    char validator[24];
    int miner;                  /* id du noeud mineur (-1 genesis) */
    int pool;                   /* id du pool (-1 aucun) */
    int difficulty;
    simtime_t t_found;
    int parent;                 /* id du bloc parent (-1 genesis) */
    uint64_t work;              /* travail cumule */
    int private_block;          /* bloc garde prive par l'attaquant */
    int selfish;                /* bloc produit par l'attaquant selfish */
    int canonical;              /* appartient a la chaine de reference (fin de run) */
} Block;

typedef struct {
    Block blocks[MAX_BLOCKS];
    int nblocks;
    int map[MAP_SIZE];          /* table ouverte hash -> id+1 */
} BlockStore;

typedef struct {
    int chain[MAX_CHAIN];       /* ids des blocs de la chaine canonique */
    int len;                    /* nombre de blocs (genesis inclus) */
    int tip;
    uint64_t work;
    uint64_t known[MAX_BLOCKS / 64];  /* blocs deja recus */
} View;

/* ------------------------------------------------------------------ */
/* Noeuds et pools                                                     */
/* ------------------------------------------------------------------ */
typedef struct {
    int id;
    NodeRole role;
    double hash_share;          /* part de puissance / de mise */
    double stake;
    int subnet;
    int peers[MAX_PEERS];
    int npeers;
    View view;
    int mining;                 /* participe au consensus */
    long blocks_found;
    long blocks_canonical;
    long blocks_orphan;
    long blocks_received;
    long invalid_blocks;
    long msgs_sent;
    long msgs_recv;
    long withheld;              /* blocs retenus (block withholding) */
    long shares;                /* shares soumis au pool */
    double payout;              /* recompense simulee recue du pool */
    long long relay_delay_sum;
    int relay_delay_n;
    int banned;
    double risk;
    int alerted;
    int pool;
} Node;

typedef struct {
    int id;
    int members[MAX_NODES];
    int nmembers;
    double share;               /* part de hash du pool */
    long blocks_found;
    long blocks_canonical;
    long shares;
    double payout;
    int audited;
} Pool;

/* ------------------------------------------------------------------ */
/* File d'evenements                                                   */
/* ------------------------------------------------------------------ */
typedef struct {
    simtime_t t;
    uint64_t seq;
    int type;
    int src;
    int dst;
    int block;
    int data;
} Event;

typedef struct {
    Event heap[MAX_EVENTS];
    int n;
    uint64_t seq;
} EventQueue;

/* ------------------------------------------------------------------ */
/* Attaques                                                            */
/* ------------------------------------------------------------------ */
typedef struct {
    AttackType type;
    int active;
    simtime_t start_time;
    int start_height;
    double share;
    int suspects[MAX_NODES];
    int nsuspects;

    int victim_node;            /* marchand / victime */
    double victim_value;
    int payment_height;
    int payment_block;
    int payment_included;
    int payment_accepted;
    int payment_reversed;
    int attack_success;
    int reorg_depth;
    simtime_t accept_time;

    /* 51% / selfish mining */
    int private_chain[MAX_CHAIN];
    int private_len;
    int private_start;
    int private_tip;
    int private_mode;
    int fork_height;
    int fork_block;
    int lead;
    int public_height_seen;
    long private_mined;
    long selfish_canonical;

    /* block withholding */
    int pool_id;
    long withheld;
    int audit_done;
    int saboteur;

    /* sybil */
    int victims[MAX_NODES];
    int nvictims;
    int sybils[MAX_NODES];
    int nsybils;
    int sybil_peer_ratio;
    int eclipse_success;
    int defense_prevented;
    int selfish_penalty;
} AttackState;

/* ------------------------------------------------------------------ */
/* Defense et detection                                                */
/* ------------------------------------------------------------------ */
typedef struct {
    int enabled;
    int max_reorg_depth;
    int checkpoint_interval;
    int checkpoint_height;
    char checkpoint_hash[65];
    int pool_audit;
    int peer_diversity;
    int tie_random;
    int rate_limit;
    int confirmation_depth;
    int freeze_on_alert;
    int freshness_ms;
    int selfish_penalty;
} Defense;

typedef struct {
    DetectorMode mode;
    int nf;
    double mean[MAX_FEATURES];
    double sd[MAX_FEATURES];
    double w[MAX_FEATURES];
    double bias;
    double threshold;
    double ewma[MAX_FEATURES];
    double ewmv[MAX_FEATURES];
    int ewma_n;
    int n_alerts;
    simtime_t first_alert;
    int first_alert_label;
    double last_score;
} Detector;

/* ------------------------------------------------------------------ */
/* Fenetre de metriques                                                */
/* ------------------------------------------------------------------ */
typedef struct {
    int id;
    simtime_t t_start, t_end;
    int attack_active;
    double f[NF];
    int label;
    int predicted;
    double score;
    int detected;
    simtime_t first_detect_t;
} Window;

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */
typedef struct {
    char name[64];
    uint64_t seed;
    Consensus consensus;
    int nnodes;                 /* noeuds honnetes de base */
    int duration_blocks;
    simtime_t duration_ms;
    int difficulty;
    simtime_t block_interval;
    simtime_t latency;
    simtime_t jitter;
    int gossip_degree;
    double loss;
    int window_blocks;
    simtime_t window_ms;
    int observer;
    int log_events;

    AttackType attack_type;
    double attacker_share;
    int attack_start_height;
    simtime_t attack_start_ms;
    int confirm_depth;
    double gamma;
    double pool_share;
    double saboteur_share;
    int sybil_count;
    int eclipse_victims;

    double block_reward;
    double victim_value;
    double pool_fee;

    char outdir[256];
    char model_file[256];

    Defense defense;
    DetectorMode detector_mode;
} Config;

/* ------------------------------------------------------------------ */
/* Etat global de la simulation                                        */
/* ------------------------------------------------------------------ */
typedef struct {
    Config cfg;
    RNG rng;
    BlockStore store;
    Node nodes[MAX_NODES];
    int nnodes;                 /* total, sybils inclus */
    int base_nodes;
    Pool pools[MAX_POOLS];
    int npools;
    EventQueue q;
    simtime_t now;

    AttackState atk;
    Defense def;
    Detector det;

    Window windows[MAX_WINDOWS];
    int nwindows;

    long blocks_mined;
    long blocks_honest;
    long blocks_attacker;
    long blocks_canonical;
    long reorg_count;
    int max_reorg_depth;
    long long reorg_depth_sum;
    long double_spends;
    long withheld_total;
    long sybil_msgs;
    long alerts_total;
    long confirmation_rollbacks;
    int mitigation_triggered;

    simtime_t attack_start;
    simtime_t detection_time;
    int detection_window;
    int detection_label;
    double detection_score;

    int window_start_blocks;
    simtime_t window_start_time;
    long window_reorgs;
    int window_max_reorg;
    long window_withheld;
    long window_blocks_mined;
    long window_received;
    long window_invalid;
    long window_duplicate;

    simtime_t delays[MAX_DELAYS];
    int ndelays;

    FILE *fevents, *fblocks, *fnodes, *fwindows, *falerts;
} Sim;

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */
void rng_seed(RNG *r, uint64_t seed);
uint64_t rng_u64(RNG *r);
double rng_double(RNG *r);
int rng_int(RNG *r, int n);
double rng_exp(RNG *r, double mean);
double rng_normal(RNG *r);

void config_defaults(Config *c);
int  config_load(Config *c, const char *path);
void config_print(const Config *c);

void store_init(BlockStore *s);
int  store_add(BlockStore *s, Block *b);
int  store_find(BlockStore *s, const char *hash);
void merkle_root_block(const Block *b, char out[65]);
void calc_block_hash(const Block *b, char out[65]);
int  mine_block(Block *b, int difficulty, RNG *rng);
uint64_t block_work(const Block *b);
int  bc_create(Sim *s, int miner, int pool, int parent, const char *tx,
               int selfish, int private_block);
int  bc_validate(BlockStore *s, const Block *b);

void view_init(View *v, int genesis);
int  view_has(View *v, int id);
void view_mark(View *v, int id);
void view_build(BlockStore *s, View *v, int tip);
int  view_canonical(BlockStore *s, View *v, int id);

void schedule(Sim *s, simtime_t t, int type, int src, int dst, int block, int data);
Event pop_event(Sim *s);
simtime_t event_time(Sim *s);
void broadcast_block(Sim *s, int from, int bid, simtime_t extra_delay);

void sim_init(Sim *s, const Config *c);
void sim_run(Sim *s);
void sim_free(Sim *s);
void sim_write_summary(Sim *s);

void attack_init(Sim *s);
void attack_start(Sim *s);
void attack_on_block(Sim *s, int miner, int bid, int private_block);
void attack_on_receive(Sim *s, int node, int bid);
void attack_on_reorg(Sim *s, int depth);
void attack_tick(Sim *s);
void attack_publish_private(Sim *s, int count);
int  attack_is_suspect(Sim *s, int node);

void metrics_window(Sim *s);
void metrics_finalize(Sim *s);
extern const char *FEATURE_NAMES[NF];
void write_events_header(Sim *s);
void log_event(Sim *s, const char *type, int src, int dst, int block, const char *detail);

void detector_init(Sim *s);
int  detector_load(Detector *d, const char *path);
void detector_eval(Sim *s, Window *w);
const char *detector_name(DetectorMode m);

#endif
