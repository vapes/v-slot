import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import raw from '../../src/games/classic/config.json';
import { evaluateLines, resolveConfig, setSeed, type RawSlotConfig } from '../../src/engine/math';
import { PrecomputedTable } from '../../src/games/classic/math/PrecomputedTable';

const cfg = resolveConfig(raw as unknown as RawSlotConfig);
const probabilities = raw.payoutDistribution.map(d => d.probability);

describe('Classic precomputed math (screens.bin)', () => {
  const table = new PrecomputedTable(cfg, probabilities);

  beforeAll(async () => {
    // Node-only file read without pulling @types/node into the browser project
    const fs: { readFileSync(p: string): Uint8Array } = await import('node:' + 'fs');
    const bytes = fs.readFileSync('public/games/classic/screens.bin');
    vi.stubGlobal('fetch', async () => ({ ok: true, arrayBuffer: async () => bytes.slice().buffer }));
    await table.load('screens.bin');
    setSeed(123);
  });
  afterAll(() => { vi.unstubAllGlobals(); setSeed(null); });

  it('decodes 5×3 grids made of config symbols', () => {
    for (let i = 0; i < 500; i++) {
      const grid = table.pickGrid()!;
      expect(grid).toHaveLength(cfg.grid.cols);
      grid.forEach(col => {
        expect(col).toHaveLength(cfg.grid.rows);
        col.forEach(s => expect(cfg.symbolIds).toContain(s));
      });
    }
  });

  it('hits the configured "lose" share (±2 %)', () => {
    let losses = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) if (evaluateLines(cfg, table.pickGrid()!).length === 0) losses++;
    expect(Math.abs(losses / n - probabilities[0])).toBeLessThan(0.02);
  });
});
