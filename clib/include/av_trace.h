/*
 * av_trace.h - execution-trace instrumentation for the Algorithm Lab.
 *
 * The algorithms in clib/src are plain C. Visualization events are emitted by
 * the TRACE_* macros below, which always occupy a line of their own so the UI
 * can hide them and show the algorithm exactly as it is written. A trace
 * statement always refers to the code line directly below it.
 *
 * When compiled without AV_TRACE every macro expands to nothing, producing the
 * uninstrumented build used for timing measurements and sanitizer tests.
 *
 * With AV_TRACE defined:
 *   - events are written to stdout as JSON lines (see docs/trace-format.md);
 *   - malloc/free are routed through av_malloc/av_free so that the Lab can
 *     show real heap blocks. Include this header after <stdlib.h>.
 *
 * Only function-scope variables may be passed to TRACE_WATCH / TRACE_ENTER:
 * the trace layer keeps their addresses until the function returns.
 */
#ifndef AV_TRACE_H
#define AV_TRACE_H

#include <stdbool.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>

#ifdef AV_TRACE

typedef enum {
    AV_BOOL,
    AV_CHAR,
    AV_INT,
    AV_UINT,
    AV_LONG,
    AV_ULONG,
    AV_LLONG,
    AV_ULLONG,
    AV_PTR
} AvType;

#define AV_TYPE_OF(x)                                                                              \
    _Generic((x),                                                                                  \
        _Bool: AV_BOOL,                                                                            \
        char: AV_CHAR,                                                                             \
        int: AV_INT,                                                                               \
        unsigned int: AV_UINT,                                                                     \
        long: AV_LONG,                                                                             \
        unsigned long: AV_ULONG,                                                                   \
        long long: AV_LLONG,                                                                       \
        unsigned long long: AV_ULLONG,                                                             \
        default: AV_PTR)

typedef struct {
    unsigned id;
    void *ptr;
    size_t size;
    int line;
} AvBlock;

typedef void (*AvStateDumper)(FILE *out, const void *ctx);

/* Session control (used by the driver, never by the algorithms). */
void av_trace_init(void);
void av_trace_set_enabled(bool enabled);
void av_trace_set_dumper(AvStateDumper dumper, const void *ctx);
void av_trace_fail_next_alloc(void);
void av_trace_finish(void);
long av_trace_event_count(void);
bool av_trace_truncated(void);
void av_emit_raw(const char *json);
size_t av_heap_block_count(void);
const AvBlock *av_heap_block_at(size_t index);
const AvBlock *av_heap_find(const void *ptr);
void av_write_ptr(FILE *out, const void *ptr);

/* Instrumentation entry points (reached through the TRACE_* macros). */
int av_frame_enter(const char *fn);
void av_frame_leave(int *guard);
void av_watch(const char *name, const void *addr, AvType type);
void av_frame_return(int line, unsigned long long bits, AvType type);
void av_ev_call(int line);
void av_ev_step(int line);
void av_ev_compare(int line, const int *arr, int i, int j);
void av_ev_compare_value(int line, const int *arr, int i, long long value, const char *expr);
void av_ev_swap(int line, const int *arr, int i, int j);
void av_ev_write(int line, const int *arr, int i, long long value);
void av_ev_copy(int line, const int *dst, int i, const int *src, int j);
void av_ev_mark(const char *kind, int i);
void av_ev_range(int lo, int hi);
void av_ev_move(int line, int disk, char from, char to);
void av_register_array(const char *name, const int *arr, int n, bool initialized);
void *av_malloc(size_t size, int line);
void *av_calloc(size_t count, size_t size, int line);
void av_free(void *ptr, int line);

#define AV_NARGS(...) AV_NARGS_(__VA_ARGS__, 6, 5, 4, 3, 2, 1, 0)
#define AV_NARGS_(_1, _2, _3, _4, _5, _6, N, ...) N
#define AV_CAT(a, b) AV_CAT_(a, b)
#define AV_CAT_(a, b) a##b

