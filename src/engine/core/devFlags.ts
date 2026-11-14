import { setSeed } from '../math/rng';

/**
 * URL switches for QA and agents, all in one place:
 *   ?force=feature,anticipation  every spin triggers the game's feature / every eligible reel teases (dev builds only)
 *   ?debug=pipeline               log the spin pipeline stages on start (dev builds only)
 *   ?seed=12345                   deterministic math RNG → reproducible spins (dev builds and demo mode)
 */
const params = () => new URLSearchParams(window.location.search);
const list = (key: string) => (params().get(key) ?? '').split(',').map(s => s.trim()).filter(Boolean);

/** True when `?force=<name>` is present in a dev build. */
export function forced(name: string): boolean {
  return import.meta.env.DEV && list('force').includes(name);
}

/** True when `?debug=<name>` is present in a dev build. */
export function debugging(name: string): boolean {
  return import.meta.env.DEV && list('debug').includes(name);
}

/** Apply `?seed=` (ignored in real-money mode outside dev). Returns the seed in use, if any. */
export function applySeed(isRealMode: boolean): number | null {
  const raw = params().get('seed');
  if (raw === null || (isRealMode && !import.meta.env.DEV)) return null;
  const seed = Number.parseInt(raw, 10);
  if (!Number.isFinite(seed)) return null;
  setSeed(seed);
  console.info(`[devFlags] math RNG seeded with ${seed}`);
  return seed;
}
