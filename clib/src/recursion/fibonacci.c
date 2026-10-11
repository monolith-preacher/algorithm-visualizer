#include "av_trace.h"
#include "recursion.h"

/* Naive tree recursion: F(n) = F(n - 1) + F(n - 2), F(0) = 0, F(1) = 1. */
long long fibonacci(int n) {
    TRACE_ENTER(n);
    if (n < 2) {
        TRACE_RETURN((long long)n);
        return n;
    }
    long long left = fibonacci(n - 1);
    TRACE_WATCH(left);
    long long right = fibonacci(n - 2);
    TRACE_WATCH(right);
    TRACE_RETURN(left + right);
    return left + right;
}
