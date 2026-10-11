#include <stdio.h>

int main(void) {
    char name[32];
    int year = 0;

    printf("Name: ");
    if (scanf("%31s", name) != 1) {
        return 1;
    }
    printf("Birth year: ");
    if (scanf("%d", &year) != 1) {
        return 1;
    }

    int age = 2026 - year;
    printf("Hello, %s! You turn %d this year.\n", name, age);

    for (int i = 1; i <= 3; i++) {
        printf("%d x %d = %d\n", i, age, i * age);
    }
    return 0;
}
