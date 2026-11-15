import { FillGradient, type TextDropShadow } from 'pixi.js';

/**
 * Vertical text gradient, top → bottom (what Pixi v7 did for `fill: [..]`).
 * `stops` are offsets 0..1; evenly spread when omitted.
 */
export function vGradient(colors: string[], stops?: number[]): FillGradient {
  const last = Math.max(colors.length - 1, 1);
  return new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    textureSpace: 'local',
    colorStops: colors.map((color, i) => ({ offset: stops?.[i] ?? i / last, color })),
  });
}

/** Drop shadow with the v7 defaults (black, angle π/6). */
export function shadow(distance: number, alpha: number, blur = 0, color = 0x000000): TextDropShadow {
  return { distance, alpha, blur, color, angle: Math.PI / 6 };
}
