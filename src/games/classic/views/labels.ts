import { Text, type TextStyle } from 'pixi.js';
import { fitText, t, type SpriteButton } from '@/engine';
import { uiAnchor, type UiAnchorName } from '../config';

/** Translated caption placed on a skin anchor (art text was erased by the slicer). */
export function skinLabel(anchor: UiAnchorName, key: string, style: TextStyle): Text {
  const a = uiAnchor(anchor);
  const text = new Text(t(key), style);
  text.anchor.set(0.5);
  text.position.set(a.x, a.y);
  return fitText(text, a.w);
}

/** Translated caption on a button; the anchor is absolute, converted to a button offset. */
export function labelButton(button: SpriteButton, anchor: UiAnchorName, key: string, style: TextStyle): void {
  const a = uiAnchor(anchor);
  const c = button.container.position;
  button.setLabel(new Text(t(key), style), a.x - c.x, a.y - c.y, a.w);
}
