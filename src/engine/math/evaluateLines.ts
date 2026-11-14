import type { SlotConfig } from '../config/SlotConfig';
import type { SpinResult, WinResult } from './types';
import { linePayout } from './Paytable';

/**
 * Evaluate every payline left-to-right. The optional wild (cfg.wild)
 * substitutes for any symbol; a line of only wilds pays nothing.
 */
export function evaluateLines(cfg: SlotConfig, grid: string[][]): WinResult[] {
  const wild = cfg.wild ?? null;
  const wins: WinResult[] = [];

  cfg.paylines.forEach((line, paylineIndex) => {
    let symbol: string | null = null;
    const positions: [number, number][] = [];

    for (let reel = 0; reel < cfg.grid.cols; reel++) {
      const sym = grid[reel][line[reel]];
      if (symbol === null && sym !== wild) symbol = sym;
      if (sym !== wild && sym !== symbol) break;
      positions.push([reel, line[reel]]);
    }

    if (symbol === null) return;
    const multiplier = linePayout(cfg, symbol, positions.length);
    if (multiplier > 0) {
      wins.push({ paylineIndex, symbol, count: positions.length, multiplier, positions });
    }
  });

  return wins;
}

export function toSpinResult(cfg: SlotConfig, grid: string[][]): SpinResult {
  const wins = evaluateLines(cfg, grid);
  return { grid, wins, totalWin: wins.reduce((s, w) => s + w.multiplier, 0) };
}
