import { Container } from 'pixi.js';
import type { SlotConfig } from '../config/SlotConfig';
import type { WinResult } from '../math/types';
import type { SlotSymbol } from '../symbols/SlotSymbol';
import type { ReelView } from './ReelView';

interface PromotedSymbol {
  symbol: SlotSymbol;
  reelIndex: number;
  localY: number;
}

const DIM_ALPHA = 0.4;

/**
 * Win highlighting on the landed reels: winning symbols are promoted from
 * their (masked) reel container into `layer` (above the mask) so they can
 * pulse / wear a frame; everything else is dimmed. `demote()` puts them back.
 */
export class WinPresenter {
  readonly layer = new Container();
  private promoted: PromotedSymbol[] = [];

  constructor(private cfg: SlotConfig, private reels: ReelView[]) {}

  /** Highlight `wins`; `decorate` starts the pulse or draws the turbo frame. */
  highlight(wins: WinResult[], decorate: (sym: SlotSymbol) => void): void {
    if (wins.length === 0) return;
    const posSet = new Set<string>();
    for (const win of wins) {
      for (const [reel, row] of win.positions) posSet.add(`${reel},${row}`);
    }
    this.forEachVisible((sym, r, row) => {
      if (posSet.has(`${r},${row}`)) {
        this.promote(sym, r);
        sym.alpha = 1;
        decorate(sym);
      } else {
        sym.alpha = DIM_ALPHA;
      }
    });
  }

  /** Stop every pulse and undim (used before showing a single line). */
  resetAll(): void {
    this.forEachVisible((sym) => sym.stopWinAnimation());
  }

  /** Restore full alpha on every visible symbol. */
  undim(): void {
    this.forEachVisible((sym) => { sym.alpha = 1; });
  }

  update(dt: number): void {
    for (const { symbol } of this.promoted) symbol.updateWinAnimation(dt);
  }

  /** Move promoted symbols back into their reels. */
  demote(): void {
    for (const { symbol, reelIndex, localY } of this.promoted) {
      symbol.stopWinAnimation();
      symbol.alpha = 1;
      this.layer.removeChild(symbol);
      symbol.x = 0;
      symbol.y = localY;
      this.reels[reelIndex].symbolContainer.addChild(symbol);
    }
    this.promoted = [];
  }

  forEachVisible(fn: (sym: SlotSymbol, reel: number, row: number) => void): void {
    for (let r = 0; r < this.cfg.grid.cols; r++) {
      const visible = this.reels[r].getVisibleSymbols();
      for (let row = 0; row < this.cfg.grid.rows; row++) {
        const sym = visible[row];
        if (sym) fn(sym, r, row);
      }
    }
  }

  private promote(sym: SlotSymbol, reelIndex: number): void {
    if (sym.parent === this.layer) return;
    const localY = sym.y;
    sym.parent?.removeChild(sym);
    sym.x = reelIndex * this.cfg.reelWidth;
    sym.y = localY;
    this.layer.addChild(sym);
    this.promoted.push({ symbol: sym, reelIndex, localY });
  }
}
