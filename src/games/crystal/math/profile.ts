/**
 * Crystal Falls math settings (config.json → math), pure. Every cell is an
 * independent weighted draw from the active weight table: base game or free
 * spins. Multiplier orbs carry a value drawn from `multipliers`.
 */
export interface WeightTable {
  /** symbol → weight (the multiplier orb included). */
  weights: Record<string, number>;
  /** multiplier value → weight. */
  multipliers: Record<string, number>;
}

export interface RawCrystalMath {
  scatter: string;
  multiplier: string;
  freeSpins: { trigger: number; spins: number; retrigger: number; extra: number };
  buyScatters: number;
  base: WeightTable;
  free: WeightTable;
}

type Rng = () => number;

/** Weighted picker over [value, weight] pairs. */
export function picker<T>(entries: [T, number][], rng: Rng): () => T {
  const live = entries.filter(([, w]) => w > 0);
  const total = live.reduce((s, [, w]) => s + w, 0);
  return () => {
    let x = rng() * total;
    for (const [v, w] of live) {
      if ((x -= w) < 0) return v;
    }
    return live[live.length - 1][0];
  };
}
