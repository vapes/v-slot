import type { SlotConfig } from '../config/SlotConfig';
import { linePayout } from './Paytable';

/**
 * Which reels should anticipate (tease) for this grid. Pure: decided from the
 * final grid like a server would, so it also fires on near misses.
 *
 * Reel i (i ≥ startReel) anticipates when the reels left of it are exactly
 * one symbol short of
 *  - the feature: (scatterTrigger − 1) scatters (any of `scatter` / `scatters`) already landed, or
 *  - a big win: the paylines whose first i symbols already match would pay
 *    at least `minCategory` (celebration threshold × total bet) with one more.
 */
export function computeAnticipation(cfg: SlotConfig, grid: string[][]): boolean[] {
  const a = cfg.tease;
  const cols = cfg.grid.cols;
  const out = new Array<boolean>(cols).fill(false);
  if (!a) return out;

  const wild = cfg.wild ?? null;
  const lines = cfg.paylines.length;
  const tier = a.minCategory as keyof SlotConfig['celebration'];
  const threshold = (cfg.celebration[tier] ?? cfg.celebration.huge) * lines; // × line bet
  const need = a.scatterTrigger - 1;

  for (let i = Math.max(1, a.startReel); i < cols; i++) {
    const scatterIds = a.scatter ? [a.scatter, ...a.scatters] : a.scatters;
    if (scatterIds.length) {
      let count = 0;
      for (let r = 0; r < i; r++) count += grid[r].filter(s => scatterIds.includes(s)).length;
      if (count >= need) {
        out[i] = true;
        continue;
      }
    }

    let potential = 0;
    for (const line of cfg.paylines) {
      let sym: string | null = null;
      let matched = true;
      for (let r = 0; r < i && matched; r++) {
        const s = grid[r][line[r]];
        if (sym === null && s !== wild) sym = s;
        matched = s === wild || s === sym;
      }
      if (matched && sym !== null) potential += linePayout(cfg, sym, i + 1);
    }
    if (potential >= threshold) out[i] = true;
  }
  return out;
}
