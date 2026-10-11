#include <stdlib.h>

#include "av_trace.h"
#include "singly_linked_list.h"

void slist_init(SinglyLinkedList *list) {
    list->head = NULL;
    list->size = 0;
}

bool slist_insert_front(SinglyLinkedList *list, int value) {
    TRACE_ENTER(list, value);
    SListNode *node = malloc(sizeof *node);
    TRACE_WATCH(node);
    TRACE_STEP();
    if (node == NULL) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    node->value = value;
    TRACE_STEP();
    node->next = list->head;
    TRACE_STEP();
    list->head = node;
    TRACE_STEP();
    list->size++;
    TRACE_RETURN(true);
    return true;
}

bool slist_insert_back(SinglyLinkedList *list, int value) {
    TRACE_ENTER(list, value);
    SListNode *node = malloc(sizeof *node);
    SListNode *last = NULL;
    TRACE_WATCH(node, last);
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
    if (list->head == NULL) {
        TRACE_STEP();
        list->head = node;
    } else {
        TRACE_STEP();
        last = list->head;
        while (last->next != NULL) {
            TRACE_STEP();
            last = last->next;
        }
        TRACE_STEP();
        last->next = node;
    }
    TRACE_STEP();
    list->size++;
    TRACE_RETURN(true);
    return true;
}

bool slist_insert_at(SinglyLinkedList *list, size_t index, int value) {
    TRACE_ENTER(list, index, value);
    SListNode *node = NULL, *prev = NULL;
    TRACE_WATCH(node, prev);
    TRACE_STEP();
    if (index > list->size) {
        TRACE_RETURN(false);
        return false;
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
    if (index == 0) {
        TRACE_STEP();
        node->next = list->head;
        TRACE_STEP();
        list->head = node;
    } else {
        TRACE_STEP();
        prev = list->head;
        for (size_t i = 1; i < index; i++) {
            TRACE_STEP();
            prev = prev->next;
        }
        TRACE_STEP();
        node->next = prev->next;
        TRACE_STEP();
        prev->next = node;
    }
    TRACE_STEP();
    list->size++;
    TRACE_RETURN(true);
    return true;
}

bool slist_remove(SinglyLinkedList *list, int value) {
    TRACE_ENTER(list, value);
    SListNode *prev = NULL;
    SListNode *current = list->head;
    TRACE_WATCH(prev, current);
    while (current != NULL) {
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
    if (current == NULL) {
        TRACE_RETURN(false);
        return false;
    }
    TRACE_STEP();
    if (prev == NULL) {
        TRACE_STEP();
        list->head = current->next;
    } else {
        TRACE_STEP();
        prev->next = current->next;
    }
    free(current);
    TRACE_STEP();
    list->size--;
    TRACE_RETURN(true);
    return true;
}

int slist_search(const SinglyLinkedList *list, int value) {
    TRACE_ENTER(list, value);
    const SListNode *current = list->head;
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

size_t slist_traverse(const SinglyLinkedList *list, int *out, size_t capacity) {
    TRACE_ENTER(list, capacity);
    const SListNode *current = list->head;
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

void slist_destroy(SinglyLinkedList *list) {
    SListNode *current = list->head;
    while (current != NULL) {
        SListNode *next = current->next;
        free(current);
        current = next;
    }
    slist_init(list);
}
