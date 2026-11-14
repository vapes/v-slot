import { beforeAll, describe, expect, it } from 'vitest';
import raw from '../../src/games/dragon/config.json';
import strips from '../../src/games/dragon/strips.json';
import { createRng, resolveConfig, type RawSlotConfig } from '../../src/engine/math';
import { DragonMath } from '../../src/games/dragon/math/DragonMath';
import { buildProfile, type MathMode } from '../../src/games/dragon/math/respinConfig';

const cfg = resolveConfig(raw as unknown as RawSlotConfig);
const LINES = cfg.paylines.length;

describe.each<MathMode>(['real', 'demo'])('Dragon math (%s profile)', (mode) => {
  const profile = buildProfile(raw, strips, mode);
  const { scatters, sticky, respins: topUp, trigger } = profile.respin;
  const scatterIds = Object.keys(scatters);

  it('keeps the sticky wild in the nest only and the scatters (egg, dragon) in the base only', () => {
    expect(profile.reels.flat()).not.toContain(sticky);
    expect(profile.nest.flat()).toContain(sticky);
    for (const s of scatterIds) {
      expect(profile.reels.flat()).toContain(s);
      expect(profile.nest.flat()).not.toContain(s);
    }
  });

  describe('forced features', () => {
    const rounds = Array.from({ length: 400 }, (_, i) =>
      new DragonMath(cfg, profile, createRng(1000 + i), true).spin());

    beforeAll(() => expect(rounds.every(r => r.feature)).toBe(true));

    it('needs 3+ scatters and grants egg = 1, dragon = 3 respins', () => {
      for (const r of rounds) {
        const f = r.feature!;
        expect(f.trigger.length).toBeGreaterThanOrEqual(trigger);
        const symbols = f.trigger.map(([reel, row]) => r.grid[reel][row]);
        symbols.forEach(s => expect(scatterIds).toContain(s));
        expect(f.initialRespins).toBe(symbols.reduce((n, s) => n + scatters[s], 0));
      }
    });

    it('turns every triggering scatter into a sticky wild', () => {
      for (const r of rounds) {
        const f = r.feature!;
        expect(f.initialSticky.map(c => [c.reel, c.row])).toEqual(f.trigger);
        expect(f.initialSticky.every(c => c.symbol === sticky)).toBe(true);
      }
    });

    it('never shows a scatter during respins and keeps sticky wilds in place', () => {
      for (const r of rounds) {
        const f = r.feature!;
        const stuck = new Set(f.initialSticky.map(c => `${c.reel},${c.row}`));
        for (const step of f.steps) {
          scatterIds.forEach(s => expect(step.grid.flat()).not.toContain(s));
          stuck.forEach(k => { const [re, ro] = k.split(',').map(Number); expect(step.grid[re][ro]).toBe(sticky); });
          step.newSticky.forEach(c => { expect(c.symbol).toBe(sticky); stuck.add(`${c.reel},${c.row}`); });
        }
      }
    });

    it('tops the counter up to 3 on a new wild (never down) and counts down otherwise', () => {
      for (const r of rounds) {
        let left = r.feature!.initialRespins;
        for (const step of r.feature!.steps) {
          const fullNest = step.respinsLeft === 0 && step.newSticky.length > 0;
          if (!fullNest) expect(step.respinsLeft).toBe(step.newSticky.length ? Math.max(left - 1, topUp) : left - 1);
          left = step.respinsLeft;
        }
        expect(left).toBe(0);
      }
    });

    it('adds up: totalWin = collect + full-nest bonus + line wins', () => {
      for (const r of rounds) {
        const f = r.feature!;
        const cells = [...f.initialSticky, ...f.steps.flatMap(s => s.newSticky)];
        const lines = f.steps.reduce((s, st) => s + st.lineWin, 0);
        expect(f.collect).toBe(cells.reduce((s, c) => s + c.value, 0));
        expect(f.totalWin).toBe(f.collect + f.fullBonus + lines);
        const allowed = profile.respin.values.map(v => v.x * LINES);
        expect(cells.every(c => allowed.includes(c.value))).toBe(true);
      }
    });
  });

  it('is reproducible with the same seed', () => {
    const a = new DragonMath(cfg, profile, createRng(5), true).spin();
    const b = new DragonMath(cfg, profile, createRng(5), true).spin();
    expect(b).toEqual(a);
  });
});
