#include <stdio.h>
#include <stdlib.h>

typedef struct {
    int *data;
    size_t size;
    size_t capacity;
} Vector;

int vector_push(Vector *v, int value) {
    if (v->size == v->capacity) {
        size_t capacity = v->capacity == 0 ? 2 : v->capacity * 2;
        int *data = realloc(v->data, capacity * sizeof *data);
        if (data == NULL) {
            return -1;
        }
        v->data = data;
        v->capacity = capacity;
    }
    v->data[v->size++] = value;
    return 0;
}

int main(void) {
    Vector v = {NULL, 0, 0};
    for (int i = 0; i < 10; i++) {
        if (vector_push(&v, i * i) != 0) {
            fprintf(stderr, "out of memory\n");
            free(v.data);
            return 1;
        }
        printf("size=%zu capacity=%zu\n", v.size, v.capacity);
    }
    free(v.data);
    return 0;
}
