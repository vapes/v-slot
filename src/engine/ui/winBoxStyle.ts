import { Graphics, TextStyle } from 'pixi.js';
import { vGradient, shadow } from './textStyle';

const FONT = '"Roboto Condensed", "Arial Narrow", Arial, Helvetica, sans-serif';

/** Panel of the win box: fill, rim, inner hairline; `radius` null = pill (h / 2). */
export interface WinBoxPanel { fill: number; alpha: number; stroke: number; inner: number; radius: number | null }

/** Look of the win box: status line, caption over the amount, the amount, the panel. */
export interface WinBoxStyles { status: TextStyle; caption: TextStyle; amount: TextStyle; panel: WinBoxPanel }

/**
 * Where the game wants the engine win box (GameView.winBox): centre and size
 * in game px — usually exactly over a baked HUD panel — plus optional styles.
 */
export interface WinBoxLayout { x: number; y: number; w: number; h: number; styles?: Partial<WinBoxStyles> }

export const DEFAULT_STYLES: WinBoxStyles = {
  status: new TextStyle({ fontFamily: FONT, fontSize: 16, fontWeight: 'bold', fill: 0xFFE7A3, stroke: { color: 0x2A0A00, width: 4 } }),
  caption: new TextStyle({ fontFamily: FONT, fontSize: 12, fontWeight: 'bold', fill: vGradient(['#FFE9A6', '#F2B84B']), dropShadow: shadow(1, 0.8, 1) }),
  amount: new TextStyle({ fontFamily: FONT, fontSize: 20, fontWeight: 'bold', fill: vGradient(['#FFF6C8', '#FFC93C', '#FF9A1F'], [0, 0.5, 1]), dropShadow: shadow(1, 0.8, 2) }),
  panel: { fill: 0x160912, alpha: 0.96, stroke: 0xD9A441, inner: 0xFFE7A3, radius: null },
};

/** The box panel (also the empty socket it leaves in the HUD). */
export function drawPanel(g: Graphics, w: number, h: number, p: WinBoxPanel): Graphics {
  const r = p.radius ?? h / 2;
  return g
    .roundRect(-w / 2, -h / 2, w, h, r).fill({ color: p.fill, alpha: p.alpha }).stroke({ width: 2, color: p.stroke })
    .roundRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, Math.max(r - 4, 0)).stroke({ width: 1, color: p.inner, alpha: 0.3 });
}

/** Glow ring around the panel while the box is on the reels. */
export function drawGlow(g: Graphics, w: number, h: number, p: WinBoxPanel): Graphics {
  const r = (p.radius ?? h / 2) + 4;
  return g.roundRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, r).stroke({ width: 6, color: 0xFFC94A });
}
