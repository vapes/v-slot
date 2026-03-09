import { SYMBOL_WEIGHTS, SYMBOLS, REEL_STRIP_LENGTH, type SymbolId } from '../core/Config';

export class Random {
  /** Build a weighted reel strip of given length. */
  static buildReelStrip(length: number = REEL_STRIP_LENGTH): SymbolId[] {
    const strip: SymbolId[] = [];
    const totalWeight = SYMBOLS.reduce((sum, s) => sum + SYMBOL_WEIGHTS[s], 0);

    // Fill strip according to weights
    for (const symbol of SYMBOLS) {
      const count = Math.round((SYMBOL_WEIGHTS[symbol] / totalWeight) * length);
      for (let i = 0; i < count; i++) {
        strip.push(symbol);
      }
    }

    // Pad or trim to exact length
    while (strip.length < length) {
      strip.push(this.weightedPick());
    }
    while (strip.length > length) {
      strip.pop();
    }

    // Fisher-Yates shuffle
    for (let i = strip.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [strip[i], strip[j]] = [strip[j], strip[i]];
    }

    return strip;
  }

  /** Pick a single symbol using weighted probabilities. */
  static weightedPick(): SymbolId {
    const totalWeight = SYMBOLS.reduce((sum, s) => sum + SYMBOL_WEIGHTS[s], 0);
    let roll = Math.random() * totalWeight;

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
