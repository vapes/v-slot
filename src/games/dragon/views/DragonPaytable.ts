import { Container, Sprite, Text } from 'pixi.js';
import {
  formatMoney, linePayout, payingCounts, PAD, ptDivider, ptPanel, ptPaylines, ptRtp, ptStyle, ptText,
  type PaytableTheme,
} from '@/engine';
import { config } from '../config';
import { symbolTexture } from '../assets';

export const DRAGON_THEME: PaytableTheme = {
  accent: 0xFFC94A,
  panel: 0x1C0D22,
  header: 0x14081A,
  overlay: 0x0B0410,
  font: '"Roboto Condensed", "Arial Narrow", Arial, Helvetica, sans-serif',
};

const T = DRAGON_THEME;
const CONTENT_W = config.canvas.width - PAD * 2;
const WILD = config.wild ?? '';

/** Paytable body: wild card, symbol pays for the current bet, lines, RTP. */
export function buildDragonPaytable(root: Container, lineBet: number): number {
  let y = 20;
  y = ptText(root, config, T, 'Wins pay left to right on adjacent reels,\nstarting from the leftmost reel. Values shown for the current bet.', y);
  y += 18;
  y = addWildCard(root, y);
  y += 16;
  y = addSymbolGrid(root, y, lineBet);
  y += 24;
  y = ptDivider(root, config, T, `Winning lines (${config.paylines.length})`, y);
  y += 10;
  y = ptPaylines(root, config, T, y);
  y += 20;
  return ptRtp(root, config, T, y) + 40;
}

function symbolSprite(id: string, x: number, y: number, w: number): Sprite {
  const s = new Sprite(symbolTexture(id));
  s.width = w;
  s.height = w * config.symbol.height / config.symbol.width;
  s.position.set(x, y);
  return s;
}

function addWildCard(root: Container, y: number): number {
  const H = 100;
  ptPanel(root, T, PAD, y, CONTENT_W, H);
  root.addChild(symbolSprite(WILD, PAD + 12, y + 12, 103));
  const title = new Text('WILD', ptStyle(T, 22, T.accent, { letterSpacing: 2 }));
  title.position.set(PAD + 132, y + 14);
  const desc = new Text(
    'Appears stacked on reels 2, 3 and 4.\nSubstitutes for all symbols.',
    ptStyle(T, 14, 0xFFFFFF, { fontWeight: 'normal', lineHeight: 20 }),
  );
  desc.position.set(PAD + 132, y + 46);
  root.addChild(title, desc);
  return y + H;
}

function addSymbolGrid(root: Container, y: number, lineBet: number): number {
  const COLS = 3;
  const GAP = 10;
  const W = (CONTENT_W - GAP * (COLS - 1)) / COLS;
  const H = 140;
  const paying = config.symbolIds.filter(id => id !== WILD);

  paying.forEach((id, i) => {
    const x = PAD + (i % COLS) * (W + GAP);
    const by = y + Math.floor(i / COLS) * (H + GAP);
    ptPanel(root, T, x, by, W, H);
    const sw = W - 50;
    root.addChild(symbolSprite(id, x + 25, by + 20, sw));

    const lines = payingCounts(config, id).reverse()
      .map(n => `${n} × ${formatMoney(config, linePayout(config, id, n) * lineBet, false)}`);
    const pays = new Text(lines.join('\n'), ptStyle(T, 13, 0xFFFFFF, { align: 'center', lineHeight: 17 }));
    pays.anchor.set(0.5, 0);
    pays.position.set(x + W / 2, by + 20 + sw * config.symbol.height / config.symbol.width + 4);

    const name = new Text(config.symbolName(id).toUpperCase(), ptStyle(T, 9, T.accent, { letterSpacing: 1 }));
    name.anchor.set(0.5, 0);
    name.alpha = 0.8;
    name.position.set(x + W / 2, by + 5);
    root.addChild(pays, name);
  });

  return y + Math.ceil(paying.length / COLS) * (H + GAP) - GAP;
}
