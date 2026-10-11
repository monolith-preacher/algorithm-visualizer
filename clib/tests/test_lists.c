#include "lists/circular_linked_list.h"
#include "lists/doubly_linked_list.h"
#include "lists/singly_linked_list.h"
#include "unit.h"

#define MAX_MODEL 64

/* Reference model: a plain array holding the expected list contents. */
typedef struct {
    int values[MAX_MODEL];
    int n;
} Model;

static void model_insert(Model *m, int index, int value) {
    memmove(&m->values[index + 1], &m->values[index], (size_t)(m->n - index) * sizeof(int));
    m->values[index] = value;
    m->n++;
}

static int model_find(const Model *m, int value) {
    for (int i = 0; i < m->n; i++) {
        if (m->values[i] == value) {
            return i;
        }
    }
    return -1;
}

static void model_remove_at(Model *m, int index) {
    memmove(&m->values[index], &m->values[index + 1], (size_t)(m->n - index - 1) * sizeof(int));
    m->n--;
}

static void check_values(const int *values, size_t n, const Model *m) {
    CHECK_EQ(n, m->n);
    if ((int)n == m->n) {
        CHECK(memcmp(values, m->values, n * sizeof(int)) == 0);
    }
}

/* ---------------------------------------------------------- invariants */

static void check_slist(const SinglyLinkedList *l, const Model *m) {
    int values[MAX_MODEL];
    size_t count = 0;
    for (const SListNode *n = l->head; n != NULL && count < MAX_MODEL; n = n->next) {
        values[count++] = n->value;
    }
    CHECK_EQ(l->size, count);
    check_values(values, count, m);
}

static void check_dlist(const DoublyLinkedList *l, const Model *m) {
    int values[MAX_MODEL];
    size_t count = 0;
    const DListNode *last = NULL;
    CHECK(l->head == NULL || l->head->prev == NULL);
    CHECK(l->tail == NULL || l->tail->next == NULL);
    for (const DListNode *n = l->head; n != NULL && count < MAX_MODEL; n = n->next) {
        CHECK(n->prev == last);
        values[count++] = n->value;
        last = n;
    }
    CHECK(l->tail == last);
    CHECK_EQ(l->size, count);
    check_values(values, count, m);

    int backward[MAX_MODEL];
    size_t visited = dlist_traverse_backward(l, backward, MAX_MODEL);
    CHECK_EQ(visited, count);
    for (size_t i = 0; i < count && i < visited; i++) {
        CHECK_EQ(backward[i], values[count - 1 - i]);
    }
}

static void check_clist(const CircularLinkedList *l, const Model *m) {
    int values[MAX_MODEL];
    size_t count = 0;
    if (l->tail == NULL) {
        CHECK_EQ(l->size, 0);
    } else {
        const CListNode *head = l->tail->next;
        const CListNode *n = head;
        do {
            values[count++] = n->value;
            if (n->next == head) {
                CHECK(n == l->tail);
            }
            n = n->next;
        } while (n != head && count < MAX_MODEL);
        CHECK(n == head);
    }
    CHECK_EQ(l->size, count);
    check_values(values, count, m);
}

/* --------------------------------------------------- adapter interface */

typedef struct {
    const char *name;
    void *list;
    bool (*insert_front)(void *, int);
    bool (*insert_back)(void *, int);
    bool (*insert_at)(void *, size_t, int);
    bool (*remove)(void *, int);
    int (*search)(const void *, int);
    size_t (*traverse)(const void *, int *, size_t);
    void (*check)(const void *, const Model *);
    void (*destroy)(void *);
} ListApi;

#define ADAPT(prefix, type)                                                                        \
    static bool prefix##_front_(void *l, int v) { return prefix##_insert_front(l, v); }            \
    static bool prefix##_back_(void *l, int v) { return prefix##_insert_back(l, v); }              \
    static bool prefix##_at_(void *l, size_t i, int v) { return prefix##_insert_at(l, i, v); }     \
    static bool prefix##_remove_(void *l, int v) { return prefix##_remove(l, v); }                 \
    static int prefix##_search_(const void *l, int v) { return prefix##_search(l, v); }            \
    static size_t prefix##_traverse_(const void *l, int *o, size_t c) {                            \
        return prefix##_traverse(l, o, c);                                                         \
    }                                                                                              \
    static void prefix##_check_(const void *l, const Model *m) { check_##prefix(l, m); }           \
    static void prefix##_destroy_(void *l) { prefix##_destroy(l); }                                \
    static ListApi prefix##_api(type *l) {                                                         \
        return (ListApi){#prefix,          l,                   prefix##_front_,                   \
                         prefix##_back_,   prefix##_at_,        prefix##_remove_,                  \
                         prefix##_search_, prefix##_traverse_,  prefix##_check_,                   \
                         prefix##_destroy_};                                                       \
    }

ADAPT(slist, SinglyLinkedList)
ADAPT(dlist, DoublyLinkedList)
ADAPT(clist, CircularLinkedList)

/* ------------------------------------------------------------- tests */

