#include <stdlib.h>

#include "av_trace.h"
#include "doubly_linked_list.h"

void dlist_init(DoublyLinkedList *list) {
    list->head = NULL;
    list->tail = NULL;
    list->size = 0;
}

bool dlist_insert_front(DoublyLinkedList *list, int value) {
    TRACE_ENTER(list, value);
    DListNode *node = malloc(sizeof *node);
    TRACE_WATCH(node);
    TRACE_STEP();
    if (node == NULL) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    node->value = value;
    TRACE_STEP();
    node->prev = NULL;
    TRACE_STEP();
    node->next = list->head;
    TRACE_STEP();
    if (list->head != NULL) {
        TRACE_STEP();
        list->head->prev = node;
    } else {
        TRACE_STEP();
        list->tail = node;
    }
    TRACE_STEP();
    list->head = node;
    TRACE_STEP();
    list->size++;
    TRACE_RETURN(true);
    return true;
}

bool dlist_insert_back(DoublyLinkedList *list, int value) {
    TRACE_ENTER(list, value);
    DListNode *node = malloc(sizeof *node);
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
    node->prev = list->tail;
    TRACE_STEP();
    if (list->tail != NULL) {
        TRACE_STEP();
        list->tail->next = node;
    } else {
        TRACE_STEP();
        list->head = node;
    }
    TRACE_STEP();
    list->tail = node;
    TRACE_STEP();
    list->size++;
    TRACE_RETURN(true);
    return true;
}

bool dlist_insert_at(DoublyLinkedList *list, size_t index, int value) {
    TRACE_ENTER(list, index, value);
    DListNode *node = NULL, *next = NULL;
    TRACE_WATCH(node, next);
    TRACE_STEP();
    if (index > list->size) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    if (index == 0) {
        bool inserted = dlist_insert_front(list, value);
        TRACE_RETURN(inserted);
        return inserted;
    }
    TRACE_STEP();
    if (index == list->size) {
        bool inserted = dlist_insert_back(list, value);
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
    next = list->head;
    for (size_t i = 0; i < index; i++) {
        TRACE_STEP();
        next = next->next;
    }
    TRACE_STEP();
    node->next = next;
    TRACE_STEP();
    node->prev = next->prev;
    TRACE_STEP();
    next->prev->next = node;
    TRACE_STEP();
    next->prev = node;
    TRACE_STEP();
    list->size++;
    TRACE_RETURN(true);
    return true;
}

bool dlist_remove(DoublyLinkedList *list, int value) {
    TRACE_ENTER(list, value);
    DListNode *current = list->head;
    TRACE_WATCH(current);
    while (current != NULL) {
        TRACE_STEP();
        if (current->value == value) {
            break;
        }
        TRACE_STEP();
        current = current->next;
    }
    TRACE_STEP();
    if (current == NULL) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    if (current->prev != NULL) {
        TRACE_STEP();
        current->prev->next = current->next;
    } else {
        TRACE_STEP();
        list->head = current->next;
    }
    TRACE_STEP();
    if (current->next != NULL) {
        TRACE_STEP();
        current->next->prev = current->prev;
    } else {
        TRACE_STEP();
        list->tail = current->prev;
    }
    free(current);
    TRACE_STEP();
    list->size--;
    TRACE_RETURN(true);
    return true;
}

int dlist_search(const DoublyLinkedList *list, int value) {
    TRACE_ENTER(list, value);
    const DListNode *current = list->head;
    int index = 0;
    TRACE_WATCH(current, index);
    while (current != NULL) {
        TRACE_STEP();
        if (current->value == value) {
            TRACE_RETURN(index);
            return index;
        }
        TRACE_STEP();
        current = current->next;
        index++;
    }
    TRACE_RETURN(-1);
    return -1;
}

size_t dlist_traverse(const DoublyLinkedList *list, int *out, size_t capacity) {
    TRACE_ENTER(list, capacity);
    const DListNode *current = list->head;
    size_t count = 0;
    TRACE_WATCH(current, count);
    while (current != NULL) {
        TRACE_STEP();
        if (count < capacity) {
            out[count] = current->value;
        }
        TRACE_STEP();
        count++;
        TRACE_STEP();
        current = current->next;
    }
    TRACE_RETURN(count);
    return count;
}

size_t dlist_traverse_backward(const DoublyLinkedList *list, int *out, size_t capacity) {
    TRACE_ENTER(list, capacity);
    const DListNode *current = list->tail;
    size_t count = 0;
    TRACE_WATCH(current, count);
    while (current != NULL) {
        TRACE_STEP();
        if (count < capacity) {
            out[count] = current->value;
        }
        TRACE_STEP();
        count++;
        TRACE_STEP();
        current = current->prev;
    }
    TRACE_RETURN(count);
    return count;
}

void dlist_destroy(DoublyLinkedList *list) {
    DListNode *current = list->head;
    while (current != NULL) {
        DListNode *next = current->next;
        free(current);
        current = next;
    }
    dlist_init(list);
}
