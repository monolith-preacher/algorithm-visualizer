/*
 * Runtime of the trace instrumentation. Compiled only into the traced build
 * (AV_TRACE). Output: one JSON object per line on stdout.
 */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

/* This file implements the allocator hooks, so it must see the real ones. */
#include "av_trace.h"
#undef malloc
#undef calloc
#undef free

#define AV_MAX_FRAMES 256
#define AV_MAX_VARS 12
#define AV_MAX_ARRAYS 4
#define AV_MAX_BLOCKS 512
#define AV_DEFAULT_MAX_EVENTS 200000L

typedef struct {
    const char *name;
    const void *addr;
    AvType type;
} AvVar;

typedef struct {
    const char *fn;
    AvVar vars[AV_MAX_VARS];
    int nvars;
    bool has_return;
    int return_line;
    unsigned long long return_bits;
    AvType return_type;
} AvFrame;

typedef struct {
    const char *name;
    const int *ptr;
    int n;
} AvArray;

static AvFrame frames[AV_MAX_FRAMES];
static int depth = 0;
static AvArray arrays[AV_MAX_ARRAYS];
static int narrays = 0;
static AvBlock blocks[AV_MAX_BLOCKS];
static size_t nblocks = 0;
static unsigned next_block_id = 1;

static bool enabled = true;
static bool truncated = false;
static bool fail_next_alloc = false;
static long event_count = 0;
static long max_events = AV_DEFAULT_MAX_EVENTS;
static AvStateDumper dumper = NULL;
static const void *dumper_ctx = NULL;

void av_trace_init(void) {
    const char *limit = getenv("AV_MAX_EVENTS");
    if (limit != NULL) {
        long v = strtol(limit, NULL, 10);
        if (v > 0) {
            max_events = v;
        }
    }
    static char buffer[1 << 16];
    setvbuf(stdout, buffer, _IOFBF, sizeof buffer);
}

void av_trace_set_enabled(bool on) { enabled = on; }

void av_trace_set_dumper(AvStateDumper fn, const void *ctx) {
    dumper = fn;
    dumper_ctx = ctx;
}

void av_trace_fail_next_alloc(void) { fail_next_alloc = true; }

long av_trace_event_count(void) { return event_count; }

bool av_trace_truncated(void) { return truncated; }

void av_trace_finish(void) { fflush(stdout); }

size_t av_heap_block_count(void) { return nblocks; }

const AvBlock *av_heap_block_at(size_t index) { return index < nblocks ? &blocks[index] : NULL; }

const AvBlock *av_heap_find(const void *ptr) {
    for (size_t i = 0; i < nblocks; i++) {
        if (blocks[i].ptr == ptr) {
            return &blocks[i];
        }
    }
    return NULL;
}

void av_write_ptr(FILE *out, const void *ptr) {
    if (ptr == NULL) {
        fputs("null", out);
    } else {
        fprintf(out, "\"%p\"", ptr);
    }
}

static void write_value(FILE *out, const void *addr, AvType type) {
    switch (type) {
    case AV_BOOL: fputs(*(const _Bool *)addr ? "true" : "false", out); break;
    case AV_CHAR: {
        char c = *(const char *)addr;
        if (c >= 32 && c < 127 && c != '"' && c != '\\') {
            fprintf(out, "\"'%c'\"", c);
        } else {
            fprintf(out, "%d", (int)c);
        }
        break;
    }
    case AV_INT: fprintf(out, "%d", *(const int *)addr); break;
    case AV_UINT: fprintf(out, "%u", *(const unsigned *)addr); break;
    case AV_LONG: fprintf(out, "%ld", *(const long *)addr); break;
    case AV_ULONG: fprintf(out, "%lu", *(const unsigned long *)addr); break;
    case AV_LLONG: fprintf(out, "%lld", *(const long long *)addr); break;
    case AV_ULLONG: fprintf(out, "%llu", *(const unsigned long long *)addr); break;
    case AV_PTR: av_write_ptr(out, *(void *const *)addr); break;
    }
}

