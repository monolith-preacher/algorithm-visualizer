#ifndef ARRAY_STACK_H
#define ARRAY_STACK_H

#include <stdbool.h>

#define ARRAY_STACK_CAPACITY 8

/* Fixed-capacity stack stored in an array. top is -1 when the stack is empty. */
typedef struct {
    int items[ARRAY_STACK_CAPACITY];
    int top;
} ArrayStack;

void array_stack_init(ArrayStack *s);
bool array_stack_is_empty(const ArrayStack *s);
bool array_stack_is_full(const ArrayStack *s);
bool array_stack_push(ArrayStack *s, int value);
bool array_stack_pop(ArrayStack *s, int *out);
bool array_stack_peek(const ArrayStack *s, int *out);

#endif
