/*
 * Memory errors on purpose. Run with "Sanitizers" enabled to get an
 * AddressSanitizer report, or without them to see the raw behaviour.
 * Input selects the bug: 1 = heap overflow, 2 = use after free,
 * 3 = NULL dereference, 4 = memory leak.
 */
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int choice = 0;
    printf("Bug (1-4): ");
    if (scanf("%d", &choice) != 1) {
        return 1;
    }

    int *numbers = malloc(4 * sizeof *numbers);
    if (numbers == NULL) {
        return 1;
    }
    for (int i = 0; i < 4; i++) {
        numbers[i] = i;
    }

    switch (choice) {
    case 1:
        numbers[4] = 99; /* one past the end */
        printf("wrote numbers[4]\n");
        break;
    case 2:
        free(numbers);
        printf("after free: %d\n", numbers[0]);
        return 0;
    case 3: {
        int *p = NULL;
        printf("%d\n", *p);
        break;
    }
    case 4:
        numbers = NULL; /* the block is no longer reachable */
        printf("leaked 16 bytes\n");
        return 0;
    default:
        printf("no bug selected\n");
    }
    free(numbers);
    return 0;
}
