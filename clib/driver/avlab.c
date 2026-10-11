/*
 * avlab - runs one Algorithm Lab algorithm on input read from stdin and
 * writes its execution trace (JSON lines) to stdout.
 *
 *   avlab <algorithm-id> [--trace-from K]
 *
 * Input formats:
 *   sorting      n v1 ... vn
 *   searching    n v1 ... vn target
 *   recursion    n
 *   structures   one operation per line, e.g. "push 5", "insert_at 2 7"
 *
 * For data structures every operation is replayed from an empty structure;
 * events are emitted only from operation K on (--trace-from), so the UI can
 * animate the latest operation while the state stays fully reproducible.
 * Address-space randomization is disabled (personality(2)) so that replays
 * produce the same heap addresses.
 */
#define _GNU_SOURCE
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/personality.h>
#include <unistd.h>

#include "av_trace.h"
#include "../src/lists/circular_linked_list.h"
#include "../src/lists/doubly_linked_list.h"
#include "../src/lists/singly_linked_list.h"
#include "../src/queues/array_queue.h"
#include "../src/queues/circular_queue.h"
#include "../src/queues/linked_queue.h"
#include "../src/recursion/recursion.h"
#include "../src/searching/searching.h"
#include "../src/sorting/sorting.h"
#include "../src/stacks/array_stack.h"
#include "../src/stacks/linked_stack.h"

#undef malloc
#undef calloc
#undef free

#define MAX_ARRAY 256
#define MAX_OPS 256
#define MAX_LIST_VALUES 64
#define VALUE_LIMIT 1000000

static void fail(const char *code, const char *message) {
    printf("{\"t\":\"error\",\"code\":\"%s\",\"message\":\"%s\"}\n", code, message);
    fflush(stdout);
    exit(2);
}

static void disable_aslr(char **argv) {
    int current = personality(0xffffffff);
    if (current == -1 || (current & ADDR_NO_RANDOMIZE)) {
        return;
    }
    if (personality((unsigned long)current | ADDR_NO_RANDOMIZE) == -1) {
        return;
    }
    execv("/proc/self/exe", argv);
    /* Fall through with ASLR enabled: addresses may differ between replays. */
}

static int read_int(const char *what, int min, int max) {
    char message[128];
    long v;
    if (scanf("%ld", &v) != 1) {
        snprintf(message, sizeof message, "expected an integer for the %s", what);
        fail("invalid_input", message);
    }
    if (v < min || v > max) {
        snprintf(message, sizeof message, "%s must be between %d and %d", what, min, max);
        fail("out_of_range", message);
    }
    return (int)v;
}

static int read_array(int *a) {
    int n = read_int("array length", 0, MAX_ARRAY);
    for (int i = 0; i < n; i++) {
        a[i] = read_int("array element", -VALUE_LIMIT, VALUE_LIMIT);
    }
    return n;
}

static void print_array(const char *key, const int *a, int n) {
    printf("\"%s\":[", key);
    for (int i = 0; i < n; i++) {
        printf("%s%d", i ? "," : "", a[i]);
    }
    putchar(']');
}

static void print_end_prefix(void) {
    printf("{\"t\":\"end\",\"events\":%ld,\"truncated\":%s,\"result\":{", av_trace_event_count(),
           av_trace_truncated() ? "true" : "false");
}

/* ---------------------------------------------------------------- sorting */

static int run_sort(const char *id) {
    static int a[MAX_ARRAY];
    int n = read_array(a);
    TRACE_ARRAY(a, n);
    int status = 0;
    if (strcmp(id, "bubble-sort") == 0) {
        bubble_sort(a, n);
    } else if (strcmp(id, "selection-sort") == 0) {
        selection_sort(a, n);
    } else if (strcmp(id, "insertion-sort") == 0) {
        insertion_sort(a, n);
    } else if (strcmp(id, "merge-sort") == 0) {
        status = merge_sort(a, n);
    } else if (strcmp(id, "quick-sort") == 0) {
        quick_sort(a, n);
    } else {
        heap_sort(a, n);
    }
    print_end_prefix();
    print_array("array", a, n);
    printf(",\"status\":%d,\"sorted\":%s}}\n", status, is_sorted(a, n) ? "true" : "false");
    return 0;
}

