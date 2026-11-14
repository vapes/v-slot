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
  const { scatter, sticky, respins } = profile.respin;

  it('keeps the sticky dragon off the base reels and the egg off the nest reels', () => {
    expect(profile.reels.flat()).not.toContain(sticky);
    expect(profile.nest.flat()).not.toContain(scatter);
    expect(profile.nest.flat()).toContain(sticky);
  });

  describe('forced features', () => {
    const rounds = Array.from({ length: 400 }, (_, i) =>
      new DragonMath(cfg, profile, createRng(1000 + i), true).spin());

    beforeAll(() => expect(rounds.every(r => r.feature)).toBe(true));

    it('starts with the triggering eggs as sticky dragons', () => {
      for (const r of rounds) {
        const f = r.feature!;
        expect(f.trigger.length).toBeGreaterThanOrEqual(profile.respin.trigger);
        expect(f.initialSticky.map(c => [c.reel, c.row])).toEqual(f.trigger);
        expect(f.initialSticky.every(c => c.symbol === sticky)).toBe(true);
        f.trigger.forEach(([reel, row]) => expect(r.grid[reel][row]).toBe(scatter));
      }
    });

    it('never shows an egg during respins and keeps sticky cells in place', () => {
      for (const r of rounds) {
        const f = r.feature!;
        const stuck = new Set(f.initialSticky.map(c => `${c.reel},${c.row}`));
        for (const step of f.steps) {
          expect(step.grid.flat()).not.toContain(scatter);
          stuck.forEach(k => { const [re, ro] = k.split(',').map(Number); expect(step.grid[re][ro]).toBe(sticky); });
          step.newSticky.forEach(c => stuck.add(`${c.reel},${c.row}`));
        }
      }
    });

    it('resets respins on a new dragon and counts down otherwise', () => {
      for (const r of rounds) {
        let left = r.feature!.initialRespins;
        for (const step of r.feature!.steps) {
          const full = step.respinsLeft === 0 && step.newSticky.length > 0;
          if (!full) expect(step.respinsLeft).toBe(step.newSticky.length ? respins : left - 1);
          left = step.respinsLeft;
        }
        expect(left).toBe(0);
      }
    });

    it('adds up: totalWin = collect + full-nest bonus + line wins', () => {
      for (const r of rounds) {
        const f = r.feature!;
        const values = [...f.initialSticky, ...f.steps.flatMap(s => s.newSticky)].reduce((s, c) => s + c.value, 0);
        const lines = f.steps.reduce((s, st) => s + st.lineWin, 0);
        expect(f.collect).toBe(values);
        expect(f.totalWin).toBe(f.collect + f.fullBonus + lines);
        const allowed = profile.respin.values.map(v => v.x * LINES);
        expect([...f.initialSticky, ...f.steps.flatMap(s => s.newSticky)].every(c => allowed.includes(c.value))).toBe(true);
      }
    });
  });

  it('is reproducible with the same seed', () => {
    const a = new DragonMath(cfg, profile, createRng(5), true).spin();
    const b = new DragonMath(cfg, profile, createRng(5), true).spin();
    expect(b).toEqual(a);
  });
});