static void scenario_basic(ListApi api) {
    Model m = {{0}, 0};
    int out[MAX_MODEL];
    api.check(api.list, &m);
    CHECK(!api.remove(api.list, 1));
    CHECK_EQ(api.search(api.list, 1), -1);
    CHECK_EQ(api.traverse(api.list, out, MAX_MODEL), 0);
    CHECK(!api.insert_at(api.list, 1, 5));

    CHECK(api.insert_back(api.list, 2));
    model_insert(&m, 0, 2);
    CHECK(api.insert_front(api.list, 1));
    model_insert(&m, 0, 1);
    CHECK(api.insert_back(api.list, 4));
    model_insert(&m, 2, 4);
    CHECK(api.insert_at(api.list, 2, 3));
    model_insert(&m, 2, 3);
    CHECK(api.insert_at(api.list, 4, 5));
    model_insert(&m, 4, 5);
    CHECK(api.insert_at(api.list, 0, 0));
    model_insert(&m, 0, 0);
    CHECK(!api.insert_at(api.list, 7, 9));
    api.check(api.list, &m);

    CHECK_EQ(api.search(api.list, 0), 0);
    CHECK_EQ(api.search(api.list, 5), 5);
    CHECK_EQ(api.search(api.list, 42), -1);
    size_t n = api.traverse(api.list, out, MAX_MODEL);
    check_values(out, n, &m);

    CHECK(api.remove(api.list, 0)); /* head */
    model_remove_at(&m, 0);
    CHECK(api.remove(api.list, 5)); /* tail */
    model_remove_at(&m, 4);
    CHECK(api.remove(api.list, 3)); /* middle */
    model_remove_at(&m, 2);
    CHECK(!api.remove(api.list, 3));
    api.check(api.list, &m);

    while (m.n > 0) {
        CHECK(api.remove(api.list, m.values[0]));
        model_remove_at(&m, 0);
        api.check(api.list, &m);
    }
    api.destroy(api.list);
}

static void scenario_allocation_failure(ListApi api) {
    Model m = {{0}, 0};
    CHECK(api.insert_back(api.list, 1));
    model_insert(&m, 0, 1);
    unit_fail_nth_alloc(0);
    CHECK(!api.insert_front(api.list, 2));
    unit_fail_nth_alloc(0);
    CHECK(!api.insert_back(api.list, 2));
    unit_fail_nth_alloc(0);
    CHECK(!api.insert_at(api.list, 1, 2));
    api.check(api.list, &m);
    CHECK(api.insert_back(api.list, 3));
    model_insert(&m, 1, 3);
    api.check(api.list, &m);
    api.destroy(api.list);
}

static void scenario_random(ListApi api) {
    Model m = {{0}, 0};
    for (int step = 0; step < 4000; step++) {
        int op = unit_rand(0, 5);
        int value = unit_rand(0, 20);
        bool inject = unit_rand(0, 19) == 0;
        if (inject) {
            unit_fail_nth_alloc(0);
        }
        if (op <= 2 && m.n < MAX_MODEL - 1) {
            int index = op == 0 ? 0 : op == 1 ? m.n : unit_rand(0, m.n + 1);
            bool ok = op == 0   ? api.insert_front(api.list, value)
                      : op == 1 ? api.insert_back(api.list, value)
                                : api.insert_at(api.list, (size_t)index, value);
            CHECK_EQ(ok, !inject && index <= m.n);
            if (ok) {
                model_insert(&m, index, value);
            }
        } else if (op == 3) {
            int index = model_find(&m, value);
            CHECK_EQ(api.remove(api.list, value), index >= 0);
            if (index >= 0) {
                model_remove_at(&m, index);
            }
        } else if (op == 4) {
            CHECK_EQ(api.search(api.list, value), model_find(&m, value));
        } else {
            int out[MAX_MODEL];
            size_t n = api.traverse(api.list, out, MAX_MODEL);
            check_values(out, n, &m);
        }
        unit_fail_nth_alloc(-1);
        api.check(api.list, &m);
    }
    api.destroy(api.list);
    m.n = 0;
    api.check(api.list, &m);
}

static void test_singly(void) {
    SinglyLinkedList l;
    slist_init(&l);
    scenario_basic(slist_api(&l));
    scenario_allocation_failure(slist_api(&l));
    scenario_random(slist_api(&l));
}

static void test_doubly(void) {
    DoublyLinkedList l;
    dlist_init(&l);
    scenario_basic(dlist_api(&l));
    scenario_allocation_failure(dlist_api(&l));
    scenario_random(dlist_api(&l));
}

static void test_circular(void) {
    CircularLinkedList l;
    clist_init(&l);
    CHECK(clist_insert_back(&l, 1));
    CHECK(l.tail != NULL && l.tail->next == l.tail);
    CHECK(clist_remove(&l, 1));
    CHECK(l.tail == NULL);
    scenario_basic(clist_api(&l));
    scenario_allocation_failure(clist_api(&l));
    scenario_random(clist_api(&l));
}

int main(void) {
    puts("linked lists");
    RUN(test_singly);
    RUN(test_doubly);
    RUN(test_circular);
    return unit_report();
}
