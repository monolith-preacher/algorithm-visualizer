#include "av_trace.h"
#include "sorting.h"

/* Lomuto partition scheme: the last element of the range is the pivot. */
static int partition(int *a, int lo, int hi) {
    TRACE_ENTER(lo, hi);
    int pivot = a[hi];
    int i = lo - 1, j = lo;
    TRACE_WATCH(pivot, i, j);
    TRACE_MARK("pivot", hi);

    for (j = lo; j < hi; j++) {
        TRACE_COMPARE(a, j, hi);
        if (a[j] <= pivot) {
            i++;
            TRACE_SWAP(a, i, j);
            swap_int(&a[i], &a[j]);
        }
    }
    TRACE_SWAP(a, i + 1, hi);
    swap_int(&a[i + 1], &a[hi]);
    TRACE_MARK("sorted", i + 1);
    TRACE_RETURN(i + 1);
    return i + 1;
}

static void quick_sort_range(int *a, int lo, int hi) {
    TRACE_ENTER(lo, hi);
    TRACE_RANGE(lo, hi);
    if (lo >= hi) {
        TRACE_MARK_IF(lo == hi, "sorted", lo);
        return;
    }
    int p = partition(a, lo, hi);
    TRACE_WATCH(p);
    quick_sort_range(a, lo, p - 1);
    quick_sort_range(a, p + 1, hi);
}

void quick_sort(int *a, int n) {
    TRACE_ENTER(n);
    quick_sort_range(a, 0, n - 1);
}
