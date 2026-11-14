import { Container, Graphics } from 'pixi.js';
import {
  REEL_COUNT,
  ROW_COUNT,
  REEL_WIDTH,
  CELL_HEIGHT,
  REEL_AREA_WIDTH,
  REEL_AREA_HEIGHT,
  REEL_OFFSET_X,
  REEL_OFFSET_Y,
} from '../core/Config';
import { Reel } from './Reel';
import { SymbolFactory } from '../symbols/SymbolFactory';
import type { SpinResult, WinResult } from '../math/SlotMath';
import type { SlotSymbol } from '../symbols/Symbol';
import { spin as spinConfig } from '../gameConfig.json';

interface PromotedSymbol {
  symbol: SlotSymbol;
  reelIndex: number;
  localY: number;
}

const DIM_ALPHA = 0.4;

export class ReelController {
  readonly container: Container;
  private reels: Reel[] = [];
  private factory: SymbolFactory;
  private spinning = false;
  private reelsStopped = 0;
  private onAllStoppedCallback: (() => void) | null = null;

  private reelLayer: Container;
  private winLayer: Container;
  private promotedSymbols: PromotedSymbol[] = [];

  constructor() {
    this.factory = new SymbolFactory();
    this.container = new Container();
    this.container.x = REEL_OFFSET_X;
    this.container.y = REEL_OFFSET_Y;

    // Masked layer for all reels (the reel window frame is part of the background)
    this.reelLayer = new Container();
    const mask = new Graphics();
    mask.beginFill(0xFFFFFF);
    mask.drawRect(0, 0, REEL_AREA_WIDTH, REEL_AREA_HEIGHT);
    mask.endFill();
    this.reelLayer.addChild(mask);
    this.reelLayer.mask = mask;
    this.container.addChild(this.reelLayer);

    for (let i = 0; i < REEL_COUNT; i++) {
      const reel = new Reel(this.factory);
      reel.container.x = i * REEL_WIDTH;
      this.reelLayer.addChild(reel.container);
      this.reels.push(reel);
    }

    this.container.addChild(this.buildSeparators());

    // Win layer (above mask — winning symbols render here unclipped)
    this.winLayer = new Container();
    this.container.addChild(this.winLayer);
  }

  /** Thin golden grid lines between cells, matching the skin's reel frame. */
  private buildSeparators(): Graphics {
    const g = new Graphics();
    g.lineStyle(1.5, 0xC8962E, 0.75);
    for (let i = 1; i < REEL_COUNT; i++) {
      g.moveTo(i * REEL_WIDTH, 0);
      g.lineTo(i * REEL_WIDTH, REEL_AREA_HEIGHT);
    }
    for (let r = 1; r < ROW_COUNT; r++) {
      g.moveTo(0, r * CELL_HEIGHT);
      g.lineTo(REEL_AREA_WIDTH, r * CELL_HEIGHT);
    }
    return g;
  }

  get isSpinning(): boolean {
    return this.spinning;
  }

  startSpin(result: SpinResult, onComplete: () => void): void {
    if (!this.beginSpin(onComplete)) return;
    const { reelStartInterval, scrollScreens } = spinConfig;
    for (let i = 0; i < REEL_COUNT; i++) {
      const screens = scrollScreens[i] ?? (i + 1);
      setTimeout(() => {
        this.reels[i].startSpin(result.grid[i], screens, () => this.onReelStopped());
      }, i * reelStartInterval);
    }
  }

  startTurboSpin(result: SpinResult, onComplete: () => void): void {
    if (!this.beginSpin(onComplete)) return;
    for (let i = 0; i < REEL_COUNT; i++) {
      this.reels[i].startSpin(result.grid[i], 1, () => this.onReelStopped(), true);
    }
  }

  /** Instantly stop all spinning reels and snap to their targets. */
  forceStop(): void {
    if (!this.spinning) return;
    for (const reel of this.reels) reel.forceStop();
  }

  private beginSpin(onComplete: () => void): boolean {
    if (this.spinning) return false;
    this.spinning = true;
    this.reelsStopped = 0;
    this.onAllStoppedCallback = onComplete;
    this.demoteWinSymbols();
    this.forEachVisible((sym) => {
      sym.stopWinAnimation();
      sym.alpha = 1;
    });
    return true;
  }

  private onReelStopped(): void {
    this.reelsStopped++;
    if (this.reelsStopped === REEL_COUNT) {
      this.spinning = false;
      this.onAllStoppedCallback?.();
    }
  }

  update(dt: number): void {
    for (const reel of this.reels) reel.update(dt);
    for (const { symbol } of this.promotedSymbols) symbol.updateWinAnimation(dt);
  }

  /** Highlight every winning position with a pulse; dim the rest. */
  showWins(result: SpinResult, cycleMs = 1500): void {
    this.highlight(result.wins, (sym) => sym.startWinAnimation(cycleMs));
  }

  /** Turbo win display: static gold frame on winners, dim losers. */
  showWinsTurbo(result: SpinResult): void {
    this.highlight(result.wins, (sym) => sym.showTurboHighlight());
  }

  /** Show only the symbols belonging to a single winning line. */
  showWinLine(win: WinResult, cycleMs = 1500): void {
    this.demoteWinSymbols();
    this.forEachVisible((sym) => sym.stopWinAnimation());
    this.highlight([win], (sym) => sym.startWinAnimation(cycleMs));
  }

  /** Clear win highlights and restore all symbols. */
  clearWins(): void {
    this.demoteWinSymbols();
    this.forEachVisible((sym) => { sym.alpha = 1; });
  }

  private highlight(wins: WinResult[], decorate: (sym: SlotSymbol) => void): void {
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

  private forEachVisible(fn: (sym: SlotSymbol, reel: number, row: number) => void): void {
    for (let r = 0; r < REEL_COUNT; r++) {
      const visible = this.reels[r].getVisibleSymbols();
      for (let row = 0; row < ROW_COUNT; row++) {
        const sym = visible[row];
        if (sym) fn(sym, r, row);
      }
    }
  }

  private promote(sym: SlotSymbol, reelIndex: number): void {
    if (sym.parent === this.winLayer) return;
    const localY = sym.y;
    sym.parent?.removeChild(sym);
    sym.x = reelIndex * REEL_WIDTH;
    sym.y = localY;
    this.winLayer.addChild(sym);
    this.promotedSymbols.push({ symbol: sym, reelIndex, localY });
  }

  private demoteWinSymbols(): void {
    for (const { symbol, reelIndex, localY } of this.promotedSymbols) {
      symbol.stopWinAnimation();
      symbol.alpha = 1;
      this.winLayer.removeChild(symbol);
      symbol.x = 0;
      symbol.y = localY;
      this.reels[reelIndex].symbolContainer.addChild(symbol);
    }
    this.promotedSymbols = [];
  }
}
