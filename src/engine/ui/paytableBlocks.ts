import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { SlotConfig } from '../config/SlotConfig';

/** Reusable paytable building blocks. Each returns the next free y. */
export interface PaytableTheme {
  accent: number;
  panel: number;
  header: number;
  overlay: number;
  font: string;
}

export const DEFAULT_THEME: PaytableTheme = {
  accent: 0xFFD700,
  panel: 0x1A1025,
  header: 0x080810,
  overlay: 0x000000,
  font: 'Arial, Helvetica, sans-serif',
};

export const PAD = 20;

export function ptStyle(theme: PaytableTheme, size: number, fill = 0xFFFFFF, extra: Partial<TextStyle> = {}): TextStyle {
  return new TextStyle({ fontFamily: theme.font, fontSize: size, fill, fontWeight: 'bold', ...extra });
}

export function ptText(root: Container, cfg: SlotConfig, theme: PaytableTheme, text: string, y: number, size = 14): number {
  const t = new Text(text, ptStyle(theme, size, 0xFFFFFF, { align: 'center', lineHeight: size * 1.45, fontWeight: 'normal' }));
  t.alpha = 0.8;
  t.anchor.set(0.5, 0);
  t.position.set(cfg.canvas.width / 2, y);
  root.addChild(t);
  return y + t.height;
}

export function ptPanel(root: Container, theme: PaytableTheme, x: number, y: number, w: number, h: number): void {
  const g = new Graphics();
  g.lineStyle(1.5, theme.accent, 0.55);
  g.beginFill(theme.panel, 1);
  g.drawRoundedRect(x, y, w, h, 12);
  g.endFill();
  root.addChild(g);
}

export function ptDivider(root: Container, cfg: SlotConfig, theme: PaytableTheme, text: string, y: number): number {
  const W = cfg.canvas.width;
  const label = new Text(text.toUpperCase(), ptStyle(theme, 12, theme.accent, { letterSpacing: 2.5 }));
  label.anchor.set(0.5);
  label.position.set(W / 2, y + 10);
  const g = new Graphics();
  g.lineStyle(1, theme.accent, 0.35);
  g.moveTo(PAD, y + 10).lineTo(W / 2 - label.width / 2 - 12, y + 10);
  g.moveTo(W / 2 + label.width / 2 + 12, y + 10).lineTo(W - PAD, y + 10);
  root.addChild(g, label);
  return y + 22;
}

/** Mini-grid per payline, 4 per row. */
export function ptPaylines(root: Container, cfg: SlotConfig, theme: PaytableTheme, y: number): number {
  const { cols, rows } = cfg.grid;
  const COLS = 4;
  const GAP = 8;
  const W = (cfg.canvas.width - PAD * 2 - GAP * (COLS - 1)) / COLS;
  const CELL = Math.min(12, Math.floor((W - 16) / cols) - 2);
  const CG = 2;
  const H = rows * (CELL + CG) + 22;

  cfg.paylines.forEach((line, i) => {
    const x = PAD + (i % COLS) * (W + GAP);
    const cy = y + Math.floor(i / COLS) * (H + GAP);
    const g = new Graphics();
    g.beginFill(theme.panel, 1);
    g.drawRoundedRect(x, cy, W, H, 8);
    g.endFill();
    const gx = x + (W - (cols * (CELL + CG) - CG)) / 2;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const on = line[c] === r;
        g.beginFill(on ? theme.accent : 0xFFFFFF, on ? 1 : 0.12);
        g.drawRoundedRect(gx + c * (CELL + CG), cy + 18 + r * (CELL + CG), CELL, CELL, 2);
        g.endFill();
      }
    }
    const num = new Text(`${i + 1}`, ptStyle(theme, 11));
    num.alpha = 0.6;
    num.anchor.set(0.5, 0);
    num.position.set(x + W / 2, cy + 3);
    root.addChild(g, num);
  });

  return y + Math.ceil(cfg.paylines.length / COLS) * (H + GAP) - GAP;
}

export function ptRtp(root: Container, cfg: SlotConfig, theme: PaytableTheme, y: number): number {
  const W = cfg.canvas.width;
  const H = 96;
  const g = new Graphics();
  g.lineStyle(1, theme.accent, 0.35);
  g.beginFill(theme.accent, 0.07);
  g.drawRoundedRect(PAD, y, W - PAD * 2, H, 12);
  g.endFill();
  const label = new Text('RETURN TO PLAYER', ptStyle(theme, 11, 0xFFFFFF, { letterSpacing: 2.5 }));
  label.alpha = 0.5;
  label.anchor.set(0.5, 0);
  label.position.set(W / 2, y + 12);
  const value = new Text(`${(cfg.rtp * 100).toFixed(2)}%`, ptStyle(theme, 34, theme.accent));
  value.anchor.set(0.5, 0);
  value.position.set(W / 2, y + 28);
  const note = new Text('Theoretical RTP over long-term play', ptStyle(theme, 11, 0xFFFFFF, { fontWeight: 'normal' }));
  note.alpha = 0.4;
  note.anchor.set(0.5, 0);
  note.position.set(W / 2, y + 72);
  root.addChild(g, label, value, note);
  return y + H;
}
