import { describe, expect, it } from 'vitest';
import raw from '../../src/games/crystal/config.json';
import {
  cellSymbol, cellValue, createRng, evaluateAnywhere, missingCombosAnywhere, resolveConfig, type RawSlotConfig,
} from '../../src/engine/math';
import { CrystalMath } from '../../src/games/crystal/math/CrystalMath';

const cfg = Object.assign(resolveConfig({ ...raw, payMode: 'anywhere' } as RawSlotConfig), { maxWin: raw.maxWin });
const m = raw.math;
const { rows, cols } = cfg.grid;
const fixed = [m.scatter];
const winOf = (r: { totalWin: number; freeSpins?: { totalWin: number } }) => r.totalWin + (r.freeSpins?.totalWin ?? 0);

describe('Crystal Falls math', () => {
  it('every paytable combination can land in the base game and in free spins (Hard Rule 9)', () => {
    expect(missingCombosAnywhere(cfg, [m.base.weights, m.free.weights])).toEqual([]);
  });

  it('is reproducible with a seed', () => {
    const a = new CrystalMath(cfg, m, createRng(7));
    const b = new CrystalMath(cfg, m, createRng(7));
    for (let i = 0; i < 200; i++) expect(a.spin()).toEqual(b.spin());
  });

  it('tumbles are consistent: grids keep their shape, every step pays, the last grid does not', () => {
    const math = new CrystalMath(cfg, m, createRng(3));
    let tumbled = 0;
    for (let i = 0; i < 3000; i++) {
      const r = math.spin();
      let grid = r.grid;
      for (const step of r.tumbles ?? []) {
        expect(evaluateAnywhere(cfg, grid, fixed).map(w => w.symbol).sort()).toEqual(step.wins.map(w => w.symbol).sort());
        expect(step.grid).toHaveLength(cols);
        step.grid.forEach(col => expect(col).toHaveLength(rows));
        grid = step.grid;
        tumbled++;
      }
      expect(evaluateAnywhere(cfg, grid, fixed)).toHaveLength(0);
      const tumbleWin = (r.tumbles ?? []).reduce((s, x) => s + x.win, 0);
      if (r.multiplier) {
        const sum = r.multiplier.cells.reduce((s, [c, row]) => s + (cellValue(grid[c][row]) ?? 0), 0);
        expect(r.multiplier.sum).toBe(sum);
        expect(r.multiplier.base).toBeCloseTo(tumbleWin);
      }
      expect(winOf(r)).toBeLessThanOrEqual(raw.maxWin + 1e-9);
    }
    expect(tumbled).toBeGreaterThan(0);
  });

  it('a bought spin always starts the free spins; spin counters add up', () => {
    const math = new CrystalMath(cfg, m, createRng(11));
    for (let i = 0; i < 100; i++) {
      const r = math.spin({ buyFeature: true });
      const fs = r.freeSpins!;
      expect(fs).toBeDefined();
      expect(fs.trigger.length).toBeGreaterThanOrEqual(m.freeSpins.trigger);
      const added = fs.spins.reduce((s, x) => s + x.added, 0);
      const capped = fs.spins[fs.spins.length - 1].spinsLeft === 0 && fs.spins.length < fs.initialSpins + added;
      if (!capped) expect(fs.spins.length).toBe(fs.initialSpins + added);
      expect(fs.totalWin).toBeCloseTo(fs.spins.reduce((s, x) => s + x.result.totalWin, 0));
      // the free-spins multiplier only grows
      fs.spins.reduce((prev, x) => (expect(x.multiplier).toBeGreaterThanOrEqual(prev), x.multiplier), 0);
    }
  });

  it('first screen: no win, no orb, no near-miss of prisms', () => {
    const math = new CrystalMath(cfg, m, createRng(5));
    for (let i = 0; i < 100; i++) {
      const g = math.initialGrid();
      expect(evaluateAnywhere(cfg, g, fixed)).toHaveLength(0);
      expect(g.flat().map(cellSymbol)).not.toContain(m.multiplier);
    }
  });
});
