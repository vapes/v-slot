import type { SlotConfig } from '../config/SlotConfig';

/**
 * Weighted picker for the random "blur" symbols shown while reels spin (and
 * the very first screen if the math has no initialGrid). Weight 0 = never
 * shown, e.g. a symbol that only exists in a feature.
 */
export function createSymbolPicker(cfg: SlotConfig): () => string {
  const pool = cfg.symbols.filter(s => s.weight > 0);
  const total = pool.reduce((s, x) => s + x.weight, 0);
  return () => {
    let roll = Math.random() * total;
    for (const s of pool) {
      roll -= s.weight;
      if (roll < 0) return s.id;
    }
    return pool[pool.length - 1].id;
  };
}
