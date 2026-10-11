#ifndef ARRAY_QUEUE_H
#define ARRAY_QUEUE_H

#include <stdbool.h>

#define ARRAY_QUEUE_CAPACITY 8

/*
 * Linear (non-circular) queue in a fixed array. front is the index of the
 * first element and rear the index of the next free slot. Slots before front
 * are never reused: once rear reaches the capacity the queue is full even if
 * elements were dequeued. CircularQueue removes that limitation.
 */
typedef struct {
    int items[ARRAY_QUEUE_CAPACITY];
    int front;
    int rear;
} ArrayQueue;

void array_queue_init(ArrayQueue *q);
bool array_queue_is_empty(const ArrayQueue *q);
bool array_queue_is_full(const ArrayQueue *q);
bool array_queue_enqueue(ArrayQueue *q, int value);
bool array_queue_dequeue(ArrayQueue *q, int *out);
bool array_queue_front(const ArrayQueue *q, int *out);

#endif
