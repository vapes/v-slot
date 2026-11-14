import raw from './config.json';
import { resolveConfig, type RawSlotConfig } from '@/engine';

const rawConfig: RawSlotConfig = raw;
export const config = resolveConfig(rawConfig);

/** Tile colour per symbol id (classic draws symbols with Graphics). */
export const SYMBOL_COLORS: Record<string, number> = Object.fromEntries(
  raw.symbols.map(s => [s.id, Number(s.color)]),
);

/** Probability per payout category, in screens.bin category order. */
export const PAYOUT_PROBABILITIES: number[] = raw.payoutDistribution.map(d => d.probability);
