/* rng.h - Generateur pseudo-aleatoire deterministe (xoshiro256**) */
#ifndef RNG_H
#define RNG_H

#include <stdint.h>

typedef struct { uint64_t s[4]; } RNG;

void   rng_seed(RNG *r, uint64_t seed);
uint64_t rng_u64(RNG *r);
double rng_double(RNG *r);              /* [0,1) */
int    rng_int(RNG *r, int n);          /* [0,n) */
double rng_exp(RNG *r, double mean);    /* loi exponentielle de moyenne "mean" */
double rng_normal(RNG *r);              /* loi normale centree reduite */

#endif
