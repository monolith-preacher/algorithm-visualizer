# Architecture

## Packages

| Path | Responsibility |
| --- | --- |
| `clib/` | C implementations, trace runtime, drivers (`avlab`, `avbench`) and C unit tests. Built with `make`. |
| `sandbox/` | Docker image for user programs: GCC, GDB, `avrun` (process supervisor) and `avrt` (runtime object linked into user programs). |
| `packages/shared/` | Code used by both server and client: algorithm catalog, REST/WebSocket protocol types, trace parsing and step models. Consumed as TypeScript source (no build step). |
| `apps/server/` | Node.js (Express 5 + ws). Lab runner, sandbox orchestration, compiler, executor, GDB/MI client and inspector, WebSocket sessions. |
| `apps/web/` | React 19 + Vite + Tailwind CSS 4. Algorithm Lab (visualizers, player, code view) and C Playground (Monaco, terminal, debugger panels). State: React state for the Lab, Zustand stores for the Playground (files persisted in localStorage). |

## Algorithm Lab request flow

1. The client loads the algorithm source (`GET /api/lab/sources/:id`) and analyzes it (`analyzeSource`) to know which lines are instrumentation and where functions start and end.
2. Changing the input posts `POST /api/lab/trace { algorithm, input, traceFrom? }`. The server validates it (zod), spawns `clib/build/avlab` without a shell, with a 10 s timeout and a 64 MB output cap, and returns the parsed events. Driver errors (invalid input, unsorted array for binary search) become HTTP 422 with a message.
3. `buildTrace` turns events into steps; `usePlayer` walks through them.
4. For sorting and searching, `POST /api/lab/bench` runs `clib/build/avbench`, the same algorithm compiled with `-O2` and no instrumentation, in batches until ~30 ms of samples are collected; the median per run is displayed as CPU time.

The Lab binaries only execute the repository's own C code on validated numeric input, so they run as plain child processes. User code never runs outside the sandbox.

## Playground flow

Each browser tab opens `ws://…/ws/playground`. A `PlaygroundSession` owns at most one operation at a time:

```
compile ─► docker run sandbox: sh -c 'cat > /tmp/main.c && cd /tmp && gcc … 1>&2 && cat /tmp/prog'
            stdin = source, stderr = diagnostics, stdout = binary → workspace/prog
run     ─► docker run --mount workspace:/box:ro sandbox /opt/av/avrun --token T … -- /box/prog
            stdin/stdout/stderr streamed over the WebSocket; avrun reports exit status
debug   ─► docker run --mount workspace:/box:ro sandbox gdb --interpreter=mi3 /box/prog-debug
            GDB/MI on stdout, program output on stderr (run with "1>&2 < /box/stdin.txt")
```

### Compile modes

| Mode | Flags |
| --- | --- |
| Run | `-std=gnu17 -Wall -Wextra -g -O2`, plus `avrt.o` (unbuffered stdout) and `-lm` |
| Run + sanitizers | `-g -O1 -fsanitize=address,undefined -fno-omit-frame-pointer` |
| Debug | `-g -O0 -fno-omit-frame-pointer`, `avrt_debug.o`, `-Wl,--wrap=malloc,--wrap=free,--wrap=calloc,--wrap=realloc` |

### Debugger

- `apps/server/src/debugger/mi.ts` parses GDB/MI records (tuples, lists, C-string escapes including octal UTF-8 bytes).
- `gdb.ts` sends tokenized commands one at a time and dispatches async records (`*stopped`, `*running`).
- `session.ts` maps UI commands to `-exec-step`, `-exec-next`, `-exec-finish`, `-exec-continue`, `-exec-interrupt`; keeps breakpoints in sync (`-break-insert main.c:N` reports the line GDB actually resolved); handles exits (GDB reports exit codes in octal) and signals; closes idle sessions.
- `inspector.ts` builds a `DebugSnapshot` at every stop:
  - frames: `-stack-list-frames`; variables: `-stack-list-variables` + variable objects (`-var-create`, `-var-list-children`) for structs, arrays and one level of pointer dereference; addresses and sizes via `&(expr)` / `sizeof(expr)`; unreadable pointers are detected with a 1-byte memory read;
  - globals of `main.c`: `-symbol-info-variables`;
  - heap: raw read of `av_heap_table` (address, size, live/freed) maintained by the `__wrap_malloc` family in `sandbox/avrt.c` — only allocations made by user code are recorded;
  - typed heap views: a live block whose start address is held by a `T *` is displayed as `T[size / sizeof(T)]` (or `T`), recursively following pointers found in those views;
  - regions: `info proc mappings` (stack, heap, program data/text).
  All variable objects are deleted after each snapshot.

The Memory panel draws an arrow from every pointer to the most specific element (array cell, variable, heap block) whose `[start, end)` range contains the pointer value; pointers into freed blocks are drawn as dangling.

## Extending the Lab

1. Write the C implementation under `clib/src/<module>/`, instrument it with `TRACE_*` lines, add unit tests under `clib/tests/`.
2. Add a dispatch entry in `clib/driver/avlab.c` (and `avbench.c` for timed algorithms).
3. Add a catalog entry in `packages/shared/src/catalog.ts` (module, files, visual kind, complexity, notes).
4. Reuse an existing visual kind, or add a step model in `packages/shared/src/trace` and a visualizer in `apps/web/src/lab/visual`.
