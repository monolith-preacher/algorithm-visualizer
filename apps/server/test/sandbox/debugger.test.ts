import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { DebugValue } from '@av/shared';

import { enabled, sandboxReady, SessionDriver, testConfig, Workspaces } from './helpers';

const config = testConfig();
const workspaces = new Workspaces(config.workDir);

const LIST_PROGRAM = `#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int value;
    struct Node *next;
} Node;

int total = 0;

int sum(const Node *n) {
    int s = 0;
    while (n != NULL) {
        s += n->value;
        n = n->next;
    }
    return s;
}

int main(void) {
    int values[3] = {10, 20, 30};
    Node *head = NULL;
    for (int i = 0; i < 3; i++) {
        Node *node = malloc(sizeof *node);
        node->value = values[i];
        node->next = head;
        head = node;
    }
    int *buffer = calloc(4, sizeof *buffer);
    total = sum(head);
    printf("total=%d\\n", total);
    free(buffer);
    return 0;
}
`;

const find = (values: DebugValue[], name: string): DebugValue | undefined => values.find((v) => v.name === name);

describe.runIf(enabled)('GDB/MI debugging in the sandbox', () => {
  beforeAll(async () => {
    expect(await sandboxReady(config)).toBe(true);
    await workspaces.init();
  });

  let driver: SessionDriver;
  afterAll(async () => {
    await driver?.session.dispose();
  });

  it('stops at main, steps, inspects variables, heap blocks and return values', async () => {
    driver = new SessionDriver(config, workspaces);
    const breakpoints = driver.next('debug_breakpoints');
    const first = driver.paused();
    await driver.session.handle({ type: 'debug_start', code: LIST_PROGRAM, stdin: '', breakpoints: [30] });
    expect((await breakpoints).lines).toEqual([30]);

    const atMain = await first;
    expect(atMain.func).toBe('main');
    expect(atMain.frames[0]?.user).toBe(true);
    expect(find(atMain.globals, 'total')?.value).toBe('0');

    const atBreakpoint = driver.paused();
    await driver.session.handle({ type: 'debug_command', command: 'continue' });
    const snap = await atBreakpoint;
    expect(snap.line).toBe(30);
    const main = snap.frames[0];
    const values = find(main?.locals ?? [], 'values');
    expect(values?.kind).toBe('array');
    expect(values?.children?.map((c) => c.value)).toEqual(['10', '20', '30']);
    expect(values?.children?.[1]?.address).toBe(
      `0x${(BigInt(values?.address ?? '0') + 4n).toString(16)}`,
    );

    const head = find(main?.locals ?? [], 'head');
    expect(head?.kind).toBe('pointer');
    expect(head?.pointsTo).toMatch(/^0x/);
    expect(snap.heapTracking.available).toBe(true);
    const live = snap.heap.filter((b) => b.state === 'live');
    expect(live).toHaveLength(4);
    const headBlock = live.find((b) => b.address === head?.pointsTo);
    expect(headBlock?.size).toBe(16);
    expect(headBlock?.view?.children?.find((c) => c.name === 'value')?.value).toBe('30');
    const buffer = find(main?.locals ?? [], 'buffer');
    const bufferBlock = live.find((b) => b.address === buffer?.pointsTo);
    expect(bufferBlock?.view?.type).toBe('int [4]');
    expect(snap.regions.some((r) => r.name === 'stack')).toBe(true);

    // Step into sum(), then out of it: GDB reports the returned value.
    const inSum = driver.paused();
    await driver.session.handle({ type: 'debug_command', command: 'step_into' });
    const sumSnap = await inSum;
    expect(sumSnap.func).toBe('sum');
    expect(sumSnap.frames.filter((f) => f.user).map((f) => f.func)).toEqual(['sum', 'main']);
    expect(find(sumSnap.frames[0]?.args ?? [], 'n')?.pointsTo).toBe(head?.pointsTo);

    const out = driver.paused();
    await driver.session.handle({ type: 'debug_command', command: 'step_out' });
    const outSnap = await out;
    expect(outSnap.func).toBe('main');
    expect(outSnap.returnValue?.value).toBe('60');

    const evaluation = driver.next('debug_eval');
    await driver.session.handle({ type: 'debug_evaluate', id: 1, expression: 'head->next->value * 2', frame: 0 });
    expect((await evaluation).value).toBe('40');

    const ended = driver.next('debug_ended');
    await driver.session.handle({ type: 'debug_command', command: 'continue' });
    const info = (await ended).info;
    expect(info.reason).toBe('exited');
    expect(info.exitCode).toBe(0);
    expect(driver.output()).toContain('total=60');
  });

  it('pauses on a segmentation fault at the faulting line', async () => {
    driver = new SessionDriver(config, workspaces);
    const code = 'int main(void) {\n    int *p = 0;\n    *p = 42;\n    return 0;\n}\n';
    const first = driver.paused();
    await driver.session.handle({ type: 'debug_start', code, stdin: '', breakpoints: [] });
    await first;
    const crash = driver.paused();
    await driver.session.handle({ type: 'debug_command', command: 'continue' });
    const snap = await crash;
    expect(snap.signal?.name).toBe('SIGSEGV');
    expect(snap.line).toBe(3);
    expect(find(snap.frames[0]?.locals ?? [], 'p')?.pointsTo).toBeNull();
    const ended = driver.next('debug_ended');
    await driver.session.handle({ type: 'debug_command', command: 'continue' });
    expect((await ended).info.signal).toBe('SIGSEGV');
  });

  it('stops a debug session whose program floods the output', async () => {
    driver = new SessionDriver(config, workspaces);
    const code = '#include <stdio.h>\nint main(void) {\n    for (;;) puts("flood flood flood flood");\n}\n';
    const first = driver.paused();
    await driver.session.handle({ type: 'debug_start', code, stdin: '', breakpoints: [] });
    await first;
    const ended = driver.next('debug_ended');
    await driver.session.handle({ type: 'debug_command', command: 'continue' });
    expect((await ended).info.reason).toBe('output_limit');
  });

  it('reads stdin from the provided input and can interrupt a running loop', async () => {
    driver = new SessionDriver(config, workspaces);
    const code = '#include <stdio.h>\nint main(void) {\n    int n = 0;\n    scanf("%d", &n);\n    volatile long x = 0;\n    while (n > 0) x++;\n    return 0;\n}\n';
    const first = driver.paused();
    await driver.session.handle({ type: 'debug_start', code, stdin: '5\n', breakpoints: [5] });
    await first;
    const atFive = driver.paused();
    await driver.session.handle({ type: 'debug_command', command: 'continue' });
    expect(find((await atFive).frames[0]?.locals ?? [], 'n')?.value).toBe('5');
    await driver.session.handle({ type: 'debug_breakpoints', lines: [] });
    const running = driver.next('debug_running');
    await driver.session.handle({ type: 'debug_command', command: 'continue' });
    await running;
    const interrupted = driver.paused();
    await driver.session.handle({ type: 'debug_command', command: 'pause' });
    const snap = await interrupted;
    expect(snap.reason).toBe('paused');
    expect(snap.signal).toBeUndefined();
    expect(snap.line).toBe(6);
    const ended = driver.next('debug_ended');
    await driver.session.handle({ type: 'debug_stop' });
    expect((await ended).info.reason).toBe('killed');
  });
});
