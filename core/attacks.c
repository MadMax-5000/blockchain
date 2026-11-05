/* attacks.c - 51%/double spending, selfish mining, block withholding, Sybil */
#include "sim.h"

static int block_has_tx(const Block *b, const char *needle) {
    for (int i = 0; i < b->ntx; i++)
        if (strstr(b->tx[i], needle)) return 1;
    return 0;
}

int attack_is_suspect(Sim *s, int node) {
    for (int i = 0; i < s->atk.nsuspects; i++)
        if (s->atk.suspects[i] == node) return 1;
    return 0;
}

static int attacker_node(Sim *s) {
    return s->atk.nsuspects > 0 ? s->atk.suspects[0] : -1;
}

static int view_height(Sim *s, int node) {
    return s->store.blocks[s->nodes[node].view.tip].index;
}

void attack_init(Sim *s) {
    memset(&s->atk, 0, sizeof s->atk);
    s->atk.type = s->cfg.attack_type;
    s->atk.victim_node = s->cfg.nnodes > 1 ? 1 : 0;
    s->atk.victim_value = s->cfg.victim_value;
    s->atk.start_time = -1;
    s->atk.payment_height = -1;
    s->atk.payment_block = -1;
    s->atk.saboteur = -1;
    s->atk.pool_id = -1;
    s->atk.private_tip = -1;
    s->atk.fork_block = -1;
    s->atk.private_mode = 0;

    for (int i = 0; i < s->nnodes && s->atk.nsuspects < MAX_NODES; i++) {
        NodeRole r = s->nodes[i].role;
        if (r == ROLE_ATTACKER || r == ROLE_SYBIL) {
            s->atk.suspects[s->atk.nsuspects++] = i;
        } else if (r == ROLE_SABOTEUR) {
            s->atk.suspects[s->atk.nsuspects++] = i;
            s->atk.saboteur = i;
        }
    }
    if (s->atk.type == ATK_SYBIL) {
        s->atk.nsybils = 0;
        for (int i = 0; i < s->nnodes; i++)
            if (s->nodes[i].role == ROLE_SYBIL && s->atk.nsybils < MAX_NODES)
                s->atk.sybils[s->atk.nsybils++] = i;
        s->atk.nvictims = 0;
        int v0 = 2;
        for (int i = 0; i < s->cfg.eclipse_victims &&
                        v0 + i < s->base_nodes && s->atk.nvictims < MAX_NODES; i++)
            s->atk.victims[s->atk.nvictims++] = v0 + i;
    }
    if (s->atk.type == ATK_WITHHOLD) s->atk.pool_id = 0;
}

void attack_start(Sim *s) {
    if (s->atk.type == ATK_NONE) return;
    if (s->atk.active) return;
    s->atk.active = 1;
    s->atk.start_time = s->now;
    s->atk.start_height = view_height(s, s->cfg.observer);
    s->attack_start = s->now;

    if (s->atk.type == ATK_51 || s->atk.type == ATK_SELFISH) {
        int a = attacker_node(s);
        if (a < 0) return;
        s->atk.fork_block = s->nodes[a].view.tip;
        s->atk.private_tip = s->atk.fork_block;
        s->atk.fork_height = s->store.blocks[s->atk.fork_block].index;
        s->atk.private_len = 0;
        s->atk.private_start = 0;
        s->atk.private_mode = 1;
        s->atk.lead = 0;
        s->atk.public_height_seen = s->atk.fork_height;
    }

    log_event(s, "attack_start", -1, -1, -1,
              s->atk.type == ATK_51 ? "51/double-spend" :
              s->atk.type == ATK_SELFISH ? "selfish-mining" :
              s->atk.type == ATK_WITHHOLD ? "block-withholding" : "sybil");
}

