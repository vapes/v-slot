import { describe, expect, it } from 'vitest';
import { planRespinStep } from '../../src/engine/feature/respinStep';
import type { FeatureStep, StickyCell } from '../../src/engine/math/types';

const cell = (reel: number, row: number): StickyCell => ({ reel, row, symbol: 'W', value: 0 });
const step = (newSticky: StickyCell[], respinsLeft: number): FeatureStep =>
  ({ grid: [], wins: [], lineWin: 0, newSticky, respinsLeft });

describe('planRespinStep', () => {
  it('fires a comet for every new sticky cell, even while many respins are left', () => {
    // 6 respins left, one used, a wild adds +1 → counter 6: the first wild must still fly
    const plan = planRespinStep(6, step([cell(0, 1)], 6));
    expect(plan.fly).toHaveLength(1);
    expect(plan.during).toBe(5);
    expect(plan.after).toBe(6);
    expect(plan.pop).toBe(true);
  });

  it('flies one comet per wild when several land at once', () => {
    expect(planRespinStep(2, step([cell(0, 0), cell(3, 4)], 3)).fly).toHaveLength(2);
  });

  it('just counts down without comets when no wild lands', () => {
    const plan = planRespinStep(4, step([], 3));
    expect(plan.fly).toHaveLength(0);
    expect(plan.pop).toBe(false);
    expect(plan.after).toBe(3);
  });
});
