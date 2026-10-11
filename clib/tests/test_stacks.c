#include "stacks/array_stack.h"
#include "stacks/linked_stack.h"
#include "unit.h"

static void test_array_stack_empty(void) {
    ArrayStack s;
    int out = -1;
    array_stack_init(&s);
    CHECK(array_stack_is_empty(&s));
    CHECK(!array_stack_pop(&s, &out));
    CHECK(!array_stack_peek(&s, &out));
    CHECK_EQ(out, -1);
}

static void test_array_stack_lifo_and_overflow(void) {
    ArrayStack s;
    int out = 0;
    array_stack_init(&s);
    for (int i = 0; i < ARRAY_STACK_CAPACITY; i++) {
        CHECK(array_stack_push(&s, i * 10));
    }
    CHECK(array_stack_is_full(&s));
    CHECK(!array_stack_push(&s, 999));
    CHECK(array_stack_peek(&s, &out));
    CHECK_EQ(out, (ARRAY_STACK_CAPACITY - 1) * 10);
    for (int i = ARRAY_STACK_CAPACITY - 1; i >= 0; i--) {
        CHECK(array_stack_pop(&s, &out));
        CHECK_EQ(out, i * 10);
    }
    CHECK(array_stack_is_empty(&s));
    CHECK(!array_stack_pop(&s, &out));
}

static void test_linked_stack_lifo(void) {
    LinkedStack s;
    int out = 0;
    linked_stack_init(&s);
    CHECK(!linked_stack_pop(&s, &out));
    CHECK(!linked_stack_peek(&s, &out));
    for (int i = 0; i < 100; i++) {
        CHECK(linked_stack_push(&s, i));
    }
    CHECK_EQ(s.size, 100);
    CHECK(linked_stack_peek(&s, &out));
    CHECK_EQ(out, 99);
    for (int i = 99; i >= 50; i--) {
        CHECK(linked_stack_pop(&s, &out));
        CHECK_EQ(out, i);
    }
    CHECK_EQ(s.size, 50);
    /* Remaining nodes are released by destroy; LeakSanitizer verifies it. */
    linked_stack_destroy(&s);
    CHECK(linked_stack_is_empty(&s));
    CHECK_EQ(s.size, 0);
}

static void test_linked_stack_allocation_failure(void) {
    LinkedStack s;
    int out = 0;
    linked_stack_init(&s);
    CHECK(linked_stack_push(&s, 1));
    unit_fail_nth_alloc(0);
    CHECK(!linked_stack_push(&s, 2));
    CHECK_EQ(s.size, 1);
    CHECK(linked_stack_peek(&s, &out));
    CHECK_EQ(out, 1);
    CHECK(linked_stack_push(&s, 3));
    CHECK_EQ(s.size, 2);
    linked_stack_destroy(&s);
}

int main(void) {
    puts("stacks");
    RUN(test_array_stack_empty);
    RUN(test_array_stack_lifo_and_overflow);
    RUN(test_linked_stack_lifo);
    RUN(test_linked_stack_allocation_failure);
    return unit_report();
}