/* -------------------------------------------------------------- searching */

static int run_search(const char *id) {
    static int a[MAX_ARRAY];
    int n = read_array(a);
    int target = read_int("target", -VALUE_LIMIT, VALUE_LIMIT);
    bool binary = strcmp(id, "binary-search") == 0;
    if (binary && !is_sorted(a, n)) {
        fail("precondition", "binary search requires the array to be sorted in non-decreasing order");
    }
    TRACE_ARRAY(a, n);
    int index = binary ? binary_search(a, n, target) : linear_search(a, n, target);
    print_end_prefix();
    printf("\"index\":%d}}\n", index);
    return 0;
}

/* -------------------------------------------------------------- recursion */

static void dump_towers(FILE *out, const void *ctx) {
    const Towers *t = ctx;
    fputs("{\"pegs\":[", out);
    for (int p = 0; p < 3; p++) {
        fprintf(out, "%s[", p ? "," : "");
        for (int i = 0; i < t->pegs[p].count; i++) {
            fprintf(out, "%s%d", i ? "," : "", t->pegs[p].disks[i]);
        }
        fputc(']', out);
    }
    fprintf(out, "],\"moves\":%d}", t->moves);
}

static int run_recursion(const char *id) {
    if (strcmp(id, "factorial") == 0) {
        int n = read_int("n", 0, 20);
        unsigned long long value = factorial(n);
        print_end_prefix();
        printf("\"value\":%llu}}\n", value);
    } else if (strcmp(id, "fibonacci") == 0) {
        int n = read_int("n", 0, 12);
        long long value = fibonacci(n);
        print_end_prefix();
        printf("\"value\":%lld}}\n", value);
    } else {
        static Towers towers;
        int n = read_int("n", 1, HANOI_MAX_DISKS);
        towers_init(&towers, n);
        av_trace_set_dumper(dump_towers, &towers);
        hanoi(&towers, n, 'A', 'C', 'B');
        av_trace_set_dumper(NULL, NULL);
        print_end_prefix();
        printf("\"moves\":%d,\"legal\":%s,\"state\":", towers.moves,
               towers.illegal_move ? "false" : "true");
        dump_towers(stdout, &towers);
        fputs("}}\n", stdout);
    }
    return 0;
}

/* ------------------------------------------------------ structure dumpers */

static void dump_int_array(FILE *out, const int *items, int n) {
    fputs("\"items\":[", out);
    for (int i = 0; i < n; i++) {
        fprintf(out, "%s%d", i ? "," : "", items[i]);
    }
    fputc(']', out);
}

static void dump_self(FILE *out, const void *self) {
    fputs("\"self\":", out);
    av_write_ptr(out, self);
}

/* Heap blocks are listed in allocation order; fields are read verbatim, so a
 * freshly allocated node shows whatever bytes malloc returned. */
static void dump_nodes(FILE *out, size_t value_off, long prev_off, size_t next_off) {
    fputs(",\"nodes\":[", out);
    for (size_t i = 0; i < av_heap_block_count(); i++) {
        const AvBlock *b = av_heap_block_at(i);
        const char *base = b->ptr;
        int value;
        void *next;
        memcpy(&value, base + value_off, sizeof value);
        memcpy(&next, base + next_off, sizeof next);
        fprintf(out, "%s{\"id\":%u,\"addr\":", i ? "," : "", b->id);
        av_write_ptr(out, b->ptr);
        fprintf(out, ",\"size\":%zu,\"line\":%d,\"value\":%d,\"next\":", b->size, b->line, value);
        av_write_ptr(out, next);
        if (prev_off >= 0) {
            void *prev;
            memcpy(&prev, base + prev_off, sizeof prev);
            fputs(",\"prev\":", out);
            av_write_ptr(out, prev);
        }
        fputc('}', out);
    }
    fputc(']', out);
}

static void dump_array_stack(FILE *out, const void *ctx) {
    const ArrayStack *s = ctx;
    fputc('{', out);
    dump_self(out, s);
    fprintf(out, ",\"capacity\":%d,\"top\":%d,", ARRAY_STACK_CAPACITY, s->top);
    dump_int_array(out, s->items, ARRAY_STACK_CAPACITY);
    fputc('}', out);
}

