#include "searching/searching.h"
#include "unit.h"

static void test_linear(void) {
    int a[] = {4, 8, 15, 16, 23, 42, 15};
    CHECK_EQ(linear_search(a, 7, 4), 0);
    CHECK_EQ(linear_search(a, 7, 15), 2);
    CHECK_EQ(linear_search(a, 7, 42), 5);
    CHECK_EQ(linear_search(a, 7, 99), -1);
    CHECK_EQ(linear_search(NULL, 0, 1), -1);
}

static void test_binary_basic(void) {
    int a[] = {1, 3, 5, 7, 9, 11};
    for (int i = 0; i < 6; i++) {
        CHECK_EQ(binary_search(a, 6, a[i]), i);
    }
    CHECK_EQ(binary_search(a, 6, 0), -1);
    CHECK_EQ(binary_search(a, 6, 12), -1);
    CHECK_EQ(binary_search(a, 6, 6), -1);
    CHECK_EQ(binary_search(NULL, 0, 6), -1);
    int one[] = {5};
    CHECK_EQ(binary_search(one, 1, 5), 0);
    CHECK_EQ(binary_search(one, 1, 4), -1);
}

static void test_binary_duplicates_and_random(void) {
    int a[200];
    for (int round = 0; round < 500; round++) {
        int n = unit_rand(0, 200);
        int v = unit_rand(-50, 0);
        for (int i = 0; i < n; i++) {
            v += unit_rand(0, 3);
            a[i] = v;
        }
        CHECK(is_sorted(a, n));
        int target = unit_rand(-60, v + 5);
        int index = binary_search(a, n, target);
        int expected = linear_search(a, n, target);
        if (expected < 0) {
            CHECK_EQ(index, -1);
        } else {
            CHECK(index >= 0 && index < n && a[index] == target);
        }
    }
}

static void test_is_sorted(void) {
    int sorted[] = {1, 1, 2, 3};
    int unsorted[] = {1, 3, 2};
    CHECK(is_sorted(sorted, 4));
    CHECK(!is_sorted(unsorted, 3));
    CHECK(is_sorted(NULL, 0));
}

int main(void) {
    puts("searching");
    RUN(test_linear);
    RUN(test_binary_basic);
    RUN(test_binary_duplicates_and_random);
    RUN(test_is_sorted);
    return unit_report();
}
