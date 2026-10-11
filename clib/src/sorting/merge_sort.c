#include <stdlib.h>

#include "av_trace.h"
#include "sorting.h"

static void merge(int *a, int *aux, int lo, int mid, int hi) {
    TRACE_ENTER(lo, mid, hi);
    int i = lo, j = mid + 1, k = lo;
    TRACE_WATCH(i, j, k);

    for (k = lo; k <= hi; k++) {
        TRACE_COPY(aux, k, a, k);
        aux[k] = a[k];
    }
    for (k = lo; k <= hi; k++) {
        if (i > mid) {
            TRACE_COPY(a, k, aux, j);
            a[k] = aux[j++];
        } else if (j > hi) {
            TRACE_COPY(a, k, aux, i);
            a[k] = aux[i++];
        } else {
            TRACE_COMPARE(aux, j, i);
            if (aux[j] < aux[i]) {
                TRACE_COPY(a, k, aux, j);
                a[k] = aux[j++];
            } else {
                TRACE_COPY(a, k, aux, i);
                a[k] = aux[i++];
            }
        }
    }
}

static void merge_sort_range(int *a, int *aux, int lo, int hi) {
    TRACE_ENTER(lo, hi);
    TRACE_RANGE(lo, hi);
    if (lo >= hi) {
        return;
    }
    int mid = lo + (hi - lo) / 2;
    TRACE_WATCH(mid);
    merge_sort_range(a, aux, lo, mid);
    merge_sort_range(a, aux, mid + 1, hi);
    merge(a, aux, lo, mid, hi);
}

int merge_sort(int *a, int n) {
    TRACE_ENTER(n);
    if (n < 2) {
        return 0;
    }
    int *aux = malloc((size_t)n * sizeof *aux);
    if (aux == NULL) {
        return -1;
    }
    TRACE_ARRAY_UNINIT(aux, n);
    merge_sort_range(a, aux, 0, n - 1);
    free(aux);
    return 0;
}
