import { describe, expect, it } from 'vitest';
import { computeAnticipation } from '../../src/engine/math';
import { gridFromRows, testConfig } from '../helpers';

const withTease = (over = {}) => testConfig({ anticipation: { startReel: 2, scatter: 'S', scatterTrigger: 3, ...over } });

describe('computeAnticipation', () => {
  it('is off when the game has no anticipation config', () => {
    expect(computeAnticipation(testConfig(), gridFromRows([['S', 'S', 'A'], ['A', 'A', 'A'], ['B', 'B', 'B']]))).toEqual([false, false, false]);
  });

  it('teases the next reel when one scatter is missing', () => {
    const grid = gridFromRows([['S', 'A', 'B'], ['A', 'S', 'B'], ['B', 'B', 'A']]);
    expect(computeAnticipation(withTease(), grid)).toEqual([false, false, true]);
  });

  it('does not tease with too few scatters', () => {
    const grid = gridFromRows([['S', 'A', 'B'], ['A', 'B', 'B'], ['B', 'A', 'A']]);
    expect(computeAnticipation(withTease(), grid)).toEqual([false, false, false]);
  });

  it('teases when a line one symbol away would pay at least minCategory', () => {
    // B×3 pays 300 line bets = 100× total bet (3 lines) ≥ huge (5×)
    const grid = gridFromRows([['B', 'B', 'A'], ['A', 'S', 'A'], ['A', 'A', 'S']]);
    expect(computeAnticipation(withTease({ scatter: undefined }), grid)[2]).toBe(true);
  });

  it('ignores small potential wins', () => {
    // A×3 pays 10 line bets = 3.3× total bet < huge (5×)
    const grid = gridFromRows([['A', 'A', 'B'], ['B', 'S', 'A'], ['S', 'B', 'A']]);
    expect(computeAnticipation(withTease({ scatter: undefined }), grid)[2]).toBe(false);
  });

  it('respects startReel', () => {
    const grid = gridFromRows([['S', 'S', 'B'], ['A', 'A', 'B'], ['B', 'B', 'A']]);
    expect(computeAnticipation(withTease({ startReel: 3 }), grid)).toEqual([false, false, false]);
  });
});
