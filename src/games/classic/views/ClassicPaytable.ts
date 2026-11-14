import { Container, Sprite, Text } from 'pixi.js';
import {
  formatMoney, linePayout, payingCounts, PAD, ptDivider, ptPanel, ptPaylines, ptRtp, ptStyle, ptText,
  type PaytableTheme,
} from '@/engine';
import { config } from '../config';
import { symbolTexture } from '../assets';

export const CLASSIC_THEME: PaytableTheme = {
  accent: 0xFFD54A,
  panel: 0x0C2457,
  header: 0x061331,
  overlay: 0x030B22,
  font: '"Roboto Condensed", "Arial Narrow", Arial, Helvetica, sans-serif',
};
const T = CLASSIC_THEME;

/** Symbol cards (art + pays for the current bet), lines, RTP. */
export function buildClassicPaytable(root: Container, lineBet: number): number {
  let y = 24;
  y = ptText(root, config, T, 'All symbols pay from left to right on adjacent\nreels starting from the leftmost reel.\nValues shown for the current bet.', y);
  y += 22;
  y = addSymbolGrid(root, y, lineBet);
  y += 24;
  y = ptDivider(root, config, T, `Winning lines (${config.paylines.length})`, y);
  y += 12;
  y = ptPaylines(root, config, T, y);
  y += 20;
  return ptRtp(root, config, T, y) + 48;
}

function addSymbolGrid(root: Container, y: number, lineBet: number): number {
  const COLS = 3;
  const GAP = 12;
  const W = (config.canvas.width - PAD * 2 - GAP * (COLS - 1)) / COLS;
  const H = 182;
  const SQ = 84;

  config.symbolIds.forEach((id, i) => {
    const x = PAD + (i % COLS) * (W + GAP);
    const by = y + Math.floor(i / COLS) * (H + GAP);
    ptPanel(root, T, x, by, W, H);

    const art = new Sprite(symbolTexture(id));
    art.width = SQ;
    art.height = SQ;
    art.position.set(x + (W - SQ) / 2, by + 24);
    const name = new Text(config.symbolName(id).toUpperCase(), ptStyle(T, 10, T.accent, { letterSpacing: 1 }));
    name.anchor.set(0.5, 0);
    name.position.set(x + W / 2, by + 7);

    const lines = payingCounts(config, id).reverse()
      .map(n => `${n} × ${formatMoney(config, linePayout(config, id, n) * lineBet)}`);
    const pays = new Text(lines.join('\n'), ptStyle(T, 14, 0xFFFFFF, { align: 'center', lineHeight: 19 }));
    pays.anchor.set(0.5, 0);
    pays.position.set(x + W / 2, by + SQ + 30);
    root.addChild(art, name, pays);
  });

  return y + Math.ceil(config.symbolIds.length / COLS) * (H + GAP) - GAP;
}
