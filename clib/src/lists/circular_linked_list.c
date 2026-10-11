#include <stdlib.h>

#include "av_trace.h"
#include "circular_linked_list.h"

void clist_init(CircularLinkedList *list) {
    list->tail = NULL;
    list->size = 0;
}

bool clist_insert_front(CircularLinkedList *list, int value) {
    TRACE_ENTER(list, value);
    CListNode *node = malloc(sizeof *node);
    TRACE_WATCH(node);
    TRACE_STEP();
    if (node == NULL) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    node->value = value;
    TRACE_STEP();
    if (list->tail == NULL) {
        TRACE_STEP();
        node->next = node;
        TRACE_STEP();
        list->tail = node;
    } else {
        TRACE_STEP();
        node->next = list->tail->next;
        TRACE_STEP();
        list->tail->next = node;
    }
    TRACE_STEP();
    list->size++;
    TRACE_RETURN(true);
    return true;
}

bool clist_insert_back(CircularLinkedList *list, int value) {
    TRACE_ENTER(list, value);
    bool inserted = clist_insert_front(list, value);
    TRACE_WATCH(inserted);
    TRACE_STEP();
    if (inserted) {
        TRACE_STEP();
        list->tail = list->tail->next;
    }
    TRACE_RETURN(inserted);
    return inserted;
}

bool clist_insert_at(CircularLinkedList *list, size_t index, int value) {
    TRACE_ENTER(list, index, value);
    CListNode *node = NULL, *prev = NULL;
    TRACE_WATCH(node, prev);
    TRACE_STEP();
    if (index > list->size) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    if (index == 0) {
        bool inserted = clist_insert_front(list, value);
        TRACE_RETURN(inserted);
        return inserted;
    }
    TRACE_STEP();
    if (index == list->size) {
        bool inserted = clist_insert_back(list, value);
        TRACE_RETURN(inserted);
        return inserted;
    }
    node = malloc(sizeof *node);
    TRACE_STEP();
    if (node == NULL) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    node->value = value;
    TRACE_STEP();
    prev = list->tail->next;
    for (size_t i = 1; i < index; i++) {
        TRACE_STEP();
        prev = prev->next;
    }
    TRACE_STEP();
    node->next = prev->next;
    TRACE_STEP();
    prev->next = node;
    TRACE_STEP();
    list->size++;
    TRACE_RETURN(true);
    return true;
}

bool clist_remove(CircularLinkedList *list, int value) {
    TRACE_ENTER(list, value);
    CListNode *prev = list->tail;
    CListNode *current = NULL;
    TRACE_WATCH(prev, current);
    TRACE_STEP();
    if (list->tail == NULL) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    current = list->tail->next;
    for (size_t i = 0; i < list->size; i++) {
        TRACE_STEP();
        if (current->value == value) {
            break;
        }
        TRACE_STEP();
        prev = current;
        TRACE_STEP();
        current = current->next;
    }
    TRACE_STEP();
    if (current->value != value) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    if (current == prev) {
        TRACE_STEP();
        list->tail = NULL;
    } else {
        TRACE_STEP();
        prev->next = current->next;
        TRACE_STEP();
        if (current == list->tail) {
            TRACE_STEP();
            list->tail = prev;
        }
    }
    free(current);
    TRACE_STEP();
    list->size--;
    TRACE_RETURN(true);
    return true;
}

int clist_search(const CircularLinkedList *list, int value) {
    TRACE_ENTER(list, value);
    const CListNode *current = NULL;
    int index = 0;
    TRACE_WATCH(current, index);
    TRACE_STEP();
    if (list->tail == NULL) {
        TRACE_RETURN(-1);
        return -1;
    }
    TRACE_STEP();
    current = list->tail->next;
    for (index = 0; (size_t)index < list->size; index++) {
        TRACE_STEP();
        if (current->value == value) {
            TRACE_RETURN(index);
            return index;
        }
        TRACE_STEP();
        current = current->next;
    }
    TRACE_RETURN(-1);
    return -1;
}

size_t clist_traverse(const CircularLinkedList *list, int *out, size_t capacity) {
    TRACE_ENTER(list, capacity);
    const CListNode *current = NULL;
    size_t count = 0;
    TRACE_WATCH(current, count);
    TRACE_STEP();
    if (list->tail == NULL) {
        TRACE_RETURN(count);
        return 0;
    }
    TRACE_STEP();
    current = list->tail->next;
    do {
        TRACE_STEP();
        if (count < capacity) {
            out[count] = current->value;
        }
        TRACE_STEP();
        count++;
        TRACE_STEP();
        current = current->next;
        TRACE_STEP();
    } while (current != list->tail->next);
    TRACE_RETURN(count);
    return count;
}

void clist_destroy(CircularLinkedList *list) {
    if (list->tail != NULL) {
        CListNode *current = list->tail->next;
        for (size_t i = 0; i < list->size; i++) {
            CListNode *next = current->next;
            free(current);
            current = next;
        }
    }
    clist_init(list);
}
