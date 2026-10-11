#ifndef SEARCHING_H
#define SEARCHING_H

#include <stdbool.h>

/* Return the index of an element equal to target, or -1 if there is none. */
int linear_search(const int *a, int n, int target);
/* Precondition: a[0..n-1] is sorted in non-decreasing order. */
int binary_search(const int *a, int n, int target);

bool is_sorted(const int *a, int n);

#endif