#define AV_WATCH_1(x) av_watch(#x, &(x), AV_TYPE_OF(x))
#define AV_WATCH_2(x, ...) AV_WATCH_1(x), AV_WATCH_1(__VA_ARGS__)
#define AV_WATCH_3(x, ...) AV_WATCH_1(x), AV_WATCH_2(__VA_ARGS__)
#define AV_WATCH_4(x, ...) AV_WATCH_1(x), AV_WATCH_3(__VA_ARGS__)
#define AV_WATCH_5(x, ...) AV_WATCH_1(x), AV_WATCH_4(__VA_ARGS__)
#define AV_WATCH_6(x, ...) AV_WATCH_1(x), AV_WATCH_5(__VA_ARGS__)

/* Opens a call frame for the current function and records its parameters. */
#define TRACE_ENTER(...)                                                                           \
    int av_frame_guard_ __attribute__((cleanup(av_frame_leave), unused)) =                       \
        av_frame_enter(__func__);                                                                  \
    AV_CAT(AV_WATCH_, AV_NARGS(__VA_ARGS__))(__VA_ARGS__);                                         \
    av_ev_call(__LINE__)
/* Adds local variables to the current frame's watch list. */
#define TRACE_WATCH(...) AV_CAT(AV_WATCH_, AV_NARGS(__VA_ARGS__))(__VA_ARGS__)
/* Records the value returned by the next line (a return statement). */
#define TRACE_RETURN(v) av_frame_return(__LINE__, (unsigned long long)(v), AV_TYPE_OF(v))
/* Marks a source line as an execution step (with a structure snapshot). */
#define TRACE_STEP() av_ev_step(__LINE__)
#define TRACE_COMPARE(arr, i, j) av_ev_compare(__LINE__, (arr), (i), (j))
#define TRACE_COMPARE_VALUE(arr, i, v) av_ev_compare_value(__LINE__, (arr), (i), (v), #v)
#define TRACE_SWAP(arr, i, j) av_ev_swap(__LINE__, (arr), (i), (j))
#define TRACE_WRITE(arr, i, v) av_ev_write(__LINE__, (arr), (i), (v))
#define TRACE_COPY(dst, i, src, j) av_ev_copy(__LINE__, (dst), (i), (src), (j))
#define TRACE_ARRAY(arr, n) av_register_array(#arr, (arr), (n), true)
#define TRACE_ARRAY_UNINIT(arr, n) av_register_array(#arr, (arr), (n), false)
/* Annotations: they change visual state but are not execution steps. */
#define TRACE_MARK(kind, i) av_ev_mark((kind), (i))
#define TRACE_MARK_IF(cond, kind, i) ((cond) ? av_ev_mark((kind), (i)) : (void)0)
#define TRACE_RANGE(lo, hi) av_ev_range((lo), (hi))
#define TRACE_MOVE(disk, from, to) av_ev_move(__LINE__, (disk), (from), (to))

#define malloc(size) av_malloc((size), __LINE__)
#define calloc(count, size) av_calloc((count), (size), __LINE__)
#define free(ptr) av_free((ptr), __LINE__)

#else /* !AV_TRACE */

#define TRACE_ENTER(...) ((void)0)
#define TRACE_WATCH(...) ((void)0)
#define TRACE_RETURN(v) ((void)0)
#define TRACE_STEP() ((void)0)
#define TRACE_COMPARE(arr, i, j) ((void)0)
#define TRACE_COMPARE_VALUE(arr, i, v) ((void)0)
#define TRACE_SWAP(arr, i, j) ((void)0)
#define TRACE_WRITE(arr, i, v) ((void)0)
#define TRACE_COPY(dst, i, src, j) ((void)0)
#define TRACE_ARRAY(arr, n) ((void)0)
#define TRACE_ARRAY_UNINIT(arr, n) ((void)0)
#define TRACE_MARK(kind, i) ((void)0)
#define TRACE_MARK_IF(cond, kind, i) ((void)0)
#define TRACE_RANGE(lo, hi) ((void)0)
#define TRACE_MOVE(disk, from, to) ((void)0)

#endif /* AV_TRACE */

#endif /* AV_TRACE_H */
