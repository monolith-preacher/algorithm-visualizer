#ifndef SORTING_H
#define SORTING_H

/* All sorting functions sort a[0..n-1] in non-decreasing order, in place. */
void bubble_sort(int *a, int n);
void selection_sort(int *a, int n);
void insertion_sort(int *a, int n);
/* Returns 0 on success, -1 if the auxiliary buffer cannot be allocated. */
int merge_sort(int *a, int n);
void quick_sort(int *a, int n);
void heap_sort(int *a, int n);

static inline void swap_int(int *x, int *y) {
    int tmp = *x;
    *x = *y;
    *y = tmp;
}

#endif
