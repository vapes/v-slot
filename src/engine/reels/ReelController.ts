import { Container, Graphics } from 'pixi.js';
import { color, type SlotConfig } from '../config/SlotConfig';
import { Reel } from './Reel';
import { SymbolFactory } from '../symbols/SymbolFactory';
import type { SpinResult, WinResult } from '../math/types';
import type { SlotSymbol } from '../symbols/SlotSymbol';
import type { SymbolRenderer } from '../contracts';
import { createSymbolPicker } from '../utils/Random';

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
  /** Layer for feature visuals that sit on top of cells (sticky symbols). */
  readonly overlay = new Container();
  /** While set (e.g. during a feature) spinning blur symbols come only from this pool. */
  private blurPool: string[] | null = null;
  private promotedSymbols: PromotedSymbol[] = [];
  private readonly reelCount: number;
  private readonly rowCount: number;
  private readonly reelWidth: number;

  constructor(private cfg: SlotConfig, renderer: SymbolRenderer) {
    this.reelCount = cfg.grid.cols;
    this.rowCount = cfg.grid.rows;
    this.reelWidth = cfg.reelWidth;
    const REEL_AREA_WIDTH = cfg.reelAreaWidth;
    const REEL_AREA_HEIGHT = cfg.reelAreaHeight;

    this.factory = new SymbolFactory(cfg, renderer);
    this.container = new Container();
    this.container.x = cfg.reelOffsetX;
    this.container.y = cfg.reelOffsetY;

    const bgColor = cfg.reelStyle?.background;
    if (bgColor) {
      const bg = new Graphics();
      bg.beginFill(color(bgColor), 1);
      bg.drawRoundedRect(-8, -8, REEL_AREA_WIDTH + 16, REEL_AREA_HEIGHT + 16, 8);
      bg.endFill();
      this.container.addChild(bg);
    }

    // Masked layer for all reels
    this.reelLayer = new Container();
    const mask = new Graphics();
    mask.beginFill(0xFFFFFF);
    mask.drawRect(0, 0, REEL_AREA_WIDTH, REEL_AREA_HEIGHT);
    mask.endFill();
    this.reelLayer.addChild(mask);
    this.reelLayer.mask = mask;
    this.container.addChild(this.reelLayer);

    const basePick = createSymbolPicker(cfg);
    const pickBlur = () => (this.blurPool ? this.blurPool[Math.floor(Math.random() * this.blurPool.length)] : basePick());
    for (let i = 0; i < this.reelCount; i++) {
      const reel = new Reel(cfg, this.factory, pickBlur);
      reel.container.x = i * this.reelWidth;
      this.reelLayer.addChild(reel.container);
      this.reels.push(reel);
    }

    this.container.addChild(this.buildSeparators());

    // Feature overlay (sticky cells) above the spinning reels, below winners
    this.container.addChild(this.overlay);

    // Win layer (above mask — winning symbols render here unclipped)
    this.winLayer = new Container();
    this.container.addChild(this.winLayer);
  }

  /** Optional thin grid lines between cells (cfg.reelStyle.separators). */
  private buildSeparators(): Graphics {
    const g = new Graphics();
    const sep = this.cfg.reelStyle?.separators;
    if (!sep) return g;
    const { reelAreaWidth, reelAreaHeight, cellHeight } = this.cfg;
    g.lineStyle(sep.width, color(sep.color), sep.alpha);
    for (let i = 1; i < this.reelCount; i++) {
      g.moveTo(i * this.reelWidth, 0);
      g.lineTo(i * this.reelWidth, reelAreaHeight);
    }
    for (let r = 1; r < this.rowCount && sep.rows !== false; r++) {
      g.moveTo(0, r * cellHeight);
      g.lineTo(reelAreaWidth, r * cellHeight);
    }
    return g;
  }

  get isSpinning(): boolean {
    return this.spinning;
  }

  startSpin(result: SpinResult, onComplete: () => void): void {
    if (!this.beginSpin(onComplete)) return;
    const { reelStartInterval, scrollScreens } = this.cfg.spin;
    for (let i = 0; i < this.reelCount; i++) {
      const screens = scrollScreens[i] ?? (i + 1);
      setTimeout(() => {
        this.reels[i].startSpin(result.grid[i], screens, () => this.onReelStopped());
      }, i * reelStartInterval);
    }
  }

  startTurboSpin(result: SpinResult, onComplete: () => void): void {
    if (!this.beginSpin(onComplete)) return;
    for (let i = 0; i < this.reelCount; i++) {
      this.reels[i].startSpin(result.grid[i], 1, () => this.onReelStopped(), true);
    }
  }

  setBlurPool(symbols: string[] | null): void {
    this.blurPool = symbols?.length ? symbols : null;
  }

  /** Show a grid instantly (no spin), e.g. the base grid after a feature. */
  snapTo(grid: string[][]): void {
    this.demoteWinSymbols();
    grid.forEach((col, i) => this.reels[i].snapToTarget(col));
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
    if (this.reelsStopped === this.reelCount) {
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
    for (let r = 0; r < this.reelCount; r++) {
      const visible = this.reels[r].getVisibleSymbols();
      for (let row = 0; row < this.rowCount; row++) {
        const sym = visible[row];
        if (sym) fn(sym, r, row);
      }
    }
  }

  private promote(sym: SlotSymbol, reelIndex: number): void {
    if (sym.parent === this.winLayer) return;
    const localY = sym.y;
    sym.parent?.removeChild(sym);
    sym.x = reelIndex * this.reelWidth;
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
