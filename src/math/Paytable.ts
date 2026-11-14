import gameConfig from '../gameConfig.json';
import { REEL_COUNT, type SymbolId } from '../core/Config';

export interface PayEntry {
  symbol: SymbolId;
  count: number;
  multiplier: number;
}

/**
 * Payout multipliers of the LINE BET (line bet = total bet / number of lines).
 * Wild substitutes for every paying symbol and pays nothing on its own.
 * Theoretical RTP (exact enumeration, see scripts/build-reels.mjs): gameConfig.rtp.
 */
const PAY_MAP = gameConfig.paytable as Record<SymbolId, Record<string, number>>;

export class Paytable {
  /** Payout multiplier for a symbol and match count. Returns 0 if no win. */
  static getPayout(symbol: SymbolId, matchCount: number): number {
    const effective = Math.min(matchCount, REEL_COUNT);
    return PAY_MAP[symbol]?.[String(effective)] ?? 0;
  }

  /** Match counts that pay, ascending (e.g. [3, 4]). */
  static payingCounts(symbol: SymbolId): number[] {
    return Object.keys(PAY_MAP[symbol] ?? {}).map(Number).sort((a, b) => a - b);
  }

  /** Get all pay entries for display. */
  static getAllEntries(): PayEntry[] {
    const entries: PayEntry[] = [];
    for (const symbol of Object.keys(PAY_MAP)) {
      for (const count of this.payingCounts(symbol)) {
        entries.push({ symbol, count, multiplier: PAY_MAP[symbol][String(count)] });
      }
    }
    return entries;
  }
}
