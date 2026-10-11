#ifndef RECURSION_H
#define RECURSION_H

#include <stdbool.h>

#define HANOI_MAX_DISKS 10

unsigned long long factorial(int n);
long long fibonacci(int n);

typedef struct {
    int disks[HANOI_MAX_DISKS]; /* disks[0] is the bottom disk */
    int count;
} Peg;

typedef struct {
    Peg pegs[3]; /* pegs 'A', 'B' and 'C' */
    int moves;
    bool illegal_move;
} Towers;

/* Places disks n..1 on peg 'A'. Returns false if n is out of range. */
bool towers_init(Towers *t, int n);
void hanoi(Towers *t, int n, char from, char to, char via);

#endif