void attack_publish_private(Sim *s, int count) {
    if (count <= 0 || count > s->atk.private_len) return;
    int start = s->atk.private_start;
    for (int i = 0; i < count; i++) {
        int bid = s->atk.private_chain[start + i];
        s->store.blocks[bid].private_block = 0;
        if (s->atk.type == ATK_SELFISH) s->store.blocks[bid].selfish = 1;
        broadcast_block(s, attacker_node(s), bid,
                        (simtime_t)i * (s->cfg.latency + s->cfg.jitter + 5));
    }
    int last = s->atk.private_chain[start + count - 1];
    s->atk.private_start += count;
    s->atk.private_len -= count;
    s->atk.private_tip = last;
    s->atk.fork_height = s->store.blocks[last].index;

    int a = attacker_node(s);
    if (a >= 0) {
        if (s->store.blocks[last].index >= s->store.blocks[s->nodes[a].view.tip].index)
            view_build(&s->store, &s->nodes[a].view, last);
        s->nodes[a].view.work = s->store.blocks[last].work;
    }

    if (s->atk.private_len == 0) {
        s->atk.private_start = 0;
        s->atk.private_tip = a >= 0 ? s->nodes[a].view.tip : last;
        s->atk.fork_height = s->store.blocks[s->atk.private_tip].index;
        s->atk.lead = 0;
        if (s->atk.type == ATK_51) {
            s->atk.private_mode = 0;
            s->atk.attack_success = s->atk.payment_accepted &&
                                    s->atk.payment_included ? 1 : 0;
        }
    } else {
        s->atk.private_tip = s->atk.private_chain[s->atk.private_start +
                                                  s->atk.private_len - 1];
        s->atk.lead = s->atk.private_len;
    }
    log_event(s, "publish", a, -1, last, s->atk.type == ATK_51 ? "51" : "selfish");
}

/* Verifie si le paiement victime peut etre considere comme accepte */
static void check_payment_acceptance(Sim *s, int node) {
    if (s->atk.type != ATK_51) return;
    if (!s->atk.payment_included || s->atk.payment_accepted) return;
    if (s->atk.defense_prevented) return;
    if (s->def.enabled && s->def.freeze_on_alert && s->atk.defense_prevented) return;
    int h = view_height(s, node);
    int need = s->atk.payment_height + (s->def.enabled ? s->def.confirmation_depth
                                                      : s->cfg.confirm_depth);
    if (h >= need) {
        s->atk.payment_accepted = 1;
        s->atk.accept_time = s->now;
        log_event(s, "payment_accept", node, -1, s->atk.payment_block, "confirmed");
    }
}

static void selfish_on_public(Sim *s, int pub_h) {
    int a = attacker_node(s);
    if (a < 0) return;
    int obs_h = view_height(s, s->cfg.observer);
    int pub = pub_h > obs_h ? pub_h : obs_h;

    if (s->atk.private_len == 0) {
        /* pas de chaine privee : on mine sur la chaine publique */
        if (s->store.blocks[s->nodes[a].view.tip].index < obs_h)
            view_build(&s->store, &s->nodes[a].view,
                       s->nodes[s->cfg.observer].view.tip);
        s->atk.private_tip = s->nodes[a].view.tip;
        s->atk.fork_height = s->store.blocks[s->atk.private_tip].index;
        s->atk.lead = 0;
        return;
    }

    int pub_len = pub - s->atk.fork_height;
    if (pub_len < 0) pub_len = 0;
    int lead = s->atk.private_len - pub_len;
    s->atk.lead = lead;

    if (lead >= 0) {
        /* on publie toute la chaine privee : plus longue, ou course si egale */
        attack_publish_private(s, s->atk.private_len);
    } else {
        /* la chaine publique a depasse la chaine privee : on abandonne */
        s->atk.private_start = 0;
        s->atk.private_len = 0;
        int pubtip = s->nodes[s->cfg.observer].view.tip;
        if (s->store.blocks[pubtip].index >=
            s->store.blocks[s->nodes[a].view.tip].index)
            view_build(&s->store, &s->nodes[a].view, pubtip);
        s->atk.private_tip = s->nodes[a].view.tip;
        s->atk.fork_height = s->store.blocks[s->atk.private_tip].index;
        s->atk.lead = 0;
    }
}

