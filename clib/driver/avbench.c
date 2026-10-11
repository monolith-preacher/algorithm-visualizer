/*
 * avbench - measures the processing time of a sorting or searching algorithm
 * built WITHOUT instrumentation (-O2, TRACE_* compiled out).
 *
 *   avbench <algorithm-id>     (input on stdin, same format as avlab)
 *
 * Runs are grouped in batches long enough (>= MIN_BATCH_NS) for the clock
 * resolution to be irrelevant; batches are repeated until MIN_TOTAL_NS have
 * elapsed. Sorting runs include restoring the input with memcpy (O(n), small
 * next to the sort itself). The output is a single JSON object with per-run
 * statistics in nanoseconds.
 */
#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "../src/searching/searching.h"
#include "../src/sorting/sorting.h"

#define MAX_ARRAY 256
#define MIN_SAMPLES 5
#define MAX_SAMPLES 4000
#define MAX_BATCH (1 << 20)
#define MIN_BATCH_NS 20000.0
#define MIN_TOTAL_NS 30000000.0

static double now_ns(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (double)ts.tv_sec * 1e9 + (double)ts.tv_nsec;
}

static int compare_doubles(const void *x, const void *y) {
    double a = *(const double *)x, b = *(const double *)y;
    return (a > b) - (a < b);
}

/* Keeps the optimizer from discarding search results. */
static volatile int sink;

typedef void (*Runner)(int *work, const int *input, int n, int target);

#define SORT_RUNNER(name, call)                                                                    \
    static void name(int *work, const int *input, int n, int target) {                            \
        (void)target;                                                                              \
        memcpy(work, input, (size_t)n * sizeof *work);                                             \
        call;                                                                                      \
    }

SORT_RUNNER(run_bubble, bubble_sort(work, n))
SORT_RUNNER(run_selection, selection_sort(work, n))
SORT_RUNNER(run_insertion, insertion_sort(work, n))
SORT_RUNNER(run_merge, sink = merge_sort(work, n))
SORT_RUNNER(run_quick, quick_sort(work, n))
SORT_RUNNER(run_heap, heap_sort(work, n))

static void run_linear(int *work, const int *input, int n, int target) {
    (void)work;
    sink = linear_search(input, n, target);
}

static void run_binary(int *work, const int *input, int n, int target) {
    (void)work;
    sink = binary_search(input, n, target);
}

static const struct {
    const char *id;
    Runner run;
} runners[] = {
    {"bubble-sort", run_bubble}, {"selection-sort", run_selection}, {"insertion-sort", run_insertion},
    {"merge-sort", run_merge},   {"quick-sort", run_quick},         {"heap-sort", run_heap},
    {"linear-search", run_linear}, {"binary-search", run_binary},
};

int main(int argc, char **argv) {
    static int input[MAX_ARRAY], work[MAX_ARRAY];
    static double samples[MAX_SAMPLES];
    Runner run = NULL;
    if (argc >= 2) {
        for (size_t i = 0; i < sizeof runners / sizeof runners[0]; i++) {
            if (strcmp(runners[i].id, argv[1]) == 0) {
                run = runners[i].run;
            }
        }
    }
    if (run == NULL) {
        printf("{\"error\":\"unknown_algorithm\"}\n");
        return 2;
    }
    const char *id = argv[1];
    bool searching = strstr(id, "search") != NULL;

    int n = 0, target = 0;
    if (scanf("%d", &n) != 1 || n < 0 || n > MAX_ARRAY) {
        printf("{\"error\":\"invalid_input\"}\n");
        return 2;
    }
    for (int i = 0; i < n; i++) {
        if (scanf("%d", &input[i]) != 1) {
            printf("{\"error\":\"invalid_input\"}\n");
            return 2;
        }
    }
    if (searching && scanf("%d", &target) != 1) {
        printf("{\"error\":\"invalid_input\"}\n");
        return 2;
    }
    if (strcmp(id, "binary-search") == 0 && !is_sorted(input, n)) {
        printf("{\"error\":\"precondition\"}\n");
        return 2;
    }

    int batch = 1;
    for (;;) {
        double start = now_ns();
        for (int r = 0; r < batch; r++) {
            run(work, input, n, target);
        }
        if (now_ns() - start >= MIN_BATCH_NS || batch >= MAX_BATCH) {
            break;
        }
        batch *= 2;
    }

    int nsamples = 0;
    long runs = 0;
    double total = 0.0;
    while (nsamples < MAX_SAMPLES && (nsamples < MIN_SAMPLES || total < MIN_TOTAL_NS)) {
        double start = now_ns();
        for (int r = 0; r < batch; r++) {
            run(work, input, n, target);
        }
        double elapsed = now_ns() - start;
        samples[nsamples++] = elapsed / batch;
        total += elapsed;
        runs += batch;
    }
    qsort(samples, (size_t)nsamples, sizeof samples[0], compare_doubles);
    printf("{\"runs\":%ld,\"batch\":%d,\"medianNs\":%.2f,\"minNs\":%.2f,\"meanNs\":%.2f,\"n\":%d}\n",
           runs, batch, samples[nsamples / 2], samples[0], total / (double)runs, n);
    return 0;
}
