#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    char name[16];
    int score;
} Student;

static int by_score_desc(const void *a, const void *b) {
    const Student *x = a;
    const Student *y = b;
    return (y->score > x->score) - (y->score < x->score);
}

int main(void) {
    Student class[4] = {
        {"Ada", 91}, {"Linus", 78}, {"Grace", 95}, {"Dennis", 88},
    };
    size_t n = sizeof class / sizeof class[0];

    qsort(class, n, sizeof class[0], by_score_desc);

    Student *best = &class[0];
    printf("best: %s (%d)\n", best->name, best->score);
    for (size_t i = 0; i < n; i++) {
        printf("%zu. %-8s %d\n", i + 1, class[i].name, class[i].score);
    }

    Student copy = class[1];
    strcpy(copy.name, "Copy");
    printf("original: %s, copy: %s\n", class[1].name, copy.name);
    return 0;
}
