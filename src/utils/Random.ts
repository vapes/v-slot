import { SYMBOL_WEIGHTS, SYMBOLS, type SymbolId } from '../core/Config';

const TOTAL_WEIGHT = SYMBOLS.reduce((sum, s) => sum + SYMBOL_WEIGHTS[s], 0);

export class Random {
  /** Pick a single symbol using the visual blur weights. */
  static weightedPick(): SymbolId {
    let roll = Math.random() * TOTAL_WEIGHT;
    for (const symbol of SYMBOLS) {
      roll -= SYMBOL_WEIGHTS[symbol];
      if (roll <= 0) return symbol;
    }
    return SYMBOLS[SYMBOLS.length - 1];
  }

  /** Generate a random integer in [min, max). */
  static int(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min)) + min;
  }
}