static void write_bits(FILE *out, unsigned long long bits, AvType type) {
    switch (type) {
    case AV_BOOL: fputs(bits ? "true" : "false", out); break;
    case AV_CHAR: {
        char c = (char)bits;
        _Bool printable = c >= 32 && c < 127 && c != '"' && c != '\\';
        if (printable) {
            fprintf(out, "\"'%c'\"", c);
        } else {
            fprintf(out, "%d", (int)c);
        }
        break;
    }
    case AV_INT:
    case AV_LONG:
    case AV_LLONG: fprintf(out, "%lld", (long long)bits); break;
    case AV_UINT:
    case AV_ULONG:
    case AV_ULLONG: fprintf(out, "%llu", bits); break;
    case AV_PTR: av_write_ptr(out, (const void *)(uintptr_t)bits); break;
    }
}

/* Starts an event record; returns false when the event must be dropped. */
static bool begin_event(const char *type, int line) {
    if (!enabled) {
        return false;
    }
    if (event_count >= max_events) {
        truncated = true;
        return false;
    }
    event_count++;
    fprintf(stdout, "{\"t\":\"%s\",\"line\":%d", type, line);
    return true;
}

static void write_vars(void) {
    fputs(",\"vars\":{", stdout);
    if (depth > 0 && depth <= AV_MAX_FRAMES) {
        const AvFrame *f = &frames[depth - 1];
        for (int i = 0; i < f->nvars; i++) {
            fprintf(stdout, "%s\"%s\":", i ? "," : "", f->vars[i].name);
            write_value(stdout, f->vars[i].addr, f->vars[i].type);
        }
    }
    fputc('}', stdout);
}

static void end_event(void) {
    write_vars();
    if (dumper != NULL) {
        fputs(",\"state\":", stdout);
        dumper(stdout, dumper_ctx);
    }
    fputs("}\n", stdout);
}

void av_emit_raw(const char *json) {
    fputs(json, stdout);
    fputc('\n', stdout);
}

int av_frame_enter(const char *fn) {
    int index = depth++;
    if (index < AV_MAX_FRAMES) {
        AvFrame *f = &frames[index];
        memset(f, 0, sizeof *f);
        f->fn = fn;
    } else {
        truncated = true;
    }
    return index;
}

void av_frame_leave(int *guard) {
    int index = *guard;
    if (index < AV_MAX_FRAMES && begin_event("return", 0)) {
        const AvFrame *f = &frames[index];
        fprintf(stdout, ",\"fn\":\"%s\"", f->fn);
        if (f->has_return) {
            fprintf(stdout, ",\"retLine\":%d,\"value\":", f->return_line);
            write_bits(stdout, f->return_bits, f->return_type);
        }
        end_event();
    }
    depth = index;
}

void av_watch(const char *name, const void *addr, AvType type) {
    if (depth == 0 || depth > AV_MAX_FRAMES) {
        return;
    }
    AvFrame *f = &frames[depth - 1];
    for (int i = 0; i < f->nvars; i++) {
        if (strcmp(f->vars[i].name, name) == 0) {
            f->vars[i].addr = addr;
            f->vars[i].type = type;
            return;
        }
    }
    if (f->nvars < AV_MAX_VARS) {
        f->vars[f->nvars++] = (AvVar){name, addr, type};
    }
}

void av_frame_return(int line, unsigned long long bits, AvType type) {
    if (depth == 0 || depth > AV_MAX_FRAMES) {
        return;
    }
    AvFrame *f = &frames[depth - 1];
    f->has_return = true;
    f->return_line = line;
    f->return_bits = bits;
    f->return_type = type;
}

void av_ev_call(int line) {
    if (depth > AV_MAX_FRAMES || !begin_event("call", line)) {
        return;
    }
    fprintf(stdout, ",\"fn\":\"%s\",\"depth\":%d", frames[depth - 1].fn, depth);
    end_event();
}

void av_ev_step(int line) {
    if (begin_event("step", line)) {
        end_event();
    }
}

static const char *array_name(const int *arr) {
    for (int i = 0; i < narrays; i++) {
        if (arrays[i].ptr == arr) {
            return arrays[i].name;
        }
    }
    return "?";
}