void attack_on_block(Sim *s, int miner, int bid, int private_block) {
    if (!s->atk.active) return;
    Block *b = &s->store.blocks[bid];

    if (private_block) {
        if (s->atk.type != ATK_51 && s->atk.type != ATK_SELFISH) return;
        if (s->atk.private_len == 0) {
            s->atk.private_start = 0;
            s->atk.fork_height = s->store.blocks[b->parent].index;
        }
        if (s->atk.private_start + s->atk.private_len < MAX_CHAIN) {
            s->atk.private_chain[s->atk.private_start + s->atk.private_len] = bid;
            s->atk.private_len++;
        }
        s->atk.private_tip = bid;
        s->atk.private_mined++;
        s->atk.lead = s->atk.private_len;

        if (s->atk.type == ATK_51) {
            int pub = view_height(s, s->cfg.observer);
            int lead = s->store.blocks[bid].index - pub;
            s->atk.lead = lead;
            if (s->atk.payment_accepted && lead > 0 && s->atk.private_mode) {
                attack_publish_private(s, s->atk.private_len);
            }
        }
        return;
    }

    if (s->atk.type == ATK_WITHHOLD && miner == s->atk.saboteur) {
        s->atk.withheld++;
        s->withheld_total++;
        s->window_withheld++;
        s->nodes[miner].withheld++;
        log_event(s, "withhold", miner, -1, bid, "saboteur");
        return;
    }

    if (s->atk.type == ATK_51 && block_has_tx(b, "VICTIM")) {
        if (!s->atk.payment_included) {
            s->atk.payment_included = 1;
            s->atk.payment_block = bid;
            s->atk.payment_height = b->index;
            log_event(s, "payment_include", miner, -1, bid, "VICTIM");
        }
    }

    if (s->atk.type == ATK_SELFISH && !attack_is_suspect(s, miner))
        selfish_on_public(s, b->index);
}

void attack_on_receive(Sim *s, int node, int bid) {
    if (!s->atk.active) return;
    Block *b = &s->store.blocks[bid];
    if (b->private_block) return;

    int a = attacker_node(s);
    if (node == a && s->atk.type == ATK_51) {
        if (b->index > s->atk.public_height_seen) {
            s->atk.public_height_seen = b->index;
            check_payment_acceptance(s, node);
            int pub = view_height(s, s->cfg.observer);
            int lead = s->atk.private_tip >= 0 ?
                       s->store.blocks[s->atk.private_tip].index - pub : 0;
            s->atk.lead = lead;
            if (s->atk.payment_accepted && lead > 0 && s->atk.private_mode)
                attack_publish_private(s, s->atk.private_len);
        }
    }

    if (s->atk.type == ATK_51 && node == s->cfg.observer)
        check_payment_acceptance(s, node);
}

void attack_on_reorg(Sim *s, int depth) {
    if (!s->atk.active) return;
    if (depth > s->atk.reorg_depth) s->atk.reorg_depth = depth;
    int need = s->def.enabled ? s->def.confirmation_depth : s->cfg.confirm_depth;
    if (depth >= need) {
        s->confirmation_rollbacks++;
        if (s->atk.type == ATK_51 && s->atk.payment_included)
            s->atk.payment_reversed = 1;
    }
}

void attack_tick(Sim *s) {
    if (s->atk.type == ATK_NONE) return;
    if (!s->atk.active) {
        attack_start(s);
        return;
    }
    /* audit periodique du pool si la defense est active */
    if (s->atk.type == ATK_WITHHOLD && s->def.enabled && s->def.pool_audit &&
        !s->atk.audit_done && s->atk.withheld >= 3) {
        s->atk.audit_done = 1;
        if (s->atk.saboteur >= 0) {
            s->nodes[s->atk.saboteur].banned = 1;
            s->nodes[s->atk.saboteur].shares = 0;
        }
        s->mitigation_triggered = 1;
        log_event(s, "mitigation", -1, -1, -1, "pool-audit");
    }
}
