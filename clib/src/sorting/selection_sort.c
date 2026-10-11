#include "av_trace.h"
#include "sorting.h"

void selection_sort(int *a, int n) {
    TRACE_ENTER(n);
    int i = 0, j = 0, min = 0;
    TRACE_WATCH(i, j, min);

    for (i = 0; i < n - 1; i++) {
        min = i;
        TRACE_MARK("min", min);
        for (j = i + 1; j < n; j++) {
            TRACE_COMPARE(a, j, min);
            if (a[j] < a[min]) {
                min = j;
                TRACE_MARK("min", min);
            }
        }
        if (min != i) {
            TRACE_SWAP(a, i, min);
            swap_int(&a[i], &a[min]);
        }
        TRACE_MARK("sorted", i);
    }
}
