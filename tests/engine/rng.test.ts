import { afterEach, describe, expect, it } from 'vitest';
import { createRng, random, setSeed } from '../../src/engine/math';

afterEach(() => setSeed(null));

describe('math RNG', () => {
  it('createRng is deterministic and in [0, 1)', () => {
    const a = createRng(42), b = createRng(42);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
  });

  it('setSeed makes random() reproducible', () => {
    setSeed(7);
    const first = [random(), random(), random()];
    setSeed(7);
    expect([random(), random(), random()]).toEqual(first);
    setSeed(8);
    expect(random()).not.toBe(first[0]);
  });
});