static void dump_linked_stack(FILE *out, const void *ctx) {
    const LinkedStack *s = ctx;
    fputc('{', out);
    dump_self(out, s);
    fputs(",\"top\":", out);
    av_write_ptr(out, s->top);
    fprintf(out, ",\"size\":%zu", s->size);
    dump_nodes(out, offsetof(StackNode, value), -1, offsetof(StackNode, next));
    fputc('}', out);
}

static void dump_array_queue(FILE *out, const void *ctx) {
    const ArrayQueue *q = ctx;
    fputc('{', out);
    dump_self(out, q);
    fprintf(out, ",\"capacity\":%d,\"front\":%d,\"rear\":%d,", ARRAY_QUEUE_CAPACITY, q->front, q->rear);
    dump_int_array(out, q->items, ARRAY_QUEUE_CAPACITY);
    fputc('}', out);
}

static void dump_circular_queue(FILE *out, const void *ctx) {
    const CircularQueue *q = ctx;
    fputc('{', out);
    dump_self(out, q);
    fprintf(out, ",\"capacity\":%d,\"front\":%d,\"rear\":%d,\"count\":%d,",
            CIRCULAR_QUEUE_CAPACITY, q->front, q->rear, q->count);
    dump_int_array(out, q->items, CIRCULAR_QUEUE_CAPACITY);
    fputc('}', out);
}

static void dump_linked_queue(FILE *out, const void *ctx) {
    const LinkedQueue *q = ctx;
    fputc('{', out);
    dump_self(out, q);
    fputs(",\"front\":", out);
    av_write_ptr(out, q->front);
    fputs(",\"rear\":", out);
    av_write_ptr(out, q->rear);
    fprintf(out, ",\"size\":%zu", q->size);
    dump_nodes(out, offsetof(QueueNode, value), -1, offsetof(QueueNode, next));
    fputc('}', out);
}

static void dump_slist(FILE *out, const void *ctx) {
    const SinglyLinkedList *l = ctx;
    fputc('{', out);
    dump_self(out, l);
    fputs(",\"head\":", out);
    av_write_ptr(out, l->head);
    fprintf(out, ",\"size\":%zu", l->size);
    dump_nodes(out, offsetof(SListNode, value), -1, offsetof(SListNode, next));
    fputc('}', out);
}

static void dump_dlist(FILE *out, const void *ctx) {
    const DoublyLinkedList *l = ctx;
    fputc('{', out);
    dump_self(out, l);
    fputs(",\"head\":", out);
    av_write_ptr(out, l->head);
    fputs(",\"tail\":", out);
    av_write_ptr(out, l->tail);
    fprintf(out, ",\"size\":%zu", l->size);
    dump_nodes(out, offsetof(DListNode, value), (long)offsetof(DListNode, prev),
               offsetof(DListNode, next));
    fputc('}', out);
}

static void dump_clist(FILE *out, const void *ctx) {
    const CircularLinkedList *l = ctx;
    fputc('{', out);
    dump_self(out, l);
    fputs(",\"tail\":", out);
    av_write_ptr(out, l->tail);
    fprintf(out, ",\"size\":%zu", l->size);
    dump_nodes(out, offsetof(CListNode, value), -1, offsetof(CListNode, next));
    fputc('}', out);
}

/* ------------------------------------------------------- data structures */

typedef struct {
    char name[32];
    long args[2];
    int nargs;
} Op;

typedef struct {
    bool ok;
    bool has_value;
    int value;
    int values[MAX_LIST_VALUES];
    int nvalues;
} OpResult;

typedef enum {
    DS_ARRAY_STACK,
    DS_LINKED_STACK,
    DS_ARRAY_QUEUE,
    DS_CIRCULAR_QUEUE,
    DS_LINKED_QUEUE,
    DS_SLIST,
    DS_DLIST,
    DS_CLIST
} DsKind;

typedef struct {
    DsKind kind;
    ArrayStack array_stack;
    LinkedStack linked_stack;
    ArrayQueue array_queue;
    CircularQueue circular_queue;
    LinkedQueue linked_queue;
    SinglyLinkedList slist;
    DoublyLinkedList dlist;
    CircularLinkedList clist;
} Structure;

