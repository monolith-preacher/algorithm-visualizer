import { describe, expect, it } from 'vitest';

import { generate, parseValues } from './generate';

describe('input generation', () => {
  it('respects size, range and order presets', () => {
    for (const preset of ['random', 'ascending', 'descending', 'nearly', 'few-unique'] as const) {
      const values = generate(preset, 30, 5, 99);
      expect(values).toHaveLength(30);
      expect(values.every((v) => v >= 5 && v <= 99)).toBe(true);
    }
    const asc = generate('ascending', 10, 1, 10);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = generate('descending', 10, 1, 10);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    expect(new Set(generate('few-unique', 50, 1, 99)).size).toBeLessThanOrEqual(4);
  });

  it('parses custom values and reports errors', () => {
    expect(parseValues('5, 3 9;1', -999, 999, 10)).toEqual([5, 3, 9, 1]);
    expect(parseValues('-4 0 7', -999, 999, 10)).toEqual([-4, 0, 7]);
    expect(parseValues('', -999, 999, 10)).toMatch(/at least one/);
    expect(parseValues('1 2.5', -999, 999, 10)).toMatch(/not an integer/);
    expect(parseValues('1 5000', -999, 999, 10)).toMatch(/\[-999, 999\]/);
    expect(parseValues('1 2 3', -999, 999, 2)).toMatch(/At most 2/);
  });
});
