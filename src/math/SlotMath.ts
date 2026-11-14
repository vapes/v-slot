import {
  REEL_COUNT,
  ROW_COUNT,
  PAYLINES,
  REEL_STRIPS,
  WILD,
  type SymbolId,
} from '../core/Config';
import { Paytable } from './Paytable';

export interface WinResult {
  paylineIndex: number;
  symbol: SymbolId;
  count: number;
  multiplier: number;
  positions: [number, number][]; // [reel, row]
}

export interface SpinResult {
  /** The visible grid: grid[reel][row] */
  grid: SymbolId[][];
  /** All winning paylines */
  wins: WinResult[];
  /** Total win multiplier of the line bet (sum of all payline wins) */
  totalWin: number;
}

/**
 * Reel-strip RNG: every reel stops at a uniformly random strip position and
 * shows ROW_COUNT consecutive symbols. Strips, paytable and paylines come from
 * gameConfig.json; their exact RTP is computed by scripts/build-reels.mjs.
 */
export class SlotMath {
  spin(): SpinResult {
    const grid = REEL_STRIPS.map(strip => {
      const stop = Math.floor(Math.random() * strip.length);
      return Array.from({ length: ROW_COUNT }, (_, row) => strip[(stop + row) % strip.length]);
    });
    const wins = SlotMath.evaluate(grid);
    const totalWin = wins.reduce((sum, w) => sum + w.multiplier, 0);
    return { grid, wins, totalWin };
  }

  /** Evaluate all paylines left-to-right; wild substitutes for any paying symbol. */
  static evaluate(grid: SymbolId[][]): WinResult[] {
    const wins: WinResult[] = [];

    for (let pl = 0; pl < PAYLINES.length; pl++) {
      const line = PAYLINES[pl];
      let symbol: SymbolId | null = null;
      const positions: [number, number][] = [];

      for (let reel = 0; reel < REEL_COUNT; reel++) {
        const sym = grid[reel][line[reel]];
        if (symbol === null && sym !== WILD) symbol = sym;
        if (sym !== WILD && sym !== symbol) break;
        positions.push([reel, line[reel]]);
      }

      if (symbol === null) continue;
      const multiplier = Paytable.getPayout(symbol, positions.length);
      if (multiplier > 0) {
        wins.push({ paylineIndex: pl, symbol, count: positions.length, multiplier, positions });
      }
    }

    return wins;
  }
}
