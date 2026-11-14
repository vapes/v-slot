import raw from './config.json';
import strips from './strips.json';
import { detectPlayMode, resolveConfig, type RawSlotConfig } from '@/engine';
import { buildProfile, type MathMode } from './math/respinConfig';

/** demo (default, generous RTP from config.demo) or real (`?mode=real`). */
export const MODE: MathMode = detectPlayMode();

/** Typed, resolved config; `rtp` is the active profile's (shown in the paytable). */
const merged = { ...raw, rtp: MODE === 'demo' ? raw.demo.rtp : raw.rtp };
const rawConfig: RawSlotConfig = merged;
export const config = resolveConfig(rawConfig);

/** Source mockup pixels → game pixels (UI sprites are sliced at source scale). */
export const SKIN_SCALE = config.canvas.width / raw.skin.sourceWidth;

export type UiAnchorName = keyof typeof raw.skin.ui;

/** Skin UI anchor converted from source-mockup to game coordinates (r = hit radius, w = max label width). */
export function uiAnchor(name: UiAnchorName): { x: number; y: number; r: number; w: number } {
  const a: { x: number; y: number; r?: number; w?: number } = raw.skin.ui[name];
  return { x: a.x * SKIN_SCALE, y: a.y * SKIN_SCALE, r: (a.r ?? 0) * SKIN_SCALE, w: (a.w ?? 0) * SKIN_SCALE };
}

/** Base + nest strips and Dragon's Nest settings for the active mode (see math/DragonMath.ts, GAME.md). */
export const MATH = buildProfile(raw, strips, MODE);
