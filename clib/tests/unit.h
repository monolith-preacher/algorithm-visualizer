/*
 * Minimal unit-test support for the C library. Tests are built with
 * AddressSanitizer + UndefinedBehaviorSanitizer (LeakSanitizer included) and
 * linked with -Wl,--wrap=malloc so allocation failures can be injected.
 */
#ifndef UNIT_H
#define UNIT_H

#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int unit_failures = 0;
static int unit_checks = 0;

#define CHECK(cond)                                                                                \
    do {                                                                                           \
        unit_checks++;                                                                             \
        if (!(cond)) {                                                                             \
            unit_failures++;                                                                       \
            fprintf(stderr, "%s:%d: CHECK failed: %s\n", __FILE__, __LINE__, #cond);               \
        }                                                                                          \
    } while (0)

#define CHECK_EQ(actual, expected)                                                                 \
    do {                                                                                           \
        long long a_ = (long long)(actual), e_ = (long long)(expected);                            \
        unit_checks++;                                                                             \
        if (a_ != e_) {                                                                            \
            unit_failures++;                                                                       \
            fprintf(stderr, "%s:%d: %s == %lld, expected %lld\n", __FILE__, __LINE__, #actual, a_, \
                    e_);                                                                           \
        }                                                                                          \
    } while (0)

#define RUN(test)                                                                                  \
    do {                                                                                           \
        int before_ = unit_failures;                                                               \
        test();                                                                                    \
        printf("  %s %s\n", unit_failures == before_ ? "ok  " : "FAIL", #test);                    \
    } while (0)

static inline int unit_report(void) {
    printf("%d checks, %d failures\n", unit_checks, unit_failures);
    return unit_failures == 0 ? 0 : 1;
}

/* Allocation failure injection: the n-th malloc from now on returns NULL. */
static long unit_alloc_countdown = -1;

void *__real_malloc(size_t size);
void *__wrap_malloc(size_t size);
void *__wrap_malloc(size_t size) {
    if (unit_alloc_countdown >= 0 && unit_alloc_countdown-- == 0) {
        return NULL;
    }
    return __real_malloc(size);
}

static inline void unit_fail_nth_alloc(long n) { unit_alloc_countdown = n; }

/* Deterministic xorshift PRNG so failures are reproducible. */
static unsigned long long unit_rng_state = 0x9E3779B97F4A7C15ULL;

static inline int unit_rand(int lo, int hi) {
    unit_rng_state ^= unit_rng_state << 13;
    unit_rng_state ^= unit_rng_state >> 7;
    unit_rng_state ^= unit_rng_state << 17;
    return lo + (int)(unit_rng_state % (unsigned long long)(hi - lo + 1));
}

#endif
