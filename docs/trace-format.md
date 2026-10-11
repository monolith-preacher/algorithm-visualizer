# Trace format

The Algorithm Lab never re-implements an algorithm in JavaScript. Each visualization is a replay of the events emitted by the C implementation in `clib/src`, compiled with `-DAV_TRACE` into `clib/build/avlab`.

## Instrumenting an algorithm

Instrumentation is written with the macros of [`clib/include/av_trace.h`](../clib/include/av_trace.h). Rules:

1. A `TRACE_*` statement occupies a whole line. The UI hides these lines in the default view and refers every event to the **first code line below it**.
2. Only function-scope variables are passed to `TRACE_ENTER` / `TRACE_WATCH` (their addresses are read until the function returns).
3. Without `AV_TRACE` every macro expands to `((void)0)`; that build is used for timing (`avbench`) and for the sanitizer unit tests, so the algorithm must not depend on the instrumentation.

| Macro | Event | Meaning |
| --- | --- | --- |
| `TRACE_ENTER(params…)` | `call` | Opens a frame for `__func__`, watches the parameters; a `return` event is emitted automatically when the function exits (GCC `cleanup` attribute). |
| `TRACE_WATCH(vars…)` | — | Adds locals to the frame's watch list; their current values are attached to every event. |
| `TRACE_RETURN(v)` | — | Records the value returned by the next line (included in the `return` event). |
| `TRACE_COMPARE(arr, i, j)` | `compare` | `arr[i]` is compared with `arr[j]`. |
| `TRACE_COMPARE_VALUE(arr, i, v)` | `compare_value` | `arr[i]` is compared with a value; the C expression (`key`, `target`) is recorded. |
| `TRACE_SWAP(arr, i, j)` | `swap` | Elements are exchanged. |
| `TRACE_WRITE(arr, i, v)` | `write` | `arr[i] = v`. |
| `TRACE_COPY(dst, i, src, j)` | `copy` | `dst[i] = src[j]` (merge buffer, insertion-sort shifts). |
| `TRACE_ARRAY(arr, n)` / `TRACE_ARRAY_UNINIT` | `array` | Registers an array (initial contents, or unknown for a fresh `malloc` buffer). |
| `TRACE_MARK(kind, i)` / `TRACE_MARK_IF(cond, kind, i)` | `mark` | Annotation: `sorted`, `pivot`, `min`, `key`. |
| `TRACE_RANGE(lo, hi)` | `range` | Annotation: active sub-range of the current frame. |
| `TRACE_MOVE(disk, from, to)` | `move` | Towers of Hanoi move. |
| `TRACE_STEP()` | `step` | Execution reaches the next line (data structures). |
| `malloc` / `calloc` / `free` | `alloc` / `free` | Redirected by the header to the trace runtime, which keeps a registry of live heap blocks. |

## Event stream

`avlab <algorithm-id> [--trace-from K]` reads its input from stdin and writes one JSON object per line:

```json
{"t":"array","line":0,"name":"a","n":4,"values":[5,3,9,1]}
{"t":"call","line":7,"fn":"bubble_sort","depth":1,"vars":{"n":4}}
{"t":"compare","line":15,"arr":"a","i":0,"j":1,"vi":5,"vj":3,"vars":{"n":4,"pass":0,"j":0,"swapped":false}}
{"t":"swap","line":17,"arr":"a","i":0,"j":1,"vars":{"n":4,"pass":0,"j":0,"swapped":false}}
{"t":"mark","line":0,"kind":"sorted","i":3}
{"t":"return","line":0,"fn":"bubble_sort","vars":{…}}
{"t":"end","events":12,"truncated":false,"result":{"array":[1,3,5,9],"status":0,"sorted":true}}
```

Common fields: `t` (type), `line` (source line of the trace statement, `0` for annotations and driver events), `vars` (watched variables of the innermost frame: numbers, booleans, `"'A'"` for chars, `"0x…"` for pointers, `null` for `NULL`) and, for data structures and Hanoi, `state` (a snapshot of the structure read from memory **before** the line runs).

Data-structure input is a list of operations (`push 5`, `insert_at 2 7`, `fail_next_alloc`, …). Every request replays all operations from an empty structure, but only those from index `K` on are traced; the driver disables address-space randomization (`personality(2)`) so the replayed heap addresses are identical between requests. `op` / `op_end` events delimit each traced operation and carry its result.

## From events to steps

`packages/shared/src/trace` converts the stream into immutable steps:

- **Arrays** (`array-model.ts`): operation events apply their effect in their own step (a `swap` step shows the swapped bars); annotations change the state from the next step on. Element identities follow swaps so bars move instead of changing height. Counters are incremented per event; a swap counts as two writes. After the `end` event the replayed array is compared with the array reported by C (`consistent`).
- **Recursion** (`recursion-model.ts`): `call`/`return` events build a call tree (each node knows the step at which it was called and returned) and the call stack; Hanoi steps carry the peg arrays.
- **Structures** (`structure-model.ts`): debugger semantics — the highlighted line is the next one to execute and the state is the memory at that moment. New heap blocks, blocks being freed and failed allocations are flagged.

Stepping backwards simply displays an earlier step of this list.