static int parse_ops(Op *ops) {
    char line[128];
    int count = 0;
    while (fgets(line, sizeof line, stdin) != NULL) {
        Op op = {0};
        int nread = sscanf(line, "%31s %ld %ld", op.name, &op.args[0], &op.args[1]);
        if (nread <= 0) {
            continue;
        }
        if (count == MAX_OPS) {
            fail("out_of_range", "too many operations (limit 256)");
        }
        op.nargs = nread - 1;
        for (int i = 0; i < op.nargs; i++) {
            if (op.args[i] < -VALUE_LIMIT || op.args[i] > VALUE_LIMIT) {
                fail("out_of_range", "operation argument must be between -1000000 and 1000000");
            }
        }
        ops[count++] = op;
    }
    return count;
}

static bool is_op(const Op *op, const char *name, int nargs) {
    if (strcmp(op->name, name) != 0) {
        return false;
    }
    if (op->nargs < nargs) {
        fail("invalid_input", "missing operation argument");
    }
    return true;
}

static bool apply_list_op(Structure *s, const Op *op, OpResult *r) {
    size_t cap = MAX_LIST_VALUES;
    long a0 = op->args[0];
    if (is_op(op, "insert_front", 1)) {
        r->ok = s->kind == DS_SLIST   ? slist_insert_front(&s->slist, (int)a0)
                : s->kind == DS_DLIST ? dlist_insert_front(&s->dlist, (int)a0)
                                      : clist_insert_front(&s->clist, (int)a0);
    } else if (is_op(op, "insert_back", 1)) {
        r->ok = s->kind == DS_SLIST   ? slist_insert_back(&s->slist, (int)a0)
                : s->kind == DS_DLIST ? dlist_insert_back(&s->dlist, (int)a0)
                                      : clist_insert_back(&s->clist, (int)a0);
    } else if (is_op(op, "insert_at", 2)) {
        if (a0 < 0) {
            r->ok = false;
            return true;
        }
        int v = (int)op->args[1];
        r->ok = s->kind == DS_SLIST   ? slist_insert_at(&s->slist, (size_t)a0, v)
                : s->kind == DS_DLIST ? dlist_insert_at(&s->dlist, (size_t)a0, v)
                                      : clist_insert_at(&s->clist, (size_t)a0, v);
    } else if (is_op(op, "remove", 1)) {
        r->ok = s->kind == DS_SLIST   ? slist_remove(&s->slist, (int)a0)
                : s->kind == DS_DLIST ? dlist_remove(&s->dlist, (int)a0)
                                      : clist_remove(&s->clist, (int)a0);
    } else if (is_op(op, "search", 1)) {
        r->value = s->kind == DS_SLIST   ? slist_search(&s->slist, (int)a0)
                   : s->kind == DS_DLIST ? dlist_search(&s->dlist, (int)a0)
                                         : clist_search(&s->clist, (int)a0);
        r->ok = r->value >= 0;
        r->has_value = true;
    } else if (is_op(op, "traverse", 0)) {
        size_t n = s->kind == DS_SLIST   ? slist_traverse(&s->slist, r->values, cap)
                   : s->kind == DS_DLIST ? dlist_traverse(&s->dlist, r->values, cap)
                                         : clist_traverse(&s->clist, r->values, cap);
        r->nvalues = (int)(n < cap ? n : cap);
        r->ok = true;
    } else if (s->kind == DS_DLIST && is_op(op, "traverse_backward", 0)) {
        size_t n = dlist_traverse_backward(&s->dlist, r->values, cap);
        r->nvalues = (int)(n < cap ? n : cap);
        r->ok = true;
    } else {
        return false;
    }
    return true;
}

