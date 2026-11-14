import raw from './config.json';
import { createSkin, resolveConfig, type RawSlotConfig } from '@/engine';

/** Typed, resolved config. The annotation makes tsc validate config.json. */
const rawConfig: RawSlotConfig = raw;
export const config = resolveConfig(rawConfig);

/** Probability per payout category, in screens.bin category order. */
export const PAYOUT_PROBABILITIES: number[] = raw.payoutDistribution.map(d => d.probability);

/** Skin anchors (config.json → skin.ui, source px), translated captions and scale. */
export const skin = createSkin(config.canvas.width, raw.skin);
export type UiAnchorName = keyof typeof raw.skin.ui;
/** Source mockup pixels → game pixels (UI sprites are sliced at source scale). */
export const SKIN_SCALE = skin.scale;
export const uiAnchor = skin.anchor;

/** Decorative progressive meter in the MEGA JACKPOT plate (not part of the math). */
export const JACKPOT = raw.skin.jackpot;
