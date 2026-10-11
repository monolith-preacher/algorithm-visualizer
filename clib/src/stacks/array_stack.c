#include "array_stack.h"
#include "av_trace.h"

void array_stack_init(ArrayStack *s) {
    s->top = -1;
}

bool array_stack_is_empty(const ArrayStack *s) {
    return s->top == -1;
}

bool array_stack_is_full(const ArrayStack *s) {
    return s->top == ARRAY_STACK_CAPACITY - 1;
}

bool array_stack_push(ArrayStack *s, int value) {
    TRACE_ENTER(s, value);
    TRACE_STEP();
    if (array_stack_is_full(s)) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    s->top++;
    TRACE_STEP();
    s->items[s->top] = value;
    TRACE_RETURN(true);
    return true;
}

bool array_stack_pop(ArrayStack *s, int *out) {
    TRACE_ENTER(s, out);
    TRACE_STEP();
    if (array_stack_is_empty(s)) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    *out = s->items[s->top];
    TRACE_STEP();
    s->top--;
    TRACE_RETURN(true);
    return true;
}

bool array_stack_peek(const ArrayStack *s, int *out) {
    TRACE_ENTER(s, out);
    TRACE_STEP();
    if (array_stack_is_empty(s)) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    *out = s->items[s->top];
    TRACE_RETURN(true);
    return true;
}
