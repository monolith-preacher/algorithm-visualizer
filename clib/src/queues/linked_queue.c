#include <stdlib.h>

#include "av_trace.h"
#include "linked_queue.h"

void linked_queue_init(LinkedQueue *q) {
    q->front = NULL;
    q->rear = NULL;
    q->size = 0;
}

bool linked_queue_is_empty(const LinkedQueue *q) {
    return q->front == NULL;
}

bool linked_queue_enqueue(LinkedQueue *q, int value) {
    TRACE_ENTER(q, value);
    QueueNode *node = malloc(sizeof *node);
    TRACE_WATCH(node);
    TRACE_STEP();
    if (node == NULL) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    node->value = value;
    TRACE_STEP();
    node->next = NULL;
    TRACE_STEP();
    if (q->rear == NULL) {
        TRACE_STEP();
        q->front = node;
    } else {
        TRACE_STEP();
        q->rear->next = node;
    }
    TRACE_STEP();
    q->rear = node;
    TRACE_STEP();
    q->size++;
    TRACE_RETURN(true);
    return true;
}

bool linked_queue_dequeue(LinkedQueue *q, int *out) {
    TRACE_ENTER(q, out);
    QueueNode *node = q->front;
    TRACE_WATCH(node);
    TRACE_STEP();
    if (node == NULL) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    *out = node->value;
    TRACE_STEP();
    q->front = node->next;
    TRACE_STEP();
    if (q->front == NULL) {
        TRACE_STEP();
        q->rear = NULL;
    }
    TRACE_STEP();
    q->size--;
    free(node);
    TRACE_RETURN(true);
    return true;
}

bool linked_queue_front(const LinkedQueue *q, int *out) {
    TRACE_ENTER(q, out);
    TRACE_STEP();
    if (q->front == NULL) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    *out = q->front->value;
    TRACE_RETURN(true);
    return true;
}

void linked_queue_destroy(LinkedQueue *q) {
    QueueNode *node = q->front;
    while (node != NULL) {
        QueueNode *next = node->next;
        free(node);
        node = next;
    }
    linked_queue_init(q);
}
