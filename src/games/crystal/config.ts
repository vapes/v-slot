import raw from './config.json';
import { createSkin, resolveConfig, type RawSlotConfig } from '@/engine';
import type { RawCrystalMath } from './math/profile';

/** Typed, resolved config (one profile: real ≈96% in every play mode). */
const rawConfig: RawSlotConfig = { ...raw, payMode: 'anywhere' };
export const config = Object.assign(resolveConfig(rawConfig), { maxWin: raw.maxWin });

/** Weight tables, free spins and buy settings (config.json → math). */
export const MATH: RawCrystalMath = raw.math;

/** Skin anchors (config.json → skin.ui, art px at sourceWidth), translated captions and scale. */
export const skin = createSkin(config.canvas.width, raw.skin);
export type UiAnchorName = keyof typeof raw.skin.ui;
export const SKIN_SCALE = skin.scale;
export const uiAnchor = skin.anchor;
