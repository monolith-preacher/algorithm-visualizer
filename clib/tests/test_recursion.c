#include "recursion/recursion.h"
#include "unit.h"

static void test_factorial(void) {
    unsigned long long expected = 1;
    CHECK_EQ(factorial(0), 1);
    for (int n = 1; n <= 20; n++) {
        expected *= (unsigned long long)n;
        CHECK(factorial(n) == expected);
    }
}

static void test_fibonacci(void) {
    long long a = 0, b = 1;
    for (int n = 0; n <= 25; n++) {
        CHECK_EQ(fibonacci(n), a);
        long long next = a + b;
        a = b;
        b = next;
    }
}

static void test_hanoi(void) {
    Towers t;
    for (int n = 1; n <= HANOI_MAX_DISKS; n++) {
        CHECK(towers_init(&t, n));
        hanoi(&t, n, 'A', 'C', 'B');
        CHECK_EQ(t.moves, (1 << n) - 1);
        CHECK(!t.illegal_move);
        CHECK_EQ(t.pegs[0].count, 0);
        CHECK_EQ(t.pegs[1].count, 0);
        CHECK_EQ(t.pegs[2].count, n);
        for (int i = 0; i < n; i++) {
            CHECK_EQ(t.pegs[2].disks[i], n - i);
        }
    }
    CHECK(!towers_init(&t, 0));
    CHECK(!towers_init(&t, HANOI_MAX_DISKS + 1));
}

int main(void) {
    puts("recursion");
    RUN(test_factorial);
    RUN(test_fibonacci);
    RUN(test_hanoi);
    return unit_report();
}
