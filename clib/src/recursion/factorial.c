#include "av_trace.h"
#include "recursion.h"

unsigned long long factorial(int n) {
    TRACE_ENTER(n);
    if (n <= 1) {
        TRACE_RETURN(1ULL);
        return 1;
    }
    unsigned long long result = n * factorial(n - 1);
    TRACE_RETURN(result);
    return result;
}
