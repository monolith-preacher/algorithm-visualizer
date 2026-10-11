#ifndef CIRCULAR_LINKED_LIST_H
#define CIRCULAR_LINKED_LIST_H

#include <stdbool.h>
#include <stddef.h>

typedef struct CListNode {
    int value;
    struct CListNode *next;
} CListNode;

/*
 * Circular singly linked list addressed by its tail: tail->next is the head,
 * so both ends are reachable in O(1). tail is NULL when the list is empty.
 */
typedef struct {
    CListNode *tail;
    size_t size;
} CircularLinkedList;

void clist_init(CircularLinkedList *list);
bool clist_insert_front(CircularLinkedList *list, int value);
bool clist_insert_back(CircularLinkedList *list, int value);
bool clist_insert_at(CircularLinkedList *list, size_t index, int value);
bool clist_remove(CircularLinkedList *list, int value);
int clist_search(const CircularLinkedList *list, int value);
size_t clist_traverse(const CircularLinkedList *list, int *out, size_t capacity);
void clist_destroy(CircularLinkedList *list);

#endif
