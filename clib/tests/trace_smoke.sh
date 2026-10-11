#!/bin/sh
# Runs every Lab algorithm through the sanitizer-instrumented trace driver.
# Any ASan/UBSan/LSan report aborts with a non-zero status.
set -eu
AVLAB="$1"
export ASAN_OPTIONS=detect_leaks=1:abort_on_error=0
run() {
    id="$1"; shift
    if ! printf "$@" | "$AVLAB" "$id" > /dev/null; then
        echo "trace-smoke: $id failed" >&2
        exit 1
    fi
}
for sort in bubble-sort selection-sort insertion-sort merge-sort quick-sort heap-sort; do
    run "$sort" "12 5 3 9 1 5 7 2 6 0 -4 11 3"
    run "$sort" "0"
    run "$sort" "1 7"
done
run linear-search "6 4 8 15 16 23 42 23"
run linear-search "3 1 2 3 9"
run binary-search "6 4 8 15 16 23 42 23"
run binary-search "6 4 8 15 16 23 42 5"
run factorial "10"
run fibonacci "8"
run hanoi "4"
run array-stack "push 1\npush 2\npop\npeek\npop\npop\n"
run linked-stack "push 1\npush 2\nfail_next_alloc\npush 3\npop\npeek\npop\npop\n"
run array-queue "enqueue 1\nenqueue 2\ndequeue\nfront\ndequeue\ndequeue\n"
run circular-queue "enqueue 1\nenqueue 2\nenqueue 3\nenqueue 4\nenqueue 5\nenqueue 6\nenqueue 7\nenqueue 8\ndequeue\nenqueue 9\nfront\n"
run linked-queue "enqueue 1\nenqueue 2\ndequeue\nfail_next_alloc\nenqueue 3\nfront\ndequeue\ndequeue\n"
for list in singly-linked-list doubly-linked-list circular-linked-list; do
    run "$list" "insert_back 1\ninsert_front 0\ninsert_at 1 5\ninsert_at 9 9\nsearch 5\ntraverse\nremove 5\nremove 0\nremove 1\nremove 7\nfail_next_alloc\ninsert_back 3\ninsert_back 4\n"
done
run doubly-linked-list "insert_back 1\ninsert_back 2\ntraverse_backward\n"
echo "trace-smoke: all algorithms traced cleanly under sanitizers"
