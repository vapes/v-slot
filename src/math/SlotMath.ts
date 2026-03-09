import {
  REEL_COUNT,
  ROW_COUNT,
  PAYLINES,
  SYMBOLS,
  SYMBOL_WEIGHTS,
  type SymbolId,
} from '../core/Config';
import gameConfig from '../gameConfig.json';
import { Paytable } from './Paytable';
import { Random } from '../utils/Random';

export interface WinResult {
  paylineIndex: number;
  symbol: SymbolId;
  count: number;
  multiplier: number;
  positions: [number, number][]; // [reel, row]
}

export interface SpinResult {
  /** The visible 5×3 grid: grid[reel][row] */
  grid: SymbolId[][];
  /** All winning paylines */
  wins: WinResult[];
  /** Total win multiplier (sum of all payline wins) */
  totalWin: number;
}

export class SlotMath {
  private reelStrips: SymbolId[][];

  constructor() {
    this.reelStrips = gameConfig.reels as SymbolId[][];
  }

  /** Generate a spin result with random stop positions. */
  spin(): SpinResult {
    const grid = this.generateGrid();
    const wins = this.evaluateWins(grid);
    const totalWin = wins.reduce((sum, w) => sum + w.multiplier, 0);
    return { grid, wins, totalWin };
  }

  /** Generate random visible grid by picking random stop on each reel strip. */
  private generateGrid(): SymbolId[][] {
    const grid: SymbolId[][] = [];

    for (let r = 0; r < REEL_COUNT; r++) {
      const strip = this.reelStrips[r];
      const stopIndex = Random.int(0, strip.length);
      const column: SymbolId[] = [];

      for (let row = 0; row < ROW_COUNT; row++) {
        const idx = (stopIndex + row) % strip.length;
        column.push(strip[idx]);
      }
      grid.push(column);
    }

    return grid;
  }

  /** Evaluate all paylines against the grid. */
  private evaluateWins(grid: SymbolId[][]): WinResult[] {
    const wins: WinResult[] = [];

    for (let pl = 0; pl < PAYLINES.length; pl++) {
      const payline = PAYLINES[pl];
      const firstSymbol = grid[0][payline[0]];
      let matchCount = 1;
      const positions: [number, number][] = [[0, payline[0]]];

      for (let reel = 1; reel < REEL_COUNT; reel++) {
        const sym = grid[reel][payline[reel]];
        if (sym === firstSymbol) {
          matchCount++;
          positions.push([reel, payline[reel]]);
        } else {
          break;
        }
      }

      const multiplier = Paytable.getPayout(firstSymbol, matchCount);
      if (multiplier > 0) {
        wins.push({
          paylineIndex: pl,
          symbol: firstSymbol,
          count: matchCount,
          multiplier,
          positions,
        });
      }
    }

    return wins;
  }

  /**
   * Calculate theoretical RTP using combinatorial probability.
   *
   * RTP = (sum of expected payouts across all paylines × lineBet) / totalBet
   *     = (numPaylines × expectedPayoutPerPayline × lineBet) / (numPaylines × lineBet)
   *     = expectedPayoutPerPayline
   *
   * Since all paylines see independent symbol probabilities and the paytable
   * multipliers are in terms of lineBet, per-payline expected return equals
   * the expected multiplier for one payline. RTP is this value expressed as
   * a fraction of 1 lineBet.
   */
  static calculateRTP(): { rtp: number; breakdown: Record<SymbolId, number> } {
    const probs: Record<SymbolId, number> = {} as Record<SymbolId, number>;
    const totalWeight = SYMBOLS.reduce((sum, s) => sum + SYMBOL_WEIGHTS[s], 0);
    for (const s of SYMBOLS) {
      probs[s] = SYMBOL_WEIGHTS[s] / totalWeight;
    }

    const breakdown: Record<SymbolId, number> = {} as Record<SymbolId, number>;
    let perPaylineReturn = 0;

    for (const symbol of SYMBOLS) {
      const p = probs[symbol];
      let symbolContribution = 0;

      for (let k = 3; k <= 5; k++) {
        const payout = Paytable.getPayout(symbol, k);
        if (payout === 0) continue;

        // Probability of exactly k consecutive matches from left
        const prob = k === 5
          ? Math.pow(p, 5)
          : Math.pow(p, k) * (1 - p);

        symbolContribution += prob * payout;
      }

      breakdown[symbol] = symbolContribution;
      perPaylineReturn += symbolContribution;
    }

    return { rtp: perPaylineReturn, breakdown };
  }
}
