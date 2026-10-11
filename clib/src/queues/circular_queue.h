#ifndef CIRCULAR_QUEUE_H
#define CIRCULAR_QUEUE_H

#include <stdbool.h>

#define CIRCULAR_QUEUE_CAPACITY 8

/*
 * Ring buffer: indices wrap around modulo the capacity, so slots freed by
 * dequeue are reused. front is the first element, rear the next free slot.
 */
typedef struct {
    int items[CIRCULAR_QUEUE_CAPACITY];
    int front;
    int rear;
    int count;
} CircularQueue;

void circular_queue_init(CircularQueue *q);
bool circular_queue_is_empty(const CircularQueue *q);
bool circular_queue_is_full(const CircularQueue *q);
bool circular_queue_enqueue(CircularQueue *q, int value);
bool circular_queue_dequeue(CircularQueue *q, int *out);
bool circular_queue_front(const CircularQueue *q, int *out);

#endif
