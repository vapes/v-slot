import type { SlotConfig } from '../config/SlotConfig';
import { evaluateLines } from './evaluateLines';

/**
 * Paytable completeness (project rule: every combination the paytable
 * advertises must really be able to land — otherwise the game cheats).
 *
 * A combination is "symbol × count", one per paytable entry (e.g. seven × 3,
 * seven × 4, seven × 5). Pure helpers used by game tests and math tools.
 */

/** Every paytable combination as "symbol×count". */
export function paytableCombos(cfg: SlotConfig): string[] {
  return Object.entries(cfg.paytable).flatMap(([symbol, pays]) => Object.keys(pays).map(n => `${symbol}×${n}`));
}

/**
 * Pool-based math (precomputed screens): combinations of the paytable that no
 * grid of the pool pays. `grids` = every grid the game can actually return
 * (only pools with probability > 0).
 */
export function missingCombosInGrids(cfg: SlotConfig, grids: Iterable<string[][]>): string[] {
  const seen = new Set<string>();
  for (const grid of grids) for (const w of evaluateLines(cfg, grid)) seen.add(`${w.symbol}×${w.count}`);
  return paytableCombos(cfg).filter(c => !seen.has(c));
}

/**
 * Reel-strip math: combinations that no stop position of `strips` (one strip
 * per reel, stops are independent and every row of a reel can show any strip
 * position) can land as an exact line win of that symbol: symbol (not wild)
 * on reels 0..n-1 and, below the full line, something that neither continues
 * nor substitutes on reel n. Exact for line wins read left to right.
 */
export function missingCombosOnStrips(cfg: SlotConfig, strips: string[][]): string[] {
  const wild = cfg.wild ?? null;
  const has = (reel: number, s: string) => strips[reel]?.includes(s) ?? false;
  const breaks = (reel: number, s: string) => strips[reel]?.some(x => x !== s && x !== wild) ?? false;
  return Object.entries(cfg.paytable).flatMap(([symbol, pays]) => Object.keys(pays).map(Number)
    .filter(n => {
      for (let r = 0; r < n; r++) if (!has(r, symbol)) return true;
      return n < cfg.grid.cols && !breaks(n, symbol);
    })
    .map(n => `${symbol}×${n}`));
}

/**
 * Pay-anywhere math with independent weighted cells: symbol × N can land when
 * the symbol has a positive weight in a pool that fills the cells and the
 * grid has at least N cells. `pools` = every weight table the game draws
 * cells from (symbol → weight; e.g. base, free spins, demo).
 */
export function missingCombosAnywhere(cfg: SlotConfig, pools: Record<string, number>[]): string[] {
  const cells = cfg.grid.rows * cfg.grid.cols;
  return Object.entries(cfg.paytable).flatMap(([symbol, pays]) => Object.keys(pays).map(Number)
    .filter(n => n > cells || !pools.every(p => (p[symbol] ?? 0) > 0))
    .map(n => `${symbol}×${n}`));
}
