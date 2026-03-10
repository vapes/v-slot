import { Container, Graphics } from 'pixi.js';
import {
  REEL_COUNT,
  ROW_COUNT,
  REEL_WIDTH,
  REEL_AREA_WIDTH,
  REEL_AREA_HEIGHT,
  REEL_OFFSET_X,
  REEL_OFFSET_Y,
} from '../core/Config';
import { Reel } from './Reel';
import { SymbolFactory } from '../symbols/SymbolFactory';
import type { SpinResult, WinResult } from '../math/SlotMath';
import type { SlotSymbol } from '../symbols/Symbol';
import spinConfig from '../core/spinConfig.json';

interface PromotedSymbol {
  symbol: SlotSymbol;
  reelIndex: number;
  localY: number;
}

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

    // Dark background for reel area
    const bg = new Graphics();
    bg.beginFill(0x1A1A2E, 1);
    bg.drawRoundedRect(-8, -8, REEL_AREA_WIDTH + 16, REEL_AREA_HEIGHT + 16, 8);
    bg.endFill();
    this.container.addChild(bg);

    // Masked layer for all reels
    this.reelLayer = new Container();
    const mask = new Graphics();
    mask.beginFill(0xFFFFFF);
    mask.drawRect(0, 0, REEL_AREA_WIDTH, REEL_AREA_HEIGHT);
    mask.endFill();
    this.reelLayer.addChild(mask);
    this.reelLayer.mask = mask;
    this.container.addChild(this.reelLayer);

    // Reel separators (above mask layer)
    for (let i = 1; i < REEL_COUNT; i++) {
      const sep = new Graphics();
      sep.beginFill(0x333355, 0.5);
      sep.drawRect(i * REEL_WIDTH - 2, 0, 4, REEL_AREA_HEIGHT);
      sep.endFill();
      this.container.addChild(sep);
    }

    // Create reels inside masked layer
    for (let i = 0; i < REEL_COUNT; i++) {
      const reel = new Reel(this.factory);
      reel.container.x = i * REEL_WIDTH;
      this.reelLayer.addChild(reel.container);
      this.reels.push(reel);
    }

    // Win layer (above mask — winning symbols render here unclipped)
    this.winLayer = new Container();
    this.container.addChild(this.winLayer);
  }

  get isSpinning(): boolean {
    return this.spinning;
  }

  startSpin(result: SpinResult, onComplete: () => void): void {
    if (this.spinning) return;
    this.spinning = true;
    this.reelsStopped = 0;
    this.onAllStoppedCallback = onComplete;

    this.demoteWinSymbols();

    for (const reel of this.reels) {
      for (const sym of reel.getVisibleSymbols()) {
        sym.stopWinAnimation();
        sym.alpha = 1;
      }
    }

    const startInterval = spinConfig.reelStartInterval;
    const scrollScreens = spinConfig.scrollScreens;

    for (let i = 0; i < REEL_COUNT; i++) {
      const targetColumn = result.grid[i];
      const screens = scrollScreens[i] ?? (i + 1);

      setTimeout(() => {
        this.reels[i].startSpin(targetColumn, screens, () => {
          this.reelsStopped++;
          if (this.reelsStopped === REEL_COUNT) {
            this.spinning = false;
            this.onAllStoppedCallback?.();
          }
        });
      }, i * startInterval);
    }
  }

  startTurboSpin(result: SpinResult, onComplete: () => void): void {
    if (this.spinning) return;
    this.spinning = true;
    this.reelsStopped = 0;
    this.onAllStoppedCallback = onComplete;

    this.demoteWinSymbols();

    for (const reel of this.reels) {
      for (const sym of reel.getVisibleSymbols()) {
        sym.stopWinAnimation();
        sym.alpha = 1;
      }
    }

    for (let i = 0; i < REEL_COUNT; i++) {
      const targetColumn = result.grid[i];
      this.reels[i].startSpin(targetColumn, 1, () => {
        this.reelsStopped++;
        if (this.reelsStopped === REEL_COUNT) {
          this.spinning = false;
          this.onAllStoppedCallback?.();
        }
      }, true);
    }
  }

  update(dt: number): void {
    for (const reel of this.reels) {
      reel.update(dt);
    }

    for (const { symbol } of this.promotedSymbols) {
      symbol.updateWinAnimation(dt);
    }
  }

  showWins(result: SpinResult, cycleMs = 1500): void {
    const winPositions = new Set<string>();
    for (const win of result.wins) {
      for (const [reel, row] of win.positions) {
        winPositions.add(`${reel},${row}`);
      }
    }

    for (let r = 0; r < REEL_COUNT; r++) {
      const visible = this.reels[r].getVisibleSymbols();
      for (let row = 0; row < ROW_COUNT; row++) {
        const sym = visible[row];
        if (!sym) continue;
        const key = `${r},${row}`;
        if (winPositions.has(key)) {
          const localY = sym.y;
          sym.parent?.removeChild(sym);
          sym.x = r * REEL_WIDTH;
          sym.y = localY;
          this.winLayer.addChild(sym);
          this.promotedSymbols.push({ symbol: sym, reelIndex: r, localY });
          sym.startWinAnimation(cycleMs);
        } else if (result.wins.length > 0) {
          sym.alpha = 0.4;
        }
      }
    }
  }

  /** Turbo win display: promote winning symbols with yellow border, dim losers. */
  showWinsTurbo(result: SpinResult): void {
    const winPositions = new Set<string>();
    for (const win of result.wins) {
      for (const [reel, row] of win.positions) {
        winPositions.add(`${reel},${row}`);
      }
    }

    for (let r = 0; r < REEL_COUNT; r++) {
      const visible = this.reels[r].getVisibleSymbols();
      for (let row = 0; row < ROW_COUNT; row++) {
        const sym = visible[row];
        if (!sym) continue;
        const key = `${r},${row}`;
        if (winPositions.has(key)) {
          const localY = sym.y;
          sym.parent?.removeChild(sym);
          sym.x = r * REEL_WIDTH;
          sym.y = localY;
          this.winLayer.addChild(sym);
          this.promotedSymbols.push({ symbol: sym, reelIndex: r, localY });
          sym.showTurboHighlight();
        } else if (result.wins.length > 0) {
          sym.alpha = 0.4;
        }
      }
    }
  }

  /** Clear turbo win highlights and restore all symbols. */
  clearWins(): void {
    this.demoteWinSymbols();
    for (const reel of this.reels) {
      for (const sym of reel.getVisibleSymbols()) {
        sym.alpha = 1;
      }
    }
  }

  /** Show only the symbols belonging to a single winning line. */
  showWinLine(win: WinResult, cycleMs = 1500): void {
    this.demoteWinSymbols();

    for (let r = 0; r < REEL_COUNT; r++) {
      for (const sym of this.reels[r].getVisibleSymbols()) {
        sym.stopWinAnimation();
        sym.alpha = 0.4;
      }
    }

    const posSet = new Set(win.positions.map(([r, row]) => `${r},${row}`));
    for (let r = 0; r < REEL_COUNT; r++) {
      const visible = this.reels[r].getVisibleSymbols();
      for (let row = 0; row < ROW_COUNT; row++) {
        const sym = visible[row];
        if (!sym) continue;
        if (posSet.has(`${r},${row}`)) {
          const localY = sym.y;
          sym.parent?.removeChild(sym);
          sym.x = r * REEL_WIDTH;
          sym.y = localY;
          this.winLayer.addChild(sym);
          this.promotedSymbols.push({ symbol: sym, reelIndex: r, localY });
          sym.alpha = 1;
          sym.startWinAnimation(cycleMs);
        }
      }
    }
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
