/*
 * avrun - process supervisor executed inside the sandbox container.
 *
 * Usage: avrun --token T --cpu-sec N --wall-ms N --fsize-kb N -- program [args...]
 *
 * Applies resource limits, runs the target program in its own process group,
 * enforces a wall-clock timeout and, after the program terminates, writes a
 * single status record to stderr:
 *
 *     \x1e@@AVSTATUS:<token>:{"exitCode":0,"signal":null,...}\n
 *
 * The token is removed from this process' argv before the target starts, so
 * the program under test cannot read it from /proc and forge a status record.
 */
#define _GNU_SOURCE
#include <errno.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <sys/time.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

static volatile sig_atomic_t timed_out = 0;
static pid_t child_pid = -1;

static void on_alarm(int sig) {
    (void)sig;
    timed_out = 1;
    if (child_pid > 0) {
        kill(-child_pid, SIGKILL);
    }
}

static long parse_long(const char *s, const char *name) {
    char *end = NULL;
    errno = 0;
    long v = strtol(s, &end, 10);
    if (errno != 0 || end == s || *end != '\0' || v < 0) {
        fprintf(stderr, "avrun: invalid value for %s\n", name);
        exit(125);
    }
    return v;
}

static void set_limit(int resource, rlim_t soft, rlim_t hard) {
    struct rlimit rl = {soft, hard};
    if (setrlimit(resource, &rl) != 0) {
        perror("avrun: setrlimit");
        exit(125);
    }
}

static double elapsed_ms(const struct timespec *a, const struct timespec *b) {
    return (double)(b->tv_sec - a->tv_sec) * 1e3 + (double)(b->tv_nsec - a->tv_nsec) / 1e6;
}

int main(int argc, char **argv) {
    char token[65] = {0};
    long cpu_sec = 5, wall_ms = 10000, fsize_kb = 1024;
    int i = 1;

    for (; i < argc; i++) {
        if (strcmp(argv[i], "--") == 0) {
            i++;
            break;
        }
        if (i + 1 >= argc) {
            fprintf(stderr, "avrun: missing value for %s\n", argv[i]);
            return 125;
        }
        if (strcmp(argv[i], "--token") == 0) {
            snprintf(token, sizeof token, "%s", argv[i + 1]);
            memset(argv[i + 1], 0, strlen(argv[i + 1]));
        } else if (strcmp(argv[i], "--cpu-sec") == 0) {
            cpu_sec = parse_long(argv[i + 1], "--cpu-sec");
        } else if (strcmp(argv[i], "--wall-ms") == 0) {
            wall_ms = parse_long(argv[i + 1], "--wall-ms");
        } else if (strcmp(argv[i], "--fsize-kb") == 0) {
            fsize_kb = parse_long(argv[i + 1], "--fsize-kb");
        } else {
            fprintf(stderr, "avrun: unknown option %s\n", argv[i]);
            return 125;
        }
        i++;
    }
    if (i >= argc || token[0] == '\0') {
        fprintf(stderr, "avrun: usage: avrun --token T [limits] -- program [args]\n");
        return 125;
    }

    struct sigaction sa;
    memset(&sa, 0, sizeof sa);
    sa.sa_handler = on_alarm;
    sigaction(SIGALRM, &sa, NULL);

    struct timespec start, end;
    clock_gettime(CLOCK_MONOTONIC, &start);

    child_pid = fork();
    if (child_pid < 0) {
        perror("avrun: fork");
        return 125;
    }
    if (child_pid == 0) {
        setpgid(0, 0);
        set_limit(RLIMIT_CPU, (rlim_t)cpu_sec, (rlim_t)cpu_sec + 1);
        set_limit(RLIMIT_FSIZE, (rlim_t)fsize_kb * 1024, (rlim_t)fsize_kb * 1024);
        set_limit(RLIMIT_CORE, 0, 0);
        set_limit(RLIMIT_NOFILE, 64, 64);
        execv(argv[i], &argv[i]);
        fprintf(stderr, "avrun: cannot execute %s: %s\n", argv[i], strerror(errno));
        _exit(126);
    }
    setpgid(child_pid, child_pid);

    struct itimerval timer;
    memset(&timer, 0, sizeof timer);
    timer.it_value.tv_sec = wall_ms / 1000;
    timer.it_value.tv_usec = (wall_ms % 1000) * 1000;
    setitimer(ITIMER_REAL, &timer, NULL);

    int status = 0;
    struct rusage usage;
    memset(&usage, 0, sizeof usage);
    while (wait4(child_pid, &status, 0, &usage) < 0) {
        if (errno != EINTR) {
            perror("avrun: wait4");
            return 125;
        }
    }
    clock_gettime(CLOCK_MONOTONIC, &end);
    memset(&timer, 0, sizeof timer);
    setitimer(ITIMER_REAL, &timer, NULL);
    /* Reap anything the program left behind in its process group. */
    kill(-child_pid, SIGKILL);

    double cpu_ms = (double)usage.ru_utime.tv_sec * 1e3 + (double)usage.ru_utime.tv_usec / 1e3 +
                    (double)usage.ru_stime.tv_sec * 1e3 + (double)usage.ru_stime.tv_usec / 1e3;
    int exit_code = WIFEXITED(status) ? WEXITSTATUS(status) : -1;
    int sig = WIFSIGNALED(status) ? WTERMSIG(status) : 0;
    const char *reason = "exited";
    if (timed_out) {
        reason = "wall_timeout";
    } else if (sig == SIGXCPU || (sig == SIGKILL && cpu_ms >= (double)cpu_sec * 1e3)) {
        reason = "cpu_limit";
    } else if (sig == SIGXFSZ) {
        reason = "file_size_limit";
    } else if (sig != 0) {
        reason = "signal";
    }

    char sigbuf[32] = "null";
    if (sig != 0) {
        snprintf(sigbuf, sizeof sigbuf, "\"SIG%s\"", sigabbrev_np(sig) ? sigabbrev_np(sig) : "UNKNOWN");
    }
    fprintf(stderr,
            "\x1e@@AVSTATUS:%s:{\"reason\":\"%s\",\"exitCode\":%d,\"signal\":%s,"
            "\"wallMs\":%.3f,\"cpuMs\":%.3f,\"maxRssKb\":%ld}\n",
            token, reason, exit_code, sigbuf, elapsed_ms(&start, &end), cpu_ms, usage.ru_maxrss);
    return 0;
}
