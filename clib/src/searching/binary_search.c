#include "av_trace.h"
#include "searching.h"

int binary_search(const int *a, int n, int target) {
    TRACE_ENTER(n, target);
    int lo = 0, hi = n - 1, mid = 0;
    TRACE_WATCH(lo, hi, mid);

    while (lo <= hi) {
        TRACE_RANGE(lo, hi);
        mid = lo + (hi - lo) / 2;
        TRACE_COMPARE_VALUE(a, mid, target);
        if (a[mid] == target) {
            TRACE_RETURN(mid);
            return mid;
        }
        TRACE_COMPARE_VALUE(a, mid, target);
        if (a[mid] < target) {
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    TRACE_RANGE(lo, hi);
    TRACE_RETURN(-1);
    return -1;
}

bool is_sorted(const int *a, int n) {
    for (int i = 1; i < n; i++) {
        if (a[i - 1] > a[i]) {
            return false;
        }
    }
    return true;
}
