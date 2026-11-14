import { Container, Graphics, Text } from 'pixi.js';
import {
  DEFAULT_THEME, formatMoney, linePayout, payingCounts, PAD, ptDivider, ptPanel, ptPaylines, ptRtp, ptStyle, ptText,
} from '@/engine';
import { config, SYMBOL_COLORS } from '../config';

const T = DEFAULT_THEME;

/** Symbol boxes (colour tile + pays for the current bet), lines, RTP. */
export function buildClassicPaytable(root: Container, lineBet: number): number {
  let y = 24;
  y = ptText(root, config, T, 'All symbols pay from left to right\non adjacent reels starting from the\nleftmost reel.', y, 15);
  y += 24;
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
  const GAP = 14;
  const W = Math.floor((config.canvas.width - PAD * 2 - GAP * (COLS - 1)) / COLS);
  const H = 160;
  const SQ = 64;

  config.symbolIds.forEach((id, i) => {
    const x = PAD + (i % COLS) * (W + GAP);
    const by = y + Math.floor(i / COLS) * (H + GAP);
    ptPanel(root, T, x, by, W, H);

    const sq = new Graphics();
    sq.lineStyle(2, T.accent, 0.4);
    sq.beginFill(SYMBOL_COLORS[id], 0.85);
    sq.drawRoundedRect(x + (W - SQ) / 2, by + 12, SQ, SQ, 10);
    sq.endFill();
    const letter = new Text(id, ptStyle(T, 28));
    letter.anchor.set(0.5);
    letter.position.set(x + W / 2, by + 12 + SQ / 2);

    const lines = payingCounts(config, id).reverse()
      .map(n => `${n} – ${formatMoney(config, linePayout(config, id, n) * lineBet)}`);
    const pays = new Text(lines.join('\n'), ptStyle(T, 14, 0xFFFFFF, { align: 'center', lineHeight: 19 }));
    pays.anchor.set(0.5, 0);
    pays.position.set(x + W / 2, by + SQ + 22);
    root.addChild(sq, letter, pays);
  });

  return y + Math.ceil(config.symbolIds.length / COLS) * (H + GAP) - GAP;
}
