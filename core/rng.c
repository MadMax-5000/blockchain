/* rng.c - xoshiro256** + splitmix64 pour l'initialisation */
#include "rng.h"
#include <math.h>

static uint64_t splitmix64(uint64_t *x) {
    uint64_t z = (*x += 0x9E3779B97F4A7C15ULL);
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
    z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
    return z ^ (z >> 31);
}

static uint64_t rotl(uint64_t x, int k) {
    return (x << k) | (x >> (64 - k));
}

void rng_seed(RNG *r, uint64_t seed) {
    uint64_t x = seed ? seed : 0x123456789ABCDEF0ULL;
    for (int i = 0; i < 4; i++) r->s[i] = splitmix64(&x);
}

uint64_t rng_u64(RNG *r) {
    uint64_t *s = r->s;
    uint64_t result = rotl(s[1] * 5, 7) * 9;
    uint64_t t = s[1] << 17;
    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];
    s[2] ^= t;
    s[3] = rotl(s[3], 45);
    return result;
}

double rng_double(RNG *r) {
    /* 53 bits de precision */
    return (double)(rng_u64(r) >> 11) * (1.0 / 9007199254740992.0);
}

int rng_int(RNG *r, int n) {
    if (n <= 0) return 0;
    return (int)(rng_u64(r) % (uint64_t)n);
}

double rng_exp(RNG *r, double mean) {
    double u = rng_double(r);
    if (u < 1e-12) u = 1e-12;
    return -mean * log(u);
}

double rng_normal(RNG *r) {
    /* Box-Muller, une seule valeur par appel (simple et deterministe) */
    double u1 = rng_double(r);
    double u2 = rng_double(r);
    if (u1 < 1e-12) u1 = 1e-12;
    return sqrt(-2.0 * log(u1)) * cos(6.283185307179586 * u2);
}
