#ifndef LINKED_STACK_H
#define LINKED_STACK_H

#include <stdbool.h>
#include <stddef.h>

typedef struct StackNode {
    int value;
    struct StackNode *next;
} StackNode;

/* Unbounded stack of heap-allocated nodes; top is NULL when empty. */
typedef struct {
    StackNode *top;
    size_t size;
} LinkedStack;

void linked_stack_init(LinkedStack *s);
bool linked_stack_is_empty(const LinkedStack *s);
/* Returns false if the node cannot be allocated; the stack is unchanged. */
bool linked_stack_push(LinkedStack *s, int value);
bool linked_stack_pop(LinkedStack *s, int *out);
bool linked_stack_peek(const LinkedStack *s, int *out);
void linked_stack_destroy(LinkedStack *s);

#endif
