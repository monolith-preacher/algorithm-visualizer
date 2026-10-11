/*
 * avrt - small runtime support object linked into user programs.
 *
 * 1. Makes stdout unbuffered so output (including prompts without a trailing
 *    newline) reaches the browser terminal immediately, as it would on a TTY.
 *
 * 2. When built with AV_ALLOC_TRACKING (debug sessions only), provides
 *    __wrap_malloc/__wrap_calloc/__wrap_realloc/__wrap_free. Programs are then
 *    linked with -Wl,--wrap=malloc,... so that only allocations made by the
 *    user's own code are recorded in av_heap_table. The debugger reads that
 *    table with raw memory reads at every stop. This object is compiled
 *    without -g so that "Step Into" never enters these wrappers.
 *
 * Table layout (consumed by apps/server/src/debugger/heap.ts):
 *     uint64_t av_heap_count;            number of used records
 *     uint64_t av_heap_overflow;         1 if records were dropped
 *     struct { uint64_t addr, size, state; } av_heap_table[AV_HEAP_MAX];
 * state: 1 = live, 2 = freed.
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

__attribute__((constructor)) static void av_runtime_init(void) {
    setvbuf(stdout, NULL, _IONBF, 0);
}

#ifdef AV_ALLOC_TRACKING

#define AV_HEAP_MAX 1024

typedef struct {
    uint64_t addr;
    uint64_t size;
    uint64_t state;
} AvHeapRecord;

uint64_t av_heap_count = 0;
uint64_t av_heap_overflow = 0;
AvHeapRecord av_heap_table[AV_HEAP_MAX];

void *__real_malloc(size_t size);
void *__real_calloc(size_t n, size_t size);
void *__real_realloc(void *ptr, size_t size);
void __real_free(void *ptr);

static void av_record_alloc(void *ptr, size_t size) {
    if (ptr == NULL) {
        return;
    }
    /* Reuse the record of a freed block at the same address, if any. */
    for (uint64_t i = 0; i < av_heap_count; i++) {
        if (av_heap_table[i].addr == (uint64_t)(uintptr_t)ptr) {
            av_heap_table[i].size = size;
            av_heap_table[i].state = 1;
            return;
        }
    }
    if (av_heap_count >= AV_HEAP_MAX) {
        av_heap_overflow = 1;
        return;
    }
    av_heap_table[av_heap_count].addr = (uint64_t)(uintptr_t)ptr;
    av_heap_table[av_heap_count].size = size;
    av_heap_table[av_heap_count].state = 1;
    av_heap_count++;
}

static void av_record_free(void *ptr) {
    for (uint64_t i = 0; i < av_heap_count; i++) {
        if (av_heap_table[i].addr == (uint64_t)(uintptr_t)ptr && av_heap_table[i].state == 1) {
            av_heap_table[i].state = 2;
            return;
        }
    }
}

void *__wrap_malloc(size_t size) {
    void *p = __real_malloc(size);
    av_record_alloc(p, size);
    return p;
}

void *__wrap_calloc(size_t n, size_t size) {
    void *p = __real_calloc(n, size);
    av_record_alloc(p, n * size);
    return p;
}

void *__wrap_realloc(void *ptr, size_t size) {
    void *p = __real_realloc(ptr, size);
    if (p != NULL || size == 0) {
        if (ptr != NULL) {
            av_record_free(ptr);
        }
        av_record_alloc(p, size);
    }
    return p;
}

void __wrap_free(void *ptr) {
    if (ptr != NULL) {
        av_record_free(ptr);
    }
    __real_free(ptr);
}

#endif
