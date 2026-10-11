#include "queues/array_queue.h"
#include "queues/circular_queue.h"
#include "queues/linked_queue.h"
#include "unit.h"

static void test_array_queue_fifo(void) {
    ArrayQueue q;
    int out = 0;
    array_queue_init(&q);
    CHECK(array_queue_is_empty(&q));
    CHECK(!array_queue_dequeue(&q, &out));
    CHECK(!array_queue_front(&q, &out));
    for (int i = 0; i < ARRAY_QUEUE_CAPACITY; i++) {
        CHECK(array_queue_enqueue(&q, i));
    }
    CHECK(array_queue_is_full(&q));
    CHECK(!array_queue_enqueue(&q, 99));
    CHECK(array_queue_front(&q, &out));
    CHECK_EQ(out, 0);
    for (int i = 0; i < ARRAY_QUEUE_CAPACITY; i++) {
        CHECK(array_queue_dequeue(&q, &out));
        CHECK_EQ(out, i);
    }
    CHECK(array_queue_is_empty(&q));
}

static void test_array_queue_does_not_reuse_slots(void) {
    ArrayQueue q;
    int out = 0;
    array_queue_init(&q);
    for (int i = 0; i < ARRAY_QUEUE_CAPACITY; i++) {
        CHECK(array_queue_enqueue(&q, i));
    }
    CHECK(array_queue_dequeue(&q, &out));
    /* A slot is free at the front, but a linear queue cannot reach it. */
    CHECK(!array_queue_enqueue(&q, 42));
}

static void test_circular_queue_wraps(void) {
    CircularQueue q;
    int out = 0;
    circular_queue_init(&q);
    CHECK(!circular_queue_dequeue(&q, &out));
    for (int i = 0; i < CIRCULAR_QUEUE_CAPACITY; i++) {
        CHECK(circular_queue_enqueue(&q, i));
    }
    CHECK(circular_queue_is_full(&q));
    CHECK(!circular_queue_enqueue(&q, 99));
    for (int i = 0; i < 3; i++) {
        CHECK(circular_queue_dequeue(&q, &out));
        CHECK_EQ(out, i);
    }
    for (int i = 0; i < 3; i++) {
        CHECK(circular_queue_enqueue(&q, 100 + i));
    }
    CHECK_EQ(q.rear, 3);
    CHECK(circular_queue_is_full(&q));
    for (int i = 3; i < CIRCULAR_QUEUE_CAPACITY; i++) {
        CHECK(circular_queue_dequeue(&q, &out));
        CHECK_EQ(out, i);
    }
    for (int i = 0; i < 3; i++) {
        CHECK(circular_queue_front(&q, &out));
        CHECK_EQ(out, 100 + i);
        CHECK(circular_queue_dequeue(&q, &out));
    }
    CHECK(circular_queue_is_empty(&q));
}

static void test_circular_queue_long_run(void) {
    CircularQueue q;
    int out = 0, next_in = 0, next_out = 0;
    circular_queue_init(&q);
    for (int step = 0; step < 10000; step++) {
        if (unit_rand(0, 1) && !circular_queue_is_full(&q)) {
            CHECK(circular_queue_enqueue(&q, next_in++));
        } else if (!circular_queue_is_empty(&q)) {
            CHECK(circular_queue_dequeue(&q, &out));
            CHECK_EQ(out, next_out++);
        }
        CHECK_EQ(q.count, next_in - next_out);
    }
}

static void test_linked_queue(void) {
    LinkedQueue q;
    int out = 0;
    linked_queue_init(&q);
    CHECK(!linked_queue_dequeue(&q, &out));
    CHECK(!linked_queue_front(&q, &out));
    for (int i = 0; i < 50; i++) {
        CHECK(linked_queue_enqueue(&q, i));
    }
    for (int i = 0; i < 50; i++) {
        CHECK(linked_queue_dequeue(&q, &out));
        CHECK_EQ(out, i);
    }
    CHECK(q.front == NULL && q.rear == NULL);
    CHECK(linked_queue_enqueue(&q, 7));
    CHECK(q.front == q.rear);
    unit_fail_nth_alloc(0);
    CHECK(!linked_queue_enqueue(&q, 8));
    CHECK_EQ(q.size, 1);
    CHECK(linked_queue_enqueue(&q, 9));
    linked_queue_destroy(&q);
    CHECK(linked_queue_is_empty(&q));
}

int main(void) {
    puts("queues");
    RUN(test_array_queue_fifo);
    RUN(test_array_queue_does_not_reuse_slots);
    RUN(test_circular_queue_wraps);
    RUN(test_circular_queue_long_run);
    RUN(test_linked_queue);
    return unit_report();
}
