/**
 * Math RNG. All game-outcome randomness (reel stops, sticky values,
 * precomputed screens…) must come from `random()` so a session can be
 * replayed with `?seed=<n>` (see core/devFlags). Visual-only randomness
 * (spin blur, particles) keeps using Math.random so it never shifts the
 * outcome stream. Pure — usable from Node tools/tests.
 */
let source: () => number = Math.random;

/** Uniform [0, 1) from the current math RNG. */
export function random(): number {
  return source();
}

/** Deterministic PRNG (mulberry32) for a 32-bit seed. */
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Make `random()` deterministic from `seed`; pass null to go back to Math.random. */
export function setSeed(seed: number | null): void {
  source = seed === null ? Math.random : createRng(seed);
}
