import type { SlotConfig } from '../config/SlotConfig';

/** Multiplier of the line bet for `count` matching symbols (0 = no win). */
export function linePayout(cfg: SlotConfig, symbol: string, count: number): number {
  const effective = Math.min(count, cfg.grid.cols);
  return cfg.paytable[symbol]?.[String(effective)] ?? 0;
}

/** Line bet in minor units for a total bet. */
export function lineBetOf(cfg: SlotConfig, totalBet: number): number {
  return totalBet / cfg.paylines.length;
}
