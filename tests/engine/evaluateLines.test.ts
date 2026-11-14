import { describe, expect, it } from 'vitest';
import { evaluateLines, linePayout, toSpinResult } from '../../src/engine/math';
import { gridFromRows, testConfig } from '../helpers';

const cfg = testConfig();

describe('evaluateLines', () => {
  it('pays a left-to-right match on a line', () => {
    const wins = evaluateLines(cfg, gridFromRows([['A', 'A', 'A'], ['S', 'B', 'S'], ['B', 'S', 'B']]));
    expect(wins).toHaveLength(1);
    expect(wins[0]).toMatchObject({ paylineIndex: 0, symbol: 'A', count: 3, multiplier: 10 });
    expect(wins[0].positions).toEqual([[0, 0], [1, 0], [2, 0]]);
  });

  it('lets the wild substitute, also as the first symbol', () => {
    const wins = evaluateLines(cfg, gridFromRows([['W', 'A', 'W'], ['S', 'B', 'S'], ['S', 'S', 'B']]));
    expect(wins[0]).toMatchObject({ symbol: 'A', count: 3, multiplier: 10 });
  });

  it('stops at the first different symbol and pays shorter matches', () => {
    const wins = evaluateLines(cfg, gridFromRows([['A', 'A', 'B'], ['S', 'B', 'S'], ['B', 'S', 'A']]));
    expect(wins).toEqual([expect.objectContaining({ symbol: 'A', count: 2, multiplier: 2 })]);
  });

  it('pays nothing for a line of only wilds', () => {
    const wins = evaluateLines(cfg, gridFromRows([['W', 'W', 'W'], ['S', 'B', 'S'], ['B', 'S', 'B']]));
    expect(wins).toEqual([]);
  });

  it('sums multipliers in toSpinResult', () => {
    const r = toSpinResult(cfg, gridFromRows([['A', 'A', 'A'], ['B', 'B', 'B'], ['S', 'S', 'S']]));
    expect(r.totalWin).toBe(10 + 300);
  });

  it('linePayout caps the count at the reel count and returns 0 for no pay', () => {
    expect(linePayout(cfg, 'A', 9)).toBe(10);
    expect(linePayout(cfg, 'S', 3)).toBe(0);
  });
});
