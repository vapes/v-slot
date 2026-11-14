import { Graphics, LINE_CAP, LINE_JOIN } from 'pixi.js';
import { color, type SlotConfig } from '../config/SlotConfig';
import type { WinResult } from '../math/types';

const DEFAULT_COLORS = [
  0xFFD54A, 0xFF5252, 0x40C4FF, 0x69F0AE, 0xE040FB, 0xFFAB40, 0x18FFFF, 0xEEFF41, 0xFF4081, 0x7C4DFF,
  0xB2FF59, 0xFF6E40, 0x64FFDA, 0xEA80FC, 0xFFFF00, 0x448AFF, 0xFF8A80, 0xCCFF90, 0x84FFFF, 0xFFD180,
];

/** Payline paths drawn over the reels (through every reel, like a classic line slot). */
export class WinLines {
  readonly graphics = new Graphics();
  private readonly colors: number[];

  constructor(private cfg: SlotConfig) {
    const custom = cfg.winPresentation?.lineColors;
    this.colors = custom?.length ? custom.map(color) : DEFAULT_COLORS;
  }

  get enabled(): boolean {
    return this.cfg.winPresentation?.drawLines ?? false;
  }

  show(wins: WinResult[]): void {
    this.clear();
    if (!this.enabled) return;
    for (const win of wins) this.drawLine(win.paylineIndex);
  }

  clear(): void {
    this.graphics.clear();
  }

  private drawLine(index: number): void {
    const { reelWidth, cellHeight, symbol, paylines } = this.cfg;
    const line = paylines[index];
    const c = this.colors[index % this.colors.length];
    const pts = line.map((row, reel) => [reel * reelWidth + symbol.width / 2, row * cellHeight + symbol.height / 2]);
    // extend a little past the outer reels
    const first = [pts[0][0] - symbol.width / 2, pts[0][1]];
    const last = [pts[pts.length - 1][0] + symbol.width / 2, pts[pts.length - 1][1]];
    const path = [first, ...pts, last];

    for (const [width, alpha, tint] of [[9, 0.35, 0x000000], [5, 1, c]] as const) {
      this.graphics.lineStyle({ width, color: tint, alpha, cap: LINE_CAP.ROUND, join: LINE_JOIN.ROUND });
      this.graphics.moveTo(path[0][0], path[0][1]);
      for (const [x, y] of path.slice(1)) this.graphics.lineTo(x, y);
    }
  }
}
