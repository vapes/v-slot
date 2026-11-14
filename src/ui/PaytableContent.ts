import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import { GAME_WIDTH, SYMBOLS, PAYLINES, REEL_COUNT, ROW_COUNT, WILD, SYMBOL_NAMES } from '../core/Config';
import { symbolTexture } from '../core/SkinAssets';
import { Paytable } from '../math/Paytable';
import { formatMoney } from '../utils/Money';
import gameConfig from '../gameConfig.json';

const GOLD = 0xFFC94A;
const WHITE = 0xFFFFFF;
const PANEL = 0x1C0D22;
const PAD = 20;
const CONTENT_W = GAME_WIDTH - PAD * 2;
const FONT = '"Roboto Condensed", "Arial Narrow", Arial, Helvetica, sans-serif';

const style = (size: number, fill = WHITE, extra: Partial<TextStyle> = {}) =>
  new TextStyle({ fontFamily: FONT, fontSize: size, fill, fontWeight: 'bold', ...extra });

/** Builds the scrollable rules content. Returns its total height. */
export function buildPaytableContent(root: Container, lineBet: number): number {
  let y = 20;
  y = addText(root, 'Wins pay left to right on adjacent reels,\nstarting from the leftmost reel. Values shown for the current bet.', y, 14, 0.75);
  y += 18;
  y = addWildCard(root, y);
  y += 16;
  y = addSymbolGrid(root, y, lineBet);
  y += 24;
  y = addDivider(root, `Winning lines (${PAYLINES.length})`, y);
  y += 10;
  y = addPaylines(root, y);
  y += 20;
  y = addRtp(root, y);
  return y + 40;
}

function addText(root: Container, text: string, y: number, size: number, alpha = 1): number {
  const t = new Text(text, style(size, WHITE, { align: 'center', lineHeight: size * 1.45, fontWeight: 'normal' }));
  t.alpha = alpha;
  t.anchor.set(0.5, 0);
  t.position.set(GAME_WIDTH / 2, y);
  root.addChild(t);
  return y + t.height;
}

function panel(root: Container, x: number, y: number, w: number, h: number): void {
  const g = new Graphics();
  g.lineStyle(1.5, GOLD, 0.55);
  g.beginFill(PANEL, 1);
  g.drawRoundedRect(x, y, w, h, 12);
  g.endFill();
  root.addChild(g);
}

function symbolSprite(id: string, x: number, y: number, w: number): Sprite {
  const s = new Sprite(symbolTexture(id));
  s.width = w;
  s.height = w * 0.744;
  s.position.set(x, y);
  return s;
}

function addWildCard(root: Container, y: number): number {
  const H = 100;
  panel(root, PAD, y, CONTENT_W, H);
  root.addChild(symbolSprite(WILD, PAD + 12, y + 12, 103));
  const title = new Text('WILD', style(22, GOLD, { letterSpacing: 2 }));
  title.position.set(PAD + 132, y + 14);
  const desc = new Text(
    'Appears stacked on reels 2, 3 and 4.\nSubstitutes for all symbols.',
    style(14, WHITE, { fontWeight: 'normal', lineHeight: 20 }),
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
  const paying = SYMBOLS.filter(id => id !== WILD);

  paying.forEach((id, i) => {
    const x = PAD + (i % COLS) * (W + GAP);
    const by = y + Math.floor(i / COLS) * (H + GAP);
    panel(root, x, by, W, H);
    const sw = W - 50;
    root.addChild(symbolSprite(id, x + 25, by + 20, sw));

    const lines = Paytable.payingCounts(id).reverse()
      .map(n => `${n} × ${formatMoney(Paytable.getPayout(id, n) * lineBet, false)}`);
    const pays = new Text(lines.join('\n'), style(13, WHITE, { align: 'center', lineHeight: 17 }));
    pays.anchor.set(0.5, 0);
    pays.position.set(x + W / 2, by + 20 + sw * 0.744 + 4);
    root.addChild(pays);

    const name = new Text(SYMBOL_NAMES[id].toUpperCase(), style(9, GOLD, { letterSpacing: 1 }));
    name.anchor.set(0.5, 0);
    name.alpha = 0.8;
    name.position.set(x + W / 2, by + 5);
    root.addChild(name);
  });

  const rows = Math.ceil(paying.length / COLS);
  return y + rows * (H + GAP) - GAP;
}

function addDivider(root: Container, text: string, y: number): number {
  const label = new Text(text.toUpperCase(), style(12, GOLD, { letterSpacing: 2.5 }));
  label.anchor.set(0.5, 0.5);
  label.position.set(GAME_WIDTH / 2, y + 10);
  const g = new Graphics();
  g.lineStyle(1, GOLD, 0.35);
  g.moveTo(PAD, y + 10).lineTo(GAME_WIDTH / 2 - label.width / 2 - 12, y + 10);
  g.moveTo(GAME_WIDTH / 2 + label.width / 2 + 12, y + 10).lineTo(GAME_WIDTH - PAD, y + 10);
  root.addChild(g, label);
  return y + 22;
}

function addPaylines(root: Container, y: number): number {
  const COLS = 4;
  const GAP = 8;
  const W = (CONTENT_W - GAP * (COLS - 1)) / COLS;
  const CELL = 12;
  const CG = 2;
  const H = ROW_COUNT * (CELL + CG) + 22;

  PAYLINES.forEach((line, i) => {
    const x = PAD + (i % COLS) * (W + GAP);
    const cy = y + Math.floor(i / COLS) * (H + GAP);
    const g = new Graphics();
    g.beginFill(PANEL, 1);
    g.drawRoundedRect(x, cy, W, H, 8);
    g.endFill();

    const gridW = REEL_COUNT * (CELL + CG) - CG;
    const gx = x + (W - gridW) / 2;
    for (let c = 0; c < REEL_COUNT; c++) {
      for (let r = 0; r < ROW_COUNT; r++) {
        const on = line[c] === r;
        g.beginFill(on ? GOLD : WHITE, on ? 1 : 0.12);
        g.drawRoundedRect(gx + c * (CELL + CG), cy + 18 + r * (CELL + CG), CELL, CELL, 2);
        g.endFill();
      }
    }
    const num = new Text(`${i + 1}`, style(11, WHITE));
    num.alpha = 0.6;
    num.anchor.set(0.5, 0);
    num.position.set(x + W / 2, cy + 3);
    root.addChild(g, num);
  });

  const rows = Math.ceil(PAYLINES.length / COLS);
  return y + rows * (H + GAP) - GAP;
}

function addRtp(root: Container, y: number): number {
  const H = 96;
  const g = new Graphics();
  g.lineStyle(1, GOLD, 0.35);
  g.beginFill(GOLD, 0.07);
  g.drawRoundedRect(PAD, y, CONTENT_W, H, 12);
  g.endFill();
  const label = new Text('RETURN TO PLAYER', style(11, WHITE, { letterSpacing: 2.5 }));
  label.alpha = 0.5;
  label.anchor.set(0.5, 0);
  label.position.set(GAME_WIDTH / 2, y + 12);
  const value = new Text(`${(gameConfig.rtp * 100).toFixed(2)}%`, style(34, GOLD));
  value.anchor.set(0.5, 0);
  value.position.set(GAME_WIDTH / 2, y + 28);
  const note = new Text('Theoretical RTP over long-term play', style(11, WHITE, { fontWeight: 'normal' }));
  note.alpha = 0.4;
  note.anchor.set(0.5, 0);
  note.position.set(GAME_WIDTH / 2, y + 72);
  root.addChild(g, label, value, note);
  return y + H;
}
