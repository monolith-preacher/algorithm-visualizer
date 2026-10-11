import { describe, expect, it } from 'vitest';

import { analyzeSource, isInstrumentationLine } from '../src/trace/source';

const SOURCE = `#include "av_trace.h"
#include "sorting.h"

static int helper(int x) {
    TRACE_ENTER(x);
    int y = x * 2;
    TRACE_RETURN(y);
    return y;
}

void sort(int *a, int n) {
    TRACE_ENTER(n);
    TRACE_COMPARE(a, 0, 1);
    if (a[0] > a[1]) {
        a[0] = helper(a[1]);
    }
}
`;

describe('analyzeSource', () => {
  const map = analyzeSource(SOURCE);

  it('recognises instrumentation lines', () => {
    expect(isInstrumentationLine('    TRACE_SWAP(a, i, j);')).toBe(true);
    expect(isInstrumentationLine('    swap(a, i, j);')).toBe(false);
    expect([...map.instrumentation].sort((a, b) => a - b)).toEqual([1, 5, 7, 12, 13]);
  });

  it('removes instrumentation from the clean view', () => {
    expect(map.cleanText).not.toContain('TRACE_');
    expect(map.cleanText.split('\n')[0]).toBe('#include "sorting.h"');
  });

  it('maps a trace line to the code line below it', () => {
    expect(map.resolve(13)).toBe(14);
    expect(map.resolve(7)).toBe(8);
    expect(map.resolve(14)).toBe(14);
    expect(map.toClean(14)).toBe(SOURCE.split('\n').filter((l) => !isInstrumentationLine(l)).indexOf('    if (a[0] > a[1]) {') + 1);
  });

  it('finds function signatures, bodies and return types', () => {
    expect(map.signatureLine('helper')).toBe(4);
    expect(map.signatureLine('sort')).toBe(11);
    expect(map.closingLine('helper')).toBe(9);
    expect(map.closingLine('sort')).toBe(17);
    expect(map.returnType('helper')).toBe('int');
    expect(map.returnType('sort')).toBe('void');
  });
});
