import { describe, expect, it } from 'vitest';
import {
  anywherePayout, cellSymbol, cellValue, collapseGrid, evaluateAnywhere, lineBetOf, missingCombosAnywhere, runTumbles, withValue,
} from '../../src/engine/math';
import { computeAnticipation } from '../../src/engine/math/anticipation';
import { testConfig, gridFromRows } from '../helpers';

const cfg = testConfig({
  payMode: 'anywhere', paylines: [], wild: null,
  symbols: [{ id: 'A', weight: 1 }, { id: 'B', weight: 1 }, { id: 'S', weight: 1 }, { id: 'M', weight: 1 }],
  paytable: { A: { '4': 1, '6': 5 }, B: { '5': 2 }, S: { '3': 10 } },
});

describe('pay anywhere', () => {
  it('pays the highest threshold reached, nothing below the lowest', () => {
    expect(anywherePayout(cfg, 'A', 3)).toBe(0);
    expect(anywherePayout(cfg, 'A', 5)).toBe(1);
    expect(anywherePayout(cfg, 'A', 9)).toBe(5);
  });

  it('counts a symbol wherever it is, excludes the listed ones and valued cells keep their symbol', () => {
    const grid = gridFromRows([['A', 'S', 'A'], ['B', 'A', 'S'], ['A', 'M:5', 'S']]);
    const wins = evaluateAnywhere(cfg, grid, ['S']);
    expect(wins).toHaveLength(1);
    expect(wins[0]).toMatchObject({ symbol: 'A', count: 4, multiplier: 1, paylineIndex: -1 });
    expect(evaluateAnywhere(cfg, grid).map(w => w.symbol).sort()).toEqual(['A', 'S']);
  });

  it('bet unit is the total bet', () => {
    expect(lineBetOf(cfg, 200)).toBe(200);
  });

  it('never teases line wins without paylines', () => {
    const c = testConfig({ payMode: 'anywhere', paylines: [], anticipation: { scatter: 'S', scatterTrigger: 3 } });
    expect(computeAnticipation(c, gridFromRows([['A', 'B', 'A'], ['B', 'A', 'B'], ['A', 'B', 'A']]))).toEqual([false, false, false]);
    expect(computeAnticipation(c, gridFromRows([['S', 'S', 'A'], ['B', 'A', 'B'], ['A', 'B', 'A']]))).toEqual([false, false, true]);
  });

  it('combos: a symbol × N needs weight in every pool and N cells', () => {
    expect(missingCombosAnywhere(cfg, [{ A: 1, B: 1, S: 1 }])).toEqual([]);
    expect(missingCombosAnywhere(cfg, [{ A: 1, B: 1, S: 1 }, { A: 1, S: 1 }])).toEqual(['B×5']);
    expect(missingCombosAnywhere(testConfig({ ...cfg, paytable: { A: { '10': 1 } } }), [{ A: 1 }])).toEqual(['A×10']);
  });
});

describe('cells with values', () => {
  it('round-trips symbol and value', () => {
    expect(withValue('M', 25)).toBe('M:25');
    expect(cellSymbol('M:25')).toBe('M');
    expect(cellValue('M:25')).toBe(25);
    expect(cellSymbol('A')).toBe('A');
    expect(cellValue('A')).toBeNull();
  });
});

describe('tumbles', () => {
  it('collapse: kept cells fall in order, refill on top', () => {
    const grid = [['a', 'b', 'c', 'd'], ['e', 'f', 'g', 'h']];
    const out = collapseGrid(grid, [[0, 1], [0, 3]], (reel, n) => Array.from({ length: n }, (_, i) => `n${reel}${i}`));
    expect(out).toEqual([['n00', 'n01', 'a', 'c'], ['e', 'f', 'g', 'h']]);
    expect(grid[0]).toEqual(['a', 'b', 'c', 'd']); // pure
  });

  it('cascades until nothing pays and sums the wins', () => {
    const grid = gridFromRows([['A', 'A', 'B'], ['A', 'B', 'S'], ['A', 'B', 'B']]);
    const queue = ['A', 'A', 'B', 'A', 'B', 'S', 'S', 'S', 'S', 'S'];
    const run = runTumbles(grid, g => evaluateAnywhere(cfg, g, ['S']), (_, n) => queue.splice(0, n));
    expect(run.steps.length).toBeGreaterThanOrEqual(2);
    expect(run.totalWin).toBe(run.steps.reduce((s, x) => s + x.win, 0));
    expect(evaluateAnywhere(cfg, run.finalGrid, ['S'])).toHaveLength(0);
    run.steps.forEach(s => s.grid.forEach(col => expect(col).toHaveLength(3)));
    expect(run.steps[0].removed).toHaveLength(4); // 4 A pay, 4 B (needs 5) and the S stay
  });
});
