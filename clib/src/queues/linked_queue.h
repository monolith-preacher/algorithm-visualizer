#ifndef LINKED_QUEUE_H
#define LINKED_QUEUE_H

#include <stdbool.h>
#include <stddef.h>

typedef struct QueueNode {
    int value;
    struct QueueNode *next;
} QueueNode;

/* Elements are dequeued at front and enqueued at rear; both NULL when empty. */
typedef struct {
    QueueNode *front;
    QueueNode *rear;
    size_t size;
} LinkedQueue;

void linked_queue_init(LinkedQueue *q);
bool linked_queue_is_empty(const LinkedQueue *q);
/* Returns false if the node cannot be allocated; the queue is unchanged. */
bool linked_queue_enqueue(LinkedQueue *q, int value);
bool linked_queue_dequeue(LinkedQueue *q, int *out);
bool linked_queue_front(const LinkedQueue *q, int *out);
void linked_queue_destroy(LinkedQueue *q);

#endif
