import raw from './config.json';
import { resolveConfig, type RawSlotConfig } from '@/engine';

/** Typed, resolved config. The annotation makes tsc validate config.json. */
const rawConfig: RawSlotConfig = raw;
export const config = resolveConfig(rawConfig);

/** Source mockup pixels → game pixels (UI sprites are sliced at source scale). */
export const SKIN_SCALE = config.canvas.width / raw.skin.sourceWidth;

export type UiAnchorName = keyof typeof raw.skin.ui;

/** Skin UI anchor converted from source-mockup to game coordinates. */
export function uiAnchor(name: UiAnchorName): { x: number; y: number; r: number } {
  const a: { x: number; y: number; r?: number } = raw.skin.ui[name];
  return { x: a.x * SKIN_SCALE, y: a.y * SKIN_SCALE, r: (a.r ?? 0) * SKIN_SCALE };
}

export const REEL_STRIPS: string[][] = raw.reels;
