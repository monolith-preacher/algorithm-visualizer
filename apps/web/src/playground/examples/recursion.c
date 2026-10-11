#include <stdio.h>

unsigned long long factorial(int n) {
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);
}

int fibonacci(int n) {
    if (n < 2) {
        return n;
    }
    return fibonacci(n - 1) + fibonacci(n - 2);
}

/* Fast exponentiation: O(log n) multiplications. */
long power(long base, int exp) {
    if (exp == 0) {
        return 1;
    }
    long half = power(base, exp / 2);
    return exp % 2 == 0 ? half * half : half * half * base;
}

int main(void) {
    printf("10! = %llu\n", factorial(10));
    printf("fib(10) = %d\n", fibonacci(10));
    printf("3^13 = %ld\n", power(3, 13));
    return 0;
}
