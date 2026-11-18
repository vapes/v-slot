import type { SlotConfig } from '../config/SlotConfig';
import type { WinResult } from './types';
import { cellSymbol } from './cells';

/**
 * "Pay anywhere" (scatter pays): a symbol pays when at least N of it are on
 * the screen, wherever they are. Paytable keys are minimum counts ("8", "10",
 * "12"); the highest key ≤ count pays. 0 = no win.
 */
export function anywherePayout(cfg: SlotConfig, symbol: string, count: number): number {
  const pays = cfg.paytable[symbol];
  if (!pays) return 0;
  let best = 0;
  let bestN = 0;
  for (const [n, v] of Object.entries(pays)) {
    const k = Number(n);
    if (k <= count && k > bestN) {
      bestN = k;
      best = v;
    }
  }
  return best;
}

/**
 * Every paying symbol counted over the whole grid. `exclude` symbols (e.g. the
 * scatter, which pays on its own and stays on the grid) never pay here.
 * `paylineIndex` is -1 (no line); positions = every cell of that symbol.
 */
export function evaluateAnywhere(cfg: SlotConfig, grid: string[][], exclude: readonly string[] = []): WinResult[] {
  const cells = new Map<string, [number, number][]>();
  grid.forEach((col, reel) => col.forEach((id, row) => {
    const s = cellSymbol(id);
    if (exclude.includes(s) || !cfg.paytable[s]) return;
    let list = cells.get(s);
    if (!list) cells.set(s, (list = []));
    list.push([reel, row]);
  }));
  const wins: WinResult[] = [];
  for (const [symbol, positions] of cells) {
    const multiplier = anywherePayout(cfg, symbol, positions.length);
    if (multiplier > 0) wins.push({ paylineIndex: -1, symbol, count: positions.length, multiplier, positions });
  }
  return wins.sort((a, b) => b.multiplier - a.multiplier);
}