void av_register_array(const char *name, const int *arr, int n, bool initialized) {
    int slot = narrays;
    for (int i = 0; i < narrays; i++) {
        if (strcmp(arrays[i].name, name) == 0) {
            slot = i;
        }
    }
    if (slot == AV_MAX_ARRAYS) {
        return;
    }
    arrays[slot] = (AvArray){name, arr, n};
    if (slot == narrays) {
        narrays++;
    }
    if (!enabled) {
        return;
    }
    fprintf(stdout, "{\"t\":\"array\",\"line\":0,\"name\":\"%s\",\"n\":%d,\"values\":", name, n);
    if (initialized) {
        fputc('[', stdout);
        for (int i = 0; i < n; i++) {
            fprintf(stdout, "%s%d", i ? "," : "", arr[i]);
        }
        fputc(']', stdout);
    } else {
        fputs("null", stdout);
    }
    fputs("}\n", stdout);
}

void av_ev_compare(int line, const int *arr, int i, int j) {
    if (begin_event("compare", line)) {
        fprintf(stdout, ",\"arr\":\"%s\",\"i\":%d,\"j\":%d,\"vi\":%d,\"vj\":%d", array_name(arr), i,
                j, arr[i], arr[j]);
        end_event();
    }
}

void av_ev_compare_value(int line, const int *arr, int i, long long value, const char *expr) {
    if (begin_event("compare_value", line)) {
        fprintf(stdout, ",\"arr\":\"%s\",\"i\":%d,\"vi\":%d,\"value\":%lld,\"expr\":\"%s\"",
                array_name(arr), i, arr[i], value, expr);
        end_event();
    }
}

void av_ev_swap(int line, const int *arr, int i, int j) {
    if (begin_event("swap", line)) {
        fprintf(stdout, ",\"arr\":\"%s\",\"i\":%d,\"j\":%d", array_name(arr), i, j);
        end_event();
    }
}

void av_ev_write(int line, const int *arr, int i, long long value) {
    if (begin_event("write", line)) {
        fprintf(stdout, ",\"arr\":\"%s\",\"i\":%d,\"value\":%lld", array_name(arr), i, value);
        end_event();
    }
}

void av_ev_copy(int line, const int *dst, int i, const int *src, int j) {
    if (begin_event("copy", line)) {
        fprintf(stdout, ",\"arr\":\"%s\",\"i\":%d,\"src\":\"%s\",\"j\":%d,\"value\":%d",
                array_name(dst), i, array_name(src), j, src[j]);
        end_event();
    }
}

void av_ev_mark(const char *kind, int i) {
    if (begin_event("mark", 0)) {
        fprintf(stdout, ",\"kind\":\"%s\",\"i\":%d}\n", kind, i);
    }
}

void av_ev_range(int lo, int hi) {
    if (begin_event("range", 0)) {
        fprintf(stdout, ",\"lo\":%d,\"hi\":%d}\n", lo, hi);
    }
}

void av_ev_move(int line, int disk, char from, char to) {
    if (begin_event("move", line)) {
        fprintf(stdout, ",\"disk\":%d,\"from\":\"%c\",\"to\":\"%c\"", disk, from, to);
        end_event();
    }
}

/*
 * Allocation events carry the snapshot taken *before* the allocator runs, like
 * every other event: the new block becomes visible in the following step.
 */
void *av_malloc(size_t size, int line) {
    if (begin_event("alloc", line)) {
        fprintf(stdout, ",\"size\":%zu,\"failed\":%s", size, fail_next_alloc ? "true" : "false");
        end_event();
    }
    if (fail_next_alloc) {
        fail_next_alloc = false;
        return NULL;
    }
    void *ptr = malloc(size);
    if (ptr != NULL && nblocks < AV_MAX_BLOCKS) {
        blocks[nblocks++] = (AvBlock){next_block_id++, ptr, size, line};
    }
    return ptr;
}

void *av_calloc(size_t count, size_t size, int line) {
    if (size != 0 && count > SIZE_MAX / size) {
        return NULL;
    }
    void *ptr = av_malloc(count * size, line);
    if (ptr != NULL) {
        memset(ptr, 0, count * size);
    }
    return ptr;
}

void av_free(void *ptr, int line) {
    if (ptr == NULL) {
        return;
    }
    const AvBlock *block = av_heap_find(ptr);
    if (begin_event("free", line)) {
        fprintf(stdout, ",\"id\":%u,\"addr\":", block ? block->id : 0u);
        av_write_ptr(stdout, ptr);
        end_event();
    }
    if (block != NULL) {
        size_t index = (size_t)(block - blocks);
        memmove(&blocks[index], &blocks[index + 1], (nblocks - index - 1) * sizeof blocks[0]);
        nblocks--;
    }
    free(ptr);
}
