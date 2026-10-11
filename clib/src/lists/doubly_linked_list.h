#ifndef DOUBLY_LINKED_LIST_H
#define DOUBLY_LINKED_LIST_H

#include <stdbool.h>
#include <stddef.h>

typedef struct DListNode {
    int value;
    struct DListNode *prev;
    struct DListNode *next;
} DListNode;

typedef struct {
    DListNode *head;
    DListNode *tail;
    size_t size;
} DoublyLinkedList;

void dlist_init(DoublyLinkedList *list);
bool dlist_insert_front(DoublyLinkedList *list, int value);
bool dlist_insert_back(DoublyLinkedList *list, int value);
bool dlist_insert_at(DoublyLinkedList *list, size_t index, int value);
bool dlist_remove(DoublyLinkedList *list, int value);
int dlist_search(const DoublyLinkedList *list, int value);
size_t dlist_traverse(const DoublyLinkedList *list, int *out, size_t capacity);
/* Walks from tail to head through the prev pointers. */
size_t dlist_traverse_backward(const DoublyLinkedList *list, int *out, size_t capacity);
void dlist_destroy(DoublyLinkedList *list);

#endif
