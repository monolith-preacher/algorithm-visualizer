#include <stdlib.h>

#include "av_trace.h"
#include "linked_stack.h"

void linked_stack_init(LinkedStack *s) {
    s->top = NULL;
    s->size = 0;
}

bool linked_stack_is_empty(const LinkedStack *s) {
    return s->top == NULL;
}

bool linked_stack_push(LinkedStack *s, int value) {
    TRACE_ENTER(s, value);
    StackNode *node = malloc(sizeof *node);
    TRACE_WATCH(node);
    TRACE_STEP();
    if (node == NULL) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    node->value = value;
    TRACE_STEP();
    node->next = s->top;
    TRACE_STEP();
    s->top = node;
    TRACE_STEP();
    s->size++;
    TRACE_RETURN(true);
    return true;
}

bool linked_stack_pop(LinkedStack *s, int *out) {
    TRACE_ENTER(s, out);
    StackNode *node = s->top;
    TRACE_WATCH(node);
    TRACE_STEP();
    if (node == NULL) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    *out = node->value;
    TRACE_STEP();
    s->top = node->next;
    TRACE_STEP();
    s->size--;
    free(node);
    TRACE_RETURN(true);
    return true;
}

bool linked_stack_peek(const LinkedStack *s, int *out) {
    TRACE_ENTER(s, out);
    TRACE_STEP();
    if (s->top == NULL) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    *out = s->top->value;
    TRACE_RETURN(true);
    return true;
}

void linked_stack_destroy(LinkedStack *s) {
    StackNode *node = s->top;
    while (node != NULL) {
        StackNode *next = node->next;
        free(node);
        node = next;
    }
    s->top = NULL;
    s->size = 0;
}
