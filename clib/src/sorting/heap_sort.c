#include "av_trace.h"
#include "sorting.h"

/* Restores the max-heap property of a[0..n-1] below index i. */
static void sift_down(int *a, int n, int i) {
    TRACE_ENTER(n, i);
    int largest = i, left = 0, right = 0;
    TRACE_WATCH(largest, left, right);

    for (;;) {
        largest = i;
        left = 2 * i + 1;
        right = 2 * i + 2;
        if (left < n) {
            TRACE_COMPARE(a, left, largest);
            if (a[left] > a[largest]) {
                largest = left;
            }
        }
        if (right < n) {
            TRACE_COMPARE(a, right, largest);
            if (a[right] > a[largest]) {
                largest = right;
            }
        }
        if (largest == i) {
            return;
        }
        TRACE_SWAP(a, i, largest);
        swap_int(&a[i], &a[largest]);
        i = largest;
    }
}

void heap_sort(int *a, int n) {
    TRACE_ENTER(n);
    int i = 0;
    TRACE_WATCH(i);

    TRACE_RANGE(0, n - 1);
    for (i = n / 2 - 1; i >= 0; i--) {
        sift_down(a, n, i);
    }
    for (i = n - 1; i > 0; i--) {
        TRACE_SWAP(a, 0, i);
        swap_int(&a[0], &a[i]);
        TRACE_MARK("sorted", i);
        TRACE_RANGE(0, i - 1);
        sift_down(a, i, 0);
    }
    TRACE_MARK_IF(n > 0, "sorted", 0);
}
