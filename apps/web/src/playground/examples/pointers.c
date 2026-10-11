#include <stdio.h>

void swap(int *a, int *b) {
    int tmp = *a;
    *a = *b;
    *b = tmp;
}

int sum(const int *values, int n) {
    int total = 0;
    for (const int *p = values; p < values + n; p++) {
        total += *p;
    }
    return total;
}

int main(void) {
    int x = 3, y = 8;
    int *px = &x;
    int **ppx = &px;

    swap(&x, &y);
    printf("x = %d, y = %d\n", x, y);

    **ppx = 42;
    printf("x through ppx = %d\n", x);

    int numbers[5] = {4, 8, 15, 16, 23};
    int *middle = &numbers[2];
    printf("middle[-1] = %d, middle[1] = %d\n", middle[-1], middle[1]);
    printf("sum = %d\n", sum(numbers, 5));
    printf("distance = %td elements\n", middle - numbers);
    return 0;
}
