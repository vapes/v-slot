import { Text, type TextStyle } from 'pixi.js';
import { t } from '../i18n/I18n';
import { fitText } from './fitText';
import type { SpriteButton } from './SpriteButton';

/** Anchor as stored in config.json → skin.ui, in SOURCE-mockup pixels. */
export interface SkinAnchorRaw { x: number; y: number; r?: number; w?: number; s?: number }

/** Anchor in game pixels: centre, hit radius r, max label width w, extra sprite scale s. */
export interface SkinAnchor { x: number; y: number; r: number; w: number; s: number }

export interface Skin<K extends string> {
  /** Source-mockup pixels → game pixels. */
  readonly scale: number;
  anchor(name: K): SkinAnchor;
  /** Translated caption (i18n `key`) centred on an anchor, shrunk to its `w`. */
  label(name: K, key: string, style: TextStyle): Text;
  /** Translated caption on a button, placed at an absolute anchor. */
  labelButton(button: SpriteButton, name: K, key: string, style: TextStyle): void;
}

/**
 * Helpers for a skin sliced from one mockup image: every anchor lives in
 * config.json → skin.ui in source pixels and is scaled to the canvas here.
 */
export function createSkin<K extends string>(
  canvasWidth: number,
  raw: { sourceWidth: number; ui: Record<K, SkinAnchorRaw> },
): Skin<K> {
  const scale = canvasWidth / raw.sourceWidth;
  const anchor = (name: K): SkinAnchor => {
    const a = raw.ui[name];
    return { x: a.x * scale, y: a.y * scale, r: (a.r ?? 0) * scale, w: (a.w ?? 0) * scale, s: a.s ?? 1 };
  };
  return {
    scale,
    anchor,
    label(name, key, style) {
      const a = anchor(name);
      const text = new Text({ text: t(key), style: style });
      text.anchor.set(0.5);
      text.position.set(a.x, a.y);
      return fitText(text, a.w);
    },
    labelButton(button, name, key, style) {
      const a = anchor(name);
      const c = button.container.position;
      button.setLabel(new Text({ text: t(key), style: style }), a.x - c.x, a.y - c.y, a.w);
    },
  };
}
