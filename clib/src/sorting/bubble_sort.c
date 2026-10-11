#include <stdbool.h>

#include "av_trace.h"
#include "sorting.h"

void bubble_sort(int *a, int n) {
    TRACE_ENTER(n);
    int pass = 0, j = 0;
    bool swapped = false;
    TRACE_WATCH(pass, j, swapped);

    for (pass = 0; pass < n - 1; pass++) {
        swapped = false;
        for (j = 0; j < n - 1 - pass; j++) {
            TRACE_COMPARE(a, j, j + 1);
            if (a[j] > a[j + 1]) {
                TRACE_SWAP(a, j, j + 1);
                swap_int(&a[j], &a[j + 1]);
                swapped = true;
            }
        }
        TRACE_MARK("sorted", n - 1 - pass);
        if (!swapped) {
            break;
        }
    }
}
