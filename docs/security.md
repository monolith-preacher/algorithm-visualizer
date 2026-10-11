# Security model

The C Playground compiles and runs arbitrary code. That code — and the compiler and debugger processing it — only ever runs inside a disposable Docker container.

## Container isolation

Every compile, run and debug session uses a new container (`apps/server/src/sandbox/docker.ts`):

| Measure | Setting |
| --- | --- |
| Network | `--network none` |
| Filesystem | `--read-only` root; `/tmp` is a 64 MB `tmpfs` (`nosuid,nodev`); the workspace with the compiled binary is bind-mounted **read-only** at `/box` |
| User | `--user 65534:65534` (nobody) |
| Privileges | `--cap-drop ALL`, `--security-opt no-new-privileges`, Docker's default seccomp profile |
| Memory | `--memory` = `--memory-swap` = `AV_MEMORY_MB` (default 256 MB) |
| CPU | `--cpus 1`; per-process `RLIMIT_CPU` (`AV_CPU_SECONDS`, default 5 s) set by `avrun` |
| Processes | `--pids-limit` (`AV_PIDS`, default 64) |
| Files | `RLIMIT_FSIZE` 8 MB, `RLIMIT_NOFILE` 64 for the program, `core=0` |
| Time | runs: wall-clock limit enforced by `avrun` (`AV_WALL_SECONDS`, default 30 s) and again by the server (`docker kill`); debug sessions: `RLIMIT_CPU` of 30 s for every process and an idle timeout (`AV_DEBUG_IDLE_SECONDS`) |
| Output | the server stops the run or debug session when the program's output exceeds `AV_OUTPUT_KB` (default 256 KB) |
| Init | `--init` so signals and zombie processes are handled; `avrun` kills the program's process group on exit |
| Concurrency | at most `AV_MAX_SANDBOXES` containers at a time; one active operation per WebSocket connection |
| Cleanup | containers use `--rm` and the label `algoviz.sandbox=1`; leftovers are removed when the server starts and stops |

Debugging needs `ptrace` between GDB and its child inside the same container, which Docker's default seccomp profile allows; no extra capability (such as `SYS_PTRACE`) is granted.

## Process invocation

- No shell is ever used on the host: `docker`, `avlab` and `avbench` are spawned with argument vectors.
- The only shell inside the sandbox runs a constant script; compiler flags are passed as positional parameters and the source arrives on stdin.
- GDB expressions from the Console are validated (length, no control characters) and quoted as MI C-strings, so they cannot inject MI commands. They are evaluated by GDB inside the sandbox.
- `avrun` reports the exit status on stderr behind a random per-run token that is erased from its own `argv` before the user program starts, so a program cannot forge its status line.
- WebSocket upgrades are only accepted on `/ws/playground` and from the server's own origin or `AV_ALLOWED_ORIGINS`; messages are validated with zod and limited to 2 MB; sources to `AV_SOURCE_KB`.

## What is not protected against

This setup is intended for local use and as a base for a hardened deployment. Before exposing the Playground publicly, add at least:

- authentication, per-user quotas and rate limiting;
- a stricter seccomp profile (or gVisor `runsc`, Kata Containers, Firecracker) to reduce the kernel attack surface;
- rootless Docker or user-namespace remapping, and a dedicated host;
- disk quotas for the workspace directory and log monitoring;
- TLS termination and a reverse proxy with request limits.

The Docker socket is used by the server process only and is never exposed to user programs.
