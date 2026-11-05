/* detector.c - Detection adaptative : regles, EWMA, modele ML exporte, ensemble */
#include "sim.h"
#include <ctype.h>

static double clamp01(double x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
static double sigmoid(double x) { return 1.0 / (1.0 + exp(-x)); }

const char *detector_name(DetectorMode m) {
    switch (m) {
        case DET_RULE: return "rule";
        case DET_ADAPTIVE: return "adaptive";
        case DET_ML: return "ml";
        case DET_ENSEMBLE: return "ensemble";
        default: return "none";
    }
}

/* Lit une liste de nombres separes par des virgules */
static int parse_list(const char *s, double *out, int max) {
    int n = 0;
    const char *p = s;
    while (*p && n < max) {
        while (*p && (isspace((unsigned char)*p) || *p == ',')) p++;
        if (!*p) break;
        char *end = NULL;
        double v = strtod(p, &end);
        if (end == p) break;
        out[n++] = v;
        p = end;
    }
    return n;
}

int detector_load(Detector *d, const char *path) {
    FILE *f = fopen(path, "r");
    if (!f) return 0;
    char line[8192];
    double vals[MAX_FEATURES];
    while (fgets(line, sizeof line, f)) {
        char *eq = strchr(line, '=');
        if (!eq) continue;
        *eq = '\0';
        char *k = line;
        char *v = eq + 1;
        /* nettoyage */
        char *e = v + strlen(v);
        while (e > v && isspace((unsigned char)e[-1])) *--e = '\0';
        while (*k && isspace((unsigned char)*k)) k++;
        e = k + strlen(k);
        while (e > k && isspace((unsigned char)e[-1])) *--e = '\0';

        if (!strcmp(k, "mean")) {
            int n = parse_list(v, vals, MAX_FEATURES);
            for (int i = 0; i < n; i++) d->mean[i] = vals[i];
        } else if (!strcmp(k, "sd") || !strcmp(k, "std")) {
            int n = parse_list(v, vals, MAX_FEATURES);
            for (int i = 0; i < n; i++) d->sd[i] = vals[i] > 1e-9 ? vals[i] : 1.0;
        } else if (!strcmp(k, "w") || !strcmp(k, "weights")) {
            int n = parse_list(v, vals, MAX_FEATURES);
            for (int i = 0; i < n; i++) d->w[i] = vals[i];
        } else if (!strcmp(k, "b") || !strcmp(k, "bias")) {
            d->bias = atof(v);
        } else if (!strcmp(k, "threshold")) {
            d->threshold = atof(v);
        } else if (!strcmp(k, "n") || !strcmp(k, "nf")) {
            d->nf = atoi(v);
        }
    }
    fclose(f);
    if (d->nf <= 0 || d->nf > NF) d->nf = NF;
    if (d->threshold <= 0) d->threshold = 0.5;
    return 1;
}

void detector_init(Sim *s) {
    Detector *d = &s->det;
    memset(d, 0, sizeof *d);
    d->mode = s->cfg.detector_mode;
    d->nf = NF;
    d->threshold = 0.5;
    for (int i = 0; i < NF; i++) {
        d->mean[i] = 0.0;
        d->sd[i] = 1.0;
        d->w[i] = 0.0;
    }
    d->bias = 0.0;
    if ((d->mode == DET_ML || d->mode == DET_ENSEMBLE) && s->cfg.model_file[0]) {
        if (!detector_load(d, s->cfg.model_file))
            fprintf(stderr, "Modele introuvable (%s), repli sur les regles\n", s->cfg.model_file);
    }
}

/* ------------------------------------------------------------------ */
/* Regles statiques                                                    */
/* ------------------------------------------------------------------ */
static double rule_score(const Window *w) {
    double score = 0.0;
    if (w->f[3] > 0.15) score += 0.50;              /* profondeur de reorg */
    if (w->f[0] > 0.20) score += 0.35;              /* orphelins */
    if (w->f[18] > 0.20) score += 0.25;             /* incoherence de chaine */
    if (w->f[13] > 0.02) score += 0.25;             /* blocs retenus */
    if (w->f[14] > 0.40) score += 0.30;             /* pairs sybil */
    if (w->f[19] > 0.01) score += 0.20;             /* rollbacks de confirmation */
    if (w->f[12] > 0.30) score += 0.15;             /* ecart de pool */
    if (w->f[5] > 2.00) score += 0.05;              /* irregularite des blocs */
    if (w->f[22] > 5.00) score += 0.05;             /* ecart de part de hash */
    return clamp01(score);
}

/* ------------------------------------------------------------------ */
/* Regles adaptatives (EWMA / z-score)                                 */
/* ------------------------------------------------------------------ */
static double adaptive_score(Sim *s, const Window *w) {
    Detector *d = &s->det;
    if (d->ewma_n == 0) {
        for (int i = 0; i < NF; i++) {
            d->ewma[i] = w->f[i];
            d->ewmv[i] = 0.01;
        }
        d->ewma_n = 1;
        return 0.0;
    }
    double alpha = 0.30;
    double maxz = 0.0;
    int idx[8] = { 0, 3, 13, 14, 18, 19, 22, 5 };
    for (int k = 0; k < 8; k++) {
        int i = idx[k];
        double var = d->ewmv[i];
        double sd = sqrt(var > 1e-9 ? var : 1e-9);
        double z = fabs(w->f[i] - d->ewma[i]) / sd;
        if (z > maxz) maxz = z;
    }
    for (int i = 0; i < NF; i++) {
        double diff = w->f[i] - d->ewma[i];
        d->ewma[i] = alpha * w->f[i] + (1 - alpha) * d->ewma[i];
        d->ewmv[i] = alpha * diff * diff + (1 - alpha) * d->ewmv[i];
    }
    d->ewma_n++;
    if (d->ewma_n < 4) return 0.0;
    return clamp01((maxz - 2.0) / 6.0);
}

/* ------------------------------------------------------------------ */
/* Modele lineaire (logistic regression exportee par Python)           */
/* ------------------------------------------------------------------ */
static double ml_score(Detector *d, const Window *w) {
    double z = d->bias;
    for (int i = 0; i < d->nf && i < NF; i++) {
        double sd = d->sd[i] > 1e-9 ? d->sd[i] : 1.0;
        z += d->w[i] * (w->f[i] - d->mean[i]) / sd;
    }
    return sigmoid(z);
}

static const char *alert_type(const Window *w) {
    if (w->f[13] > 0.03 || w->f[12] > 0.20) return "pool";
    if (w->f[14] > 0.50 || w->f[17] > 0.50) return "sybil";
    if (w->f[0] > 0.10 || w->f[3] > 0.20 || w->f[18] > 0.25) return "consensus";
    return "anomaly";
}

static int alert_suspect(Sim *s, const Window *w) {
    if (w->f[13] > 0.03) return s->atk.saboteur;
    if (w->f[14] > 0.50) {
        for (int i = 0; i < s->nnodes; i++)
            if (s->nodes[i].role == ROLE_SYBIL) return i;
    }
    if (s->atk.nsuspects > 0) return s->atk.suspects[0];
    return -1;
}

/* ------------------------------------------------------------------ */
/* Contre-mesures declenchees par une alerte                           */
/* ------------------------------------------------------------------ */
static void apply_mitigation(Sim *s, const Window *w) {
    if (!s->def.enabled) return;
    int triggered = 0;

    int consensus_alert = w->f[0] > 0.10 || w->f[3] > 0.20 || w->f[18] > 0.25 ||
                          w->f[19] > 0.02;
    if (consensus_alert && s->def.freeze_on_alert) {
        if (s->atk.payment_included && !s->atk.payment_accepted &&
            s->atk.type == ATK_51) {
            s->atk.defense_prevented = 1;
            s->atk.attack_success = 0;
            triggered = 1;
        }
    }

    if (s->def.selfish_penalty && s->atk.type == ATK_SELFISH && consensus_alert) {
        s->atk.selfish_penalty = 1;
        triggered = 1;
    }

    if (s->def.pool_audit && (w->f[13] > 0.02 || w->f[12] > 0.15)) {
        if (!s->atk.audit_done && s->atk.saboteur >= 0) {
            s->atk.audit_done = 1;
            s->nodes[s->atk.saboteur].banned = 1;
            s->nodes[s->atk.saboteur].shares = 0;
            triggered = 1;
        }
    }

    if (s->def.peer_diversity && (w->f[14] > 0.40 || w->f[17] > 0.50)) {
        /* retire les pairs sybil des noeuds honnetes */
        for (int i = 0; i < s->nnodes; i++) {
            Node *n = &s->nodes[i];
            if (n->role == ROLE_SYBIL) continue;
            int w2 = 0;
            for (int k = 0; k < n->npeers; k++) {
                int p = n->peers[k];
                if (s->nodes[p].role != ROLE_SYBIL) n->peers[w2++] = p;
            }
            n->npeers = w2;
        }
        triggered = 1;
    }

    if (triggered) {
        s->mitigation_triggered = 1;
        log_event(s, "mitigation", -1, -1, -1, alert_type(w));
    }
}

void detector_eval(Sim *s, Window *w) {
    Detector *d = &s->det;
    if (d->mode == DET_NONE) {
        w->predicted = 0;
        w->score = 0.0;
        return;
    }

    double r = rule_score(w);
    double a = (d->mode == DET_ADAPTIVE || d->mode == DET_ENSEMBLE) ? adaptive_score(s, w) : 0.0;
    double m = (d->mode == DET_ML || d->mode == DET_ENSEMBLE) ? ml_score(d, w) : 0.0;

    double score;
    switch (d->mode) {
        case DET_RULE: score = r; break;
        case DET_ADAPTIVE: score = a; break;
        case DET_ML: score = m; break;
        case DET_ENSEMBLE: score = 0.25 * r + 0.65 * m + 0.10 * a; break;
        default: score = 0.0;
    }
    w->score = score;
    w->predicted = score >= d->threshold;
    w->detected = w->predicted;

    if (w->predicted) {
        d->n_alerts++;
        s->alerts_total++;
        if (d->first_alert < 0 || s->now < d->first_alert) {
            d->first_alert = s->now;
            d->first_alert_label = w->label;
        }
        if (w->label && s->detection_time < 0) {
            s->detection_time = s->now;
            s->detection_window = w->id;
            s->detection_label = w->label;
            s->detection_score = score;
        }
        if (s->falerts) {
            fprintf(s->falerts, "%d,%lld,%.6f,%d,%d,%s\n",
                    w->id, (long long)s->now, score, w->label,
                    alert_suspect(s, w), alert_type(w));
        }
        if (s->cfg.log_events) {
            char detail[128];
            snprintf(detail, sizeof detail, "window=%d score=%.3f type=%s",
                     w->id, score, alert_type(w));
            log_event(s, "alert", -1, -1, -1, detail);
        }
        apply_mitigation(s, w);
    }
}