static bool apply_op(Structure *s, const Op *op, OpResult *r) {
    int out = 0;
    long a0 = op->args[0];
    switch (s->kind) {
    case DS_ARRAY_STACK:
    case DS_LINKED_STACK: {
        bool linked = s->kind == DS_LINKED_STACK;
        if (is_op(op, "push", 1)) {
            r->ok = linked ? linked_stack_push(&s->linked_stack, (int)a0)
                           : array_stack_push(&s->array_stack, (int)a0);
        } else if (is_op(op, "pop", 0)) {
            r->ok = linked ? linked_stack_pop(&s->linked_stack, &out)
                           : array_stack_pop(&s->array_stack, &out);
            r->has_value = r->ok;
        } else if (is_op(op, "peek", 0)) {
            r->ok = linked ? linked_stack_peek(&s->linked_stack, &out)
                           : array_stack_peek(&s->array_stack, &out);
            r->has_value = r->ok;
        } else {
            return false;
        }
        r->value = out;
        return true;
    }
    case DS_ARRAY_QUEUE:
    case DS_CIRCULAR_QUEUE:
    case DS_LINKED_QUEUE: {
        DsKind k = s->kind;
        if (is_op(op, "enqueue", 1)) {
            r->ok = k == DS_ARRAY_QUEUE      ? array_queue_enqueue(&s->array_queue, (int)a0)
                    : k == DS_CIRCULAR_QUEUE ? circular_queue_enqueue(&s->circular_queue, (int)a0)
                                             : linked_queue_enqueue(&s->linked_queue, (int)a0);
        } else if (is_op(op, "dequeue", 0)) {
            r->ok = k == DS_ARRAY_QUEUE      ? array_queue_dequeue(&s->array_queue, &out)
                    : k == DS_CIRCULAR_QUEUE ? circular_queue_dequeue(&s->circular_queue, &out)
                                             : linked_queue_dequeue(&s->linked_queue, &out);
            r->has_value = r->ok;
        } else if (is_op(op, "front", 0)) {
            r->ok = k == DS_ARRAY_QUEUE      ? array_queue_front(&s->array_queue, &out)
                    : k == DS_CIRCULAR_QUEUE ? circular_queue_front(&s->circular_queue, &out)
                                             : linked_queue_front(&s->linked_queue, &out);
            r->has_value = r->ok;
        } else {
            return false;
        }
        r->value = out;
        return true;
    }
    default:
        return apply_list_op(s, op, r);
    }
}

static void emit_state_event(const char *prefix, AvStateDumper dumper, const void *ctx) {
    fputs(prefix, stdout);
    fputs(",\"state\":", stdout);
    dumper(stdout, ctx);
    fputs("}\n", stdout);
}

