import raw from './config.json';
import { createSkin, detectPlayMode, resolveConfig, type PlayMode, type RawSlotConfig } from '@/engine';

/** demo (default, generous RTP from config.demo) or real (`?mode=real`). */
export const MODE: PlayMode = detectPlayMode();

/** Typed, resolved config; `rtp` is the active profile's (shown in the paytable). */
const rawConfig: RawSlotConfig = { ...raw, rtp: MODE === 'demo' ? raw.demo.rtp : raw.rtp };
export const config = resolveConfig(rawConfig);

/**
 * Probability per payout category, in screens.bin category order. Both
 * profiles share screens.bin; demo only shifts weight to the paying categories
 * (config.demo.payoutProbabilities, priced by tools/demo-rtp.ts).
 */
export const PAYOUT_PROBABILITIES: number[] = MODE === 'demo'
  ? raw.demo.payoutProbabilities
  : raw.payoutDistribution.map(d => d.probability);

/** Skin anchors (config.json → skin.ui, source px), translated captions and scale. */
export const skin = createSkin(config.canvas.width, raw.skin);
export type UiAnchorName = keyof typeof raw.skin.ui;
/** Source mockup pixels → game pixels (UI sprites are sliced at source scale). */
export const SKIN_SCALE = skin.scale;
export const uiAnchor = skin.anchor;

/** Decorative progressive meter in the MEGA JACKPOT plate (not part of the math). */
export const JACKPOT = raw.skin.jackpot;
