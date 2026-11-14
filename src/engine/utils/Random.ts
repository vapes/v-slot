import type { SlotConfig } from '../config/SlotConfig';

/** Weighted picker for the random "blur" symbols shown while reels spin. */
export function createSymbolPicker(cfg: SlotConfig): () => string {
  const total = cfg.symbols.reduce((s, x) => s + x.weight, 0);
  return () => {
    let roll = Math.random() * total;
    for (const s of cfg.symbols) {
      roll -= s.weight;
      if (roll <= 0) return s.id;
    }
    return cfg.symbols[cfg.symbols.length - 1].id;
  };
}