static int run_structure(DsKind kind, int trace_from) {
    static Structure s;
    static Op ops[MAX_OPS];
    AvStateDumper dumper = NULL;
    const void *ctx = NULL;
    s.kind = kind;

    switch (kind) {
    case DS_ARRAY_STACK: array_stack_init(&s.array_stack); dumper = dump_array_stack; ctx = &s.array_stack; break;
    case DS_LINKED_STACK: linked_stack_init(&s.linked_stack); dumper = dump_linked_stack; ctx = &s.linked_stack; break;
    case DS_ARRAY_QUEUE: array_queue_init(&s.array_queue); dumper = dump_array_queue; ctx = &s.array_queue; break;
    case DS_CIRCULAR_QUEUE: circular_queue_init(&s.circular_queue); dumper = dump_circular_queue; ctx = &s.circular_queue; break;
    case DS_LINKED_QUEUE: linked_queue_init(&s.linked_queue); dumper = dump_linked_queue; ctx = &s.linked_queue; break;
    case DS_SLIST: slist_init(&s.slist); dumper = dump_slist; ctx = &s.slist; break;
    case DS_DLIST: dlist_init(&s.dlist); dumper = dump_dlist; ctx = &s.dlist; break;
    case DS_CLIST: clist_init(&s.clist); dumper = dump_clist; ctx = &s.clist; break;
    }

    int nops = parse_ops(ops);
    if (trace_from < 0 || trace_from > nops) {
        trace_from = nops;
    }
    av_trace_set_dumper(dumper, ctx);
    av_trace_set_enabled(false);
    bool last_ok = true;
    bool fail_alloc = false;

    for (int i = 0; i < nops; i++) {
        const Op *op = &ops[i];
        bool traced = i >= trace_from;
        if (strcmp(op->name, "fail_next_alloc") == 0) {
            fail_alloc = true;
            continue;
        }
        char prefix[256];
        if (traced) {
            snprintf(prefix, sizeof prefix, "{\"t\":\"op\",\"line\":0,\"index\":%d,\"name\":\"%.31s\",\"args\":[", i, op->name);
            size_t len = strlen(prefix);
            for (int k = 0; k < op->nargs; k++) {
                len += (size_t)snprintf(prefix + len, sizeof prefix - len, "%s%ld", k ? "," : "", op->args[k]);
            }
            snprintf(prefix + len, sizeof prefix - len, "]");
            emit_state_event(prefix, dumper, ctx);
        }
        if (fail_alloc) {
            av_trace_fail_next_alloc();
            fail_alloc = false;
        }
        av_trace_set_enabled(traced);
        OpResult r = {0};
        if (!apply_op(&s, op, &r)) {
            av_trace_set_enabled(false);
            fail("invalid_input", "unknown operation for this structure");
        }
        av_trace_set_enabled(false);
        last_ok = r.ok;
        if (traced) {
            int len = snprintf(prefix, sizeof prefix, "{\"t\":\"op_end\",\"line\":0,\"index\":%d,\"name\":\"%.31s\",\"ok\":%s",
                               i, op->name, r.ok ? "true" : "false");
            if (r.has_value) {
                snprintf(prefix + len, sizeof prefix - (size_t)len, ",\"value\":%d", r.value);
            }
            fputs(prefix, stdout);
            if (r.nvalues > 0 || strncmp(op->name, "traverse", 8) == 0) {
                fputc(',', stdout);
                print_array("values", r.values, r.nvalues);
            }
            fputs(",\"state\":", stdout);
            dumper(stdout, ctx);
            fputs("}\n", stdout);
        }
    }

    print_end_prefix();
    printf("\"ops\":%d,\"lastOk\":%s,\"state\":", nops, last_ok ? "true" : "false");
    dumper(stdout, ctx);
    fputs("}}\n", stdout);

    switch (kind) {
    case DS_LINKED_STACK: linked_stack_destroy(&s.linked_stack); break;
    case DS_LINKED_QUEUE: linked_queue_destroy(&s.linked_queue); break;
    case DS_SLIST: slist_destroy(&s.slist); break;
    case DS_DLIST: dlist_destroy(&s.dlist); break;
    case DS_CLIST: clist_destroy(&s.clist); break;
    default: break;
    }
    return 0;
}

/* ------------------------------------------------------------------- main */

typedef struct {
    const char *id;
    int (*run)(const char *id);
    DsKind kind;
} Entry;

static const Entry entries[] = {
    {"bubble-sort", run_sort, 0},       {"selection-sort", run_sort, 0},
    {"insertion-sort", run_sort, 0},    {"merge-sort", run_sort, 0},
    {"quick-sort", run_sort, 0},        {"heap-sort", run_sort, 0},
    {"linear-search", run_search, 0},   {"binary-search", run_search, 0},
    {"factorial", run_recursion, 0},    {"fibonacci", run_recursion, 0},
    {"hanoi", run_recursion, 0},        {"array-stack", NULL, DS_ARRAY_STACK},
    {"linked-stack", NULL, DS_LINKED_STACK}, {"array-queue", NULL, DS_ARRAY_QUEUE},
    {"circular-queue", NULL, DS_CIRCULAR_QUEUE}, {"linked-queue", NULL, DS_LINKED_QUEUE},
    {"singly-linked-list", NULL, DS_SLIST}, {"doubly-linked-list", NULL, DS_DLIST},
    {"circular-linked-list", NULL, DS_CLIST},
};

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "usage: avlab <algorithm-id> [--trace-from K]\n");
        return 2;
    }
    disable_aslr(argv);
    av_trace_init();

    int trace_from = 0;
    for (int i = 2; i + 1 < argc; i += 2) {
        if (strcmp(argv[i], "--trace-from") == 0) {
            trace_from = atoi(argv[i + 1]);
        }
    }
    for (size_t i = 0; i < sizeof entries / sizeof entries[0]; i++) {
        if (strcmp(entries[i].id, argv[1]) == 0) {
            int rc = entries[i].run ? entries[i].run(argv[1]) : run_structure(entries[i].kind, trace_from);
            av_trace_finish();
            return rc;
        }
    }
    fail("unknown_algorithm", "unknown algorithm id");
    return 2;
}
