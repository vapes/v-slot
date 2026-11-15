import raw from './config.json';
import strips from './strips.json';
import { detectPlayMode, createSkin, resolveConfig, type RawSlotConfig } from '@/engine';
import { buildProfile, type MathMode } from './math/respinConfig';

/** demo (default, generous RTP from config.demo) or real (`?mode=real`). */
export const MODE: MathMode = detectPlayMode();

/** Typed, resolved config; `rtp` and the feature-buy price are the active profile's (shown in the paytable). */
const merged = {
  ...raw,
  rtp: MODE === 'demo' ? raw.demo.rtp : raw.rtp,
  buyFeature: MODE === 'demo' ? raw.demo.buyFeature : raw.buyFeature,
};
const rawConfig: RawSlotConfig = merged;
export const config = resolveConfig(rawConfig);

/** Skin anchors (config.json → skin.ui, source px), translated captions and scale. */
export const skin = createSkin(config.canvas.width, raw.skin);
export type UiAnchorName = keyof typeof raw.skin.ui;
/** Source mockup pixels → game pixels (UI sprites are sliced at source scale). */
export const SKIN_SCALE = skin.scale;
export const uiAnchor = skin.anchor;

/** Base + nest strips and Dragon's Nest settings for the active mode (see math/DragonMath.ts, GAME.md). */
export const MATH = buildProfile(raw, strips, MODE);
