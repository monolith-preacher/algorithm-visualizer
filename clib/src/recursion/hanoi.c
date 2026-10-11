#include "av_trace.h"
#include "recursion.h"

bool towers_init(Towers *t, int n) {
    if (n < 1 || n > HANOI_MAX_DISKS) {
        return false;
    }
    for (int p = 0; p < 3; p++) {
        t->pegs[p].count = 0;
    }
    for (int disk = n; disk >= 1; disk--) {
        t->pegs[0].disks[t->pegs[0].count++] = disk;
    }
    t->moves = 0;
    t->illegal_move = false;
    return true;
}

static void move_disk(Towers *t, char from, char to) {
    Peg *src = &t->pegs[from - 'A'];
    Peg *dst = &t->pegs[to - 'A'];
    int disk = src->disks[src->count - 1];
    if (dst->count > 0 && dst->disks[dst->count - 1] < disk) {
        t->illegal_move = true;
    }
    src->count--;
    dst->disks[dst->count++] = disk;
    t->moves++;
}

void hanoi(Towers *t, int n, char from, char to, char via) {
    TRACE_ENTER(n, from, to, via);
    if (n == 1) {
        TRACE_MOVE(1, from, to);
        move_disk(t, from, to);
        return;
    }
    hanoi(t, n - 1, from, via, to);
    TRACE_MOVE(n, from, to);
    move_disk(t, from, to);
    hanoi(t, n - 1, via, to, from);
}
