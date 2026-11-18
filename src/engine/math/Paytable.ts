import type { SlotConfig } from '../config/SlotConfig';
import { anywherePayout } from './payAnywhere';

/** Multiplier of the line bet for `count` matching symbols (0 = no win). */
export function linePayout(cfg: SlotConfig, symbol: string, count: number): number {
  if (cfg.payMode === 'anywhere') return anywherePayout(cfg, symbol, count);
  const effective = Math.min(count, cfg.grid.cols);
  return cfg.paytable[symbol]?.[String(effective)] ?? 0;
}

/** Bet unit in minor units for a total bet: the line bet, or the total bet when the game pays anywhere. */
export function lineBetOf(cfg: SlotConfig, totalBet: number): number {
  return cfg.payMode === 'anywhere' || cfg.paylines.length === 0 ? totalBet : totalBet / cfg.paylines.length;
}
