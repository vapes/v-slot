import type { SymbolId } from '../core/Config';

export interface PayEntry {
  symbol: SymbolId;
  count: number;
  multiplier: number;
}

/**
 * Paytable definition.
 * Payouts are multipliers of the LINE BET (not total bet).
 *
 * Symbol tiers (highest to lowest):
 *   V → A → P → E → S
 *
 * Designed for ~98% RTP with 20 paylines and weighted reels:
 *   V=10%, A=13.3%, P=20%, E=26.7%, S=30%
 */
const PAY_MAP: Record<SymbolId, Record<number, number>> = {
  V: { 3: 50,  4: 185, 5: 900 },
  A: { 3: 25,  4: 90,  5: 450 },
  P: { 3: 14,  4: 45,  5: 225 },
  E: { 3: 9,   4: 22,  5: 95 },
  S: { 3: 5,   4: 10,  5: 45 },
};

export class Paytable {
  /** Get payout multiplier for a given symbol and match count. Returns 0 if no win. */
  static getPayout(symbol: SymbolId, matchCount: number): number {
    if (matchCount < 3) return 0;
    const effective = Math.min(matchCount, 5);
    return PAY_MAP[symbol]?.[effective] ?? 0;
  }

  /** Get all pay entries for display. */
  static getAllEntries(): PayEntry[] {
    const entries: PayEntry[] = [];
    for (const symbol of Object.keys(PAY_MAP) as SymbolId[]) {
      for (const count of [3, 4, 5]) {
        entries.push({
          symbol,
          count,
          multiplier: PAY_MAP[symbol][count],
        });
      }
    }
    return entries;
  }
}
