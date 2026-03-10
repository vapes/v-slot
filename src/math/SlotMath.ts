import {
  REEL_COUNT,
  PAYLINES,
  type SymbolId,
} from '../core/Config';
import { Paytable } from './Paytable';
import type { PrecomputedTable } from './PrecomputedTable';

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
  private table: PrecomputedTable | null = null;

  /** Attach a loaded PrecomputedTable; subsequent spin() calls will use it. */
  setTable(table: PrecomputedTable): void {
    this.table = table;
  }

  /** Generate a spin result from the precomputed table. */
  spin(): SpinResult {
    if (!this.table?.isReady) {
      throw new Error('PrecomputedTable is not ready');
    }

    const grid = this.table.pickGrid();
    if (!grid) {
      throw new Error('Failed to pick a precomputed grid');
    }

    const wins = this.evaluateWins(grid);
    const totalWin = wins.reduce((sum, w) => sum + w.multiplier, 0);
    return { grid, wins, totalWin };
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
}
