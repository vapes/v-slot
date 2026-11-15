import { describe, expect, it } from 'vitest';
import { missingCombosInGrids, missingCombosOnStrips, paytableCombos } from '../../src/engine/math';
import { gridFromRows, testConfig } from '../helpers';

// paytable: A×2, A×3, B×3; wild W; 3 reels × 3 rows
const cfg = testConfig();

describe('paytable completeness', () => {
  it('lists every symbol × count of the paytable', () => {
    expect(paytableCombos(cfg)).toEqual(['A×2', 'A×3', 'B×3']);
  });

  it('pool: reports combinations no grid pays', () => {
    const a3 = gridFromRows([['A', 'A', 'A'], ['S', 'S', 'B'], ['B', 'S', 'S']]);
    const a2 = gridFromRows([['A', 'A', 'S'], ['S', 'B', 'S'], ['B', 'S', 'B']]);
    expect(missingCombosInGrids(cfg, [a3])).toEqual(['A×2', 'B×3']);
    expect(missingCombosInGrids(cfg, [a3, a2])).toEqual(['B×3']);
  });

  it('strips: a symbol missing from a reel makes its longer combos unreachable', () => {
    expect(missingCombosOnStrips(cfg, [['A', 'B', 'S'], ['A', 'B', 'S'], ['A', 'B', 'S']])).toEqual([]);
    expect(missingCombosOnStrips(cfg, [['A', 'B'], ['A', 'B'], ['A', 'S']])).toEqual(['B×3']);
    expect(missingCombosOnStrips(cfg, [['A', 'B'], ['B', 'S'], ['A', 'B']])).toEqual(['A×2', 'A×3']);
  });

  it('strips: a shorter combo needs a breaker that is neither the symbol nor wild', () => {
    expect(missingCombosOnStrips(cfg, [['A', 'B'], ['A', 'B'], ['A', 'W']])).toEqual(['A×2', 'B×3']);
  });
});
