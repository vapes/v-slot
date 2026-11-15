import { describe, expect, it } from 'vitest';
import { testConfig } from '../helpers';

describe('cfg.landing (symbol landing animations)', () => {
  const cfg = testConfig({
    symbols: [
      { id: 'W', weight: 1 },
      { id: 'A', weight: 1, landing: { ms: 700, hue: 360 } },
      { id: 'S', weight: 1, landing: { sweeps: 3 }, turboLanding: { ms: 300 } },
    ],
  });

  it('returns null when the symbol has no animation for that stop', () => {
    expect(cfg.landing('W', false)).toBeNull();
    expect(cfg.landing('W', true)).toBeNull();
    expect(cfg.landing('A', true)).toBeNull(); // no turbo variant → nothing in turbo
    expect(cfg.landing('unknown', false)).toBeNull();
  });

  it('fills unspecified fields from the engine defaults', () => {
    const a = cfg.landing('A', false)!;
    expect(a.ms).toBe(700);
    expect(a.hue).toBe(360);
    expect(a.sweeps).toBeGreaterThan(0);
    expect(a.scale).toBeGreaterThan(1);
    expect(cfg.landing('S', false)!.sweeps).toBe(3);
    expect(cfg.landing('S', true)!.ms).toBe(300);
  });
});
