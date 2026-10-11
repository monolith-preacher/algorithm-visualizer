#include "av_trace.h"
#include "searching.h"

int linear_search(const int *a, int n, int target) {
    TRACE_ENTER(n, target);
    int i = 0;
    TRACE_WATCH(i);

    for (i = 0; i < n; i++) {
        TRACE_COMPARE_VALUE(a, i, target);
        if (a[i] == target) {
            TRACE_RETURN(i);
            return i;
        }
    }
    TRACE_RETURN(-1);
    return -1;
}
