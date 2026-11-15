import { Graphics, TextStyle } from 'pixi.js';
import { vGradient, shadow } from './textStyle';

const FONT = '"Roboto Condensed", "Arial Narrow", Arial, Helvetica, sans-serif';

/** Texts of the win box: status line, caption over the amount, the amount. */
export interface WinBoxStyles { status: TextStyle; caption: TextStyle; amount: TextStyle }

export const DEFAULT_STYLES: WinBoxStyles = {
  status: new TextStyle({ fontFamily: FONT, fontSize: 16, fontWeight: 'bold', fill: 0xFFE7A3, stroke: { color: 0x2A0A00, width: 4 } }),
  caption: new TextStyle({ fontFamily: FONT, fontSize: 12, fontWeight: 'bold', fill: vGradient(['#FFE9A6', '#F2B84B']), dropShadow: shadow(1, 0.8, 1) }),
  amount: new TextStyle({ fontFamily: FONT, fontSize: 20, fontWeight: 'bold', fill: vGradient(['#FFF6C8', '#FFC93C', '#FF9A1F'], [0, 0.5, 1]), dropShadow: shadow(1, 0.8, 2) }),
};

/** Dark pill with a gold rim (the box and the empty socket it leaves in the HUD). */
export function drawPanel(g: Graphics, w: number, h: number): Graphics {
  return g
    .roundRect(-w / 2, -h / 2, w, h, h / 2).fill({ color: 0x160912, alpha: 0.96 }).stroke({ width: 2, color: 0xD9A441 })
    .roundRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, h / 2 - 4).stroke({ width: 1, color: 0xFFE7A3, alpha: 0.3 });
}
