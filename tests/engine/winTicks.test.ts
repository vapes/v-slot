import { describe, expect, it } from 'vitest';
import { planWinTicks } from '../../src/engine/ui/winTicks';

const TH = { big: 10, huge: 25, epic: 50, max: 100 };
const TIMING = { tickMs: 700, climbMs: 600, stageMs: 2000, minStage: 0.35 };

describe('planWinTicks', () => {
  it('small win: one quick count-up in place', () => {
    expect(planWinTicks(900, 100, TH, TIMING)).toEqual([{ to: 900, ms: 700, tier: null }]);
  });

  it('big win: climb to BIG, then a partial BIG stage', () => {
    const plan = planWinTicks(2000, 100, TH, TIMING); // 20× bet
    expect(plan.map(p => p.tier)).toEqual([null, 'big']);
    expect(plan[0]).toEqual({ to: 1000, ms: 600, tier: null });
    expect(plan[1].to).toBe(2000);
    expect(plan[1].ms).toBeCloseTo(2000 * (10 / 15)); // 10 of the 15× between BIG and HUGE
  });

  it('epic win passes every lower tier in order and ends on the win', () => {
    const plan = planWinTicks(6000, 100, TH, TIMING); // 60×
    expect(plan.map(p => p.tier)).toEqual([null, 'big', 'huge', 'epic']);
    expect(plan.map(p => p.to)).toEqual([1000, 2500, 5000, 6000]);
    expect(plan[3].ms).toBeCloseTo(2000 * 0.35); // 10/50 of the way to MAX → min stage
  });

  it('max win: a full last stage, counter values never go down', () => {
    const plan = planWinTicks(25000, 100, TH, TIMING);
    expect(plan.map(p => p.tier)).toEqual([null, 'big', 'huge', 'epic', 'max']);
    expect(plan[4]).toEqual({ to: 25000, ms: 2000, tier: 'max' });
    for (let i = 1; i < plan.length; i++) expect(plan[i].to).toBeGreaterThanOrEqual(plan[i - 1].to);
  });

  it('exactly on a threshold switches the tier', () => {
    expect(planWinTicks(2500, 100, TH, TIMING).map(p => p.tier)).toEqual([null, 'big', 'huge']);
  });
});
