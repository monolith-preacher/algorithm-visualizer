#include "av_trace.h"
#include "circular_queue.h"

void circular_queue_init(CircularQueue *q) {
    q->front = 0;
    q->rear = 0;
    q->count = 0;
}

bool circular_queue_is_empty(const CircularQueue *q) {
    return q->count == 0;
}

bool circular_queue_is_full(const CircularQueue *q) {
    return q->count == CIRCULAR_QUEUE_CAPACITY;
}

bool circular_queue_enqueue(CircularQueue *q, int value) {
    TRACE_ENTER(q, value);
    TRACE_STEP();
    if (circular_queue_is_full(q)) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    q->items[q->rear] = value;
    TRACE_STEP();
    q->rear = (q->rear + 1) % CIRCULAR_QUEUE_CAPACITY;
    TRACE_STEP();
    q->count++;
    TRACE_RETURN(true);
    return true;
}

bool circular_queue_dequeue(CircularQueue *q, int *out) {
    TRACE_ENTER(q, out);
    TRACE_STEP();
    if (circular_queue_is_empty(q)) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    *out = q->items[q->front];
    TRACE_STEP();
    q->front = (q->front + 1) % CIRCULAR_QUEUE_CAPACITY;
    TRACE_STEP();
    q->count--;
    TRACE_RETURN(true);
    return true;
}

bool circular_queue_front(const CircularQueue *q, int *out) {
    TRACE_ENTER(q, out);
    TRACE_STEP();
    if (circular_queue_is_empty(q)) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    *out = q->items[q->front];
    TRACE_RETURN(true);
    return true;
}
