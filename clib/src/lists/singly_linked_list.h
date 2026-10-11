#ifndef SINGLY_LINKED_LIST_H
#define SINGLY_LINKED_LIST_H

#include <stdbool.h>
#include <stddef.h>

typedef struct SListNode {
    int value;
    struct SListNode *next;
} SListNode;

typedef struct {
    SListNode *head;
    size_t size;
} SinglyLinkedList;

void slist_init(SinglyLinkedList *list);
/* Insertions return false on allocation failure or invalid index. */
bool slist_insert_front(SinglyLinkedList *list, int value);
bool slist_insert_back(SinglyLinkedList *list, int value);
bool slist_insert_at(SinglyLinkedList *list, size_t index, int value);
/* Removes the first node holding value; false if there is none. */
bool slist_remove(SinglyLinkedList *list, int value);
/* Index of the first node holding value, or -1. */
int slist_search(const SinglyLinkedList *list, int value);
/* Copies up to capacity values in list order; returns the number of nodes visited. */
size_t slist_traverse(const SinglyLinkedList *list, int *out, size_t capacity);
void slist_destroy(SinglyLinkedList *list);

#endif
