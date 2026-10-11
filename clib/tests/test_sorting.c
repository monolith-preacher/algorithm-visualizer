#include "sorting/sorting.h"
#include "unit.h"

typedef void (*SortFn)(int *a, int n);

static void merge_sort_void(int *a, int n) { CHECK_EQ(merge_sort(a, n), 0); }

static const struct {
    const char *name;
    SortFn fn;
} sorts[] = {
    {"bubble", bubble_sort}, {"selection", selection_sort}, {"insertion", insertion_sort},
    {"merge", merge_sort_void}, {"quick", quick_sort},      {"heap", heap_sort},
};
#define NSORTS (sizeof sorts / sizeof sorts[0])

static int cmp_int(const void *x, const void *y) {
    int a = *(const int *)x, b = *(const int *)y;
    return (a > b) - (a < b);
}

/* Sorts a copy with every algorithm and compares against qsort. */
static void check_all(const int *input, int n) {
    int expected[256], actual[256];
    memcpy(expected, input, (size_t)n * sizeof(int));
    qsort(expected, (size_t)n, sizeof(int), cmp_int);
    for (size_t s = 0; s < NSORTS; s++) {
        memcpy(actual, input, (size_t)n * sizeof(int));
        sorts[s].fn(actual, n);
        bool same = memcmp(actual, expected, (size_t)n * sizeof(int)) == 0;
        if (!same) {
            fprintf(stderr, "  %s sort failed for n=%d\n", sorts[s].name, n);
        }
        CHECK(same);
    }
}

static void test_empty_and_single(void) {
    int empty[1] = {0};
    int one[] = {42};
    check_all(empty, 0);
    check_all(one, 1);
}

static void test_small_cases(void) {
    int two_sorted[] = {1, 2};
    int two_reversed[] = {2, 1};
    int equal[] = {7, 7, 7, 7, 7};
    int duplicates[] = {3, 1, 3, 2, 1, 3, 2};
    int negatives[] = {-5, 3, -1, 0, -5, 8, -100};
    check_all(two_sorted, 2);
    check_all(two_reversed, 2);
    check_all(equal, 5);
    check_all(duplicates, 7);
    check_all(negatives, 7);
}

static void test_sorted_and_reversed(void) {
    int asc[100], desc[100];
    for (int i = 0; i < 100; i++) {
        asc[i] = i;
        desc[i] = 100 - i;
    }
    check_all(asc, 100);
    check_all(desc, 100);
}

static void test_random(void) {
    int a[256];
    for (int round = 0; round < 300; round++) {
        int n = unit_rand(0, 256);
        int range = unit_rand(1, 1000);
        for (int i = 0; i < n; i++) {
            a[i] = unit_rand(-range, range);
        }
        check_all(a, n);
    }
}

static void test_merge_sort_allocation_failure(void) {
    int a[] = {3, 2, 1};
    unit_fail_nth_alloc(0);
    CHECK_EQ(merge_sort(a, 3), -1);
    CHECK_EQ(a[0], 3);
    CHECK_EQ(a[2], 1);
}

int main(void) {
    puts("sorting");
    RUN(test_empty_and_single);
    RUN(test_small_cases);
    RUN(test_sorted_and_reversed);
    RUN(test_random);
    RUN(test_merge_sort_allocation_failure);
    return unit_report();
}
