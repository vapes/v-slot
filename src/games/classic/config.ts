import raw from './config.json';
import { resolveConfig, type RawSlotConfig } from '@/engine';

/** Typed, resolved config. The annotation makes tsc validate config.json. */
const rawConfig: RawSlotConfig = raw;
export const config = resolveConfig(rawConfig);

/** Probability per payout category, in screens.bin category order. */
export const PAYOUT_PROBABILITIES: number[] = raw.payoutDistribution.map(d => d.probability);

/** Source mockup pixels → game pixels (UI sprites are sliced at source scale). */
export const SKIN_SCALE = config.canvas.width / raw.skin.sourceWidth;

/** Decorative progressive meter in the MEGA JACKPOT plate (not part of the math). */
export const JACKPOT = raw.skin.jackpot;

export type UiAnchorName = keyof typeof raw.skin.ui;

/** Skin UI anchor converted from source-mockup to game coordinates. */
export function uiAnchor(name: UiAnchorName): { x: number; y: number; r: number } {
  const a: { x: number; y: number; r?: number } = raw.skin.ui[name];
  return { x: a.x * SKIN_SCALE, y: a.y * SKIN_SCALE, r: (a.r ?? 0) * SKIN_SCALE };
}
