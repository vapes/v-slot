import type { Text } from 'pixi.js';

/** Shrink a Text uniformly so it is at most maxWidth wide (translations vary in length). */
export function fitText(text: Text, maxWidth: number): Text {
  text.scale.set(1);
  if (text.width > maxWidth) text.scale.set(maxWidth / text.width);
  return text;
}
