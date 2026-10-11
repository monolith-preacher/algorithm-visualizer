#include "array_queue.h"
#include "av_trace.h"

void array_queue_init(ArrayQueue *q) {
    q->front = 0;
    q->rear = 0;
}

bool array_queue_is_empty(const ArrayQueue *q) {
    return q->front == q->rear;
}

bool array_queue_is_full(const ArrayQueue *q) {
    return q->rear == ARRAY_QUEUE_CAPACITY;
}

bool array_queue_enqueue(ArrayQueue *q, int value) {
    TRACE_ENTER(q, value);
    TRACE_STEP();
    if (array_queue_is_full(q)) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    q->items[q->rear] = value;
    TRACE_STEP();
    q->rear++;
    TRACE_RETURN(true);
    return true;
}

bool array_queue_dequeue(ArrayQueue *q, int *out) {
    TRACE_ENTER(q, out);
    TRACE_STEP();
    if (array_queue_is_empty(q)) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    *out = q->items[q->front];
    TRACE_STEP();
    q->front++;
    TRACE_RETURN(true);
    return true;
}

bool array_queue_front(const ArrayQueue *q, int *out) {
    TRACE_ENTER(q, out);
    TRACE_STEP();
    if (array_queue_is_empty(q)) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    *out = q->items[q->front];
    TRACE_RETURN(true);
    return true;
}
