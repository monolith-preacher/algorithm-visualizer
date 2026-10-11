#include "av_trace.h"
#include "sorting.h"

void insertion_sort(int *a, int n) {
    TRACE_ENTER(n);
    int i = 0, j = 0, key = 0;
    TRACE_WATCH(i, j, key);

    for (i = 1; i < n; i++) {
        key = a[i];
        TRACE_MARK("key", i);
        TRACE_RANGE(0, i);
        j = i - 1;
        while (j >= 0) {
            TRACE_COMPARE_VALUE(a, j, key);
            if (a[j] <= key) {
                break;
            }
            TRACE_COPY(a, j + 1, a, j);
            a[j + 1] = a[j];
            j--;
        }
        TRACE_WRITE(a, j + 1, key);
        a[j + 1] = key;
    }
}
