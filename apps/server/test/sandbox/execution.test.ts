import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Workspace } from '../../src/sandbox/workspace';
import { compileAndRun, enabled, sandboxReady, testConfig, Workspaces } from './helpers';

const config = testConfig();
const workspaces = new Workspaces(config.workDir);
let workspace: Workspace;

describe.runIf(enabled)('sandboxed compilation and execution', () => {
  beforeAll(async () => {
    expect(await sandboxReady(config)).toBe(true);
    await workspaces.init();
    workspace = await workspaces.create();
  });
  afterAll(async () => {
    await workspace?.dispose();
  });

  it('reports GCC errors with their line numbers', async () => {
    const r = await compileAndRun(config, workspace, 'int main(void) {\n  int x = ;\n  return 0;\n}\n');
    expect(r.compile.ok).toBe(false);
    expect(r.exit).toBeNull();
    expect(r.compile.diagnostics.some((d) => d.severity === 'error' && d.line === 2)).toBe(true);
    expect(r.compile.output).toContain('expected expression');
  });

  it('reports warnings without failing', async () => {
    const r = await compileAndRun(config, workspace, '#include <stdio.h>\nint main(void) {\n  int unused;\n  puts("ok");\n  return 0;\n}\n');
    expect(r.compile.ok).toBe(true);
    expect(r.compile.diagnostics.some((d) => d.severity === 'warning' && d.line === 3)).toBe(true);
    expect(r.stdout).toBe('ok\n');
  });

  it('runs a program and reports its exit code and resource usage', async () => {
    const r = await compileAndRun(config, workspace, '#include <stdio.h>\nint main(void) { printf("hello\\n"); fprintf(stderr, "err\\n"); return 3; }\n');
    expect(r.stdout).toBe('hello\n');
    expect(r.stderr).toBe('err\n');
    expect(r.exit?.reason).toBe('exited');
    expect(r.exit?.exitCode).toBe(3);
    expect(r.exit?.cpuMs).toBeGreaterThanOrEqual(0);
  });

  it('feeds stdin to the program', async () => {
    const code = '#include <stdio.h>\nint main(void) { int a, b; if (scanf("%d %d", &a, &b) != 2) return 1; printf("%d\\n", a + b); return 0; }\n';
    const r = await compileAndRun(config, workspace, code, '20 22\n');
    expect(r.stdout).toBe('42\n');
  });

  it('reports a segmentation fault', async () => {
    const r = await compileAndRun(config, workspace, 'int main(void) { volatile int *p = 0; *p = 1; return 0; }\n');
    expect(r.exit?.reason).toBe('signal');
    expect(r.exit?.signal).toBe('SIGSEGV');
    expect(r.exit?.message).toContain('Segmentation fault');
  });

  it('reports integer division by zero', async () => {
    const code = '#include <stdio.h>\nint main(void) { int a, b; scanf("%d %d", &a, &b); printf("%d\\n", a / b); return 0; }\n';
    const r = await compileAndRun(config, workspace, code, '7 0\n');
    expect(r.exit?.signal).toBe('SIGFPE');
    expect(r.exit?.message).toContain('division by zero');
  });

  it('stops infinite loops at the CPU limit', async () => {
    const r = await compileAndRun(config, workspace, 'int main(void) { volatile unsigned long x = 0; for (;;) x++; }\n');
    expect(r.exit?.reason).toBe('cpu_limit');
  });

  it('stops programs blocked past the wall-clock limit', async () => {
    const r = await compileAndRun(config, workspace, '#include <unistd.h>\nint main(void) { sleep(60); return 0; }\n');
    expect(r.exit?.reason).toBe('wall_timeout');
  });

  it('stops programs that exceed the output limit', async () => {
    const r = await compileAndRun(config, workspace, '#include <stdio.h>\nint main(void) { for (;;) puts("flood flood flood flood"); }\n');
    expect(r.exit?.reason).toBe('output_limit');
    expect(r.stdout.length).toBeLessThanOrEqual(config.limits.outputKb * 1024);
  });

  it('limits the number of processes', async () => {
    const code = `#include <stdio.h>
#include <unistd.h>
#include <sys/wait.h>
int main(void) {
  int created = 0;
  for (int i = 0; i < 500; i++) { pid_t p = fork(); if (p == 0) { sleep(3); _exit(0); } if (p < 0) break; created++; }
  printf("%d\\n", created);
  return 0;
}
`;
    const r = await compileAndRun(config, workspace, code);
    expect(Number(r.stdout.trim())).toBeLessThan(config.limits.pids);
  });

  it('has no network access', async () => {
    const code = `#include <stdio.h>
#include <string.h>
#include <arpa/inet.h>
#include <sys/socket.h>
int main(void) {
  int s = socket(AF_INET, SOCK_STREAM, 0);
  struct sockaddr_in a; memset(&a, 0, sizeof a); a.sin_family = AF_INET; a.sin_port = htons(53);
  inet_pton(AF_INET, "1.1.1.1", &a.sin_addr);
  printf("%s\\n", connect(s, (struct sockaddr *)&a, sizeof a) == 0 ? "connected" : "blocked");
  return 0;
}
`;
    const r = await compileAndRun(config, workspace, code);
    expect(r.stdout.trim()).toBe('blocked');
  });

  it('runs unprivileged with a read-only filesystem outside /tmp', async () => {
    const code = `#include <stdio.h>
#include <unistd.h>
int main(void) {
  printf("uid=%d\\n", (int)getuid());
  printf("root=%s\\n", fopen("/x", "w") ? "writable" : "denied");
  printf("box=%s\\n", fopen("/box/x", "w") ? "writable" : "denied");
  printf("tmp=%s\\n", fopen("/tmp/x", "w") ? "writable" : "denied");
  printf("shadow=%s\\n", fopen("/etc/shadow", "r") ? "readable" : "denied");
  return 0;
}
`;
    const r = await compileAndRun(config, workspace, code);
    expect(r.stdout).toBe('uid=65534\nroot=denied\nbox=denied\ntmp=writable\nshadow=denied\n');
  });

  it('contains memory exhaustion', async () => {
    const code = `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
int main(void) {
  size_t total = 0;
  for (;;) { char *p = malloc(16 << 20); if (!p) { printf("malloc failed\\n"); return 0; } memset(p, 1, 16 << 20); total += 16; }
}
`;
    const r = await compileAndRun(config, workspace, code);
    const contained = r.exit?.signal === 'SIGKILL' || r.stdout.includes('malloc failed');
    expect(contained).toBe(true);
  });

  it('builds with AddressSanitizer and UndefinedBehaviorSanitizer on request', async () => {
    const code = '#include <stdio.h>\n#include <stdlib.h>\nint main(void) { int *a = malloc(4 * sizeof *a); printf("%d\\n", a[4]); free(a); return 0; }\n';
    const r = await compileAndRun(config, workspace, code, '', true);
    expect(r.compile.command).toContain('-fsanitize=address,undefined');
    expect(r.stderr).toContain('heap-buffer-overflow');
    expect(r.exit?.exitCode).toBe(1);
  });
});
