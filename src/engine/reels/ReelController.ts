import { Container, Graphics } from 'pixi.js';
import { color, type SlotConfig } from '../config/SlotConfig';
import { Reel } from './Reel';
import { AnticipationDirector } from './AnticipationDirector';
import { WinPresenter } from './WinPresenter';
import { gameEvents } from '../core/GameEvents';
import { SymbolFactory } from '../symbols/SymbolFactory';
import type { SpinResult, WinResult } from '../math/types';
import type { SymbolRenderer } from '../contracts';
import { createSymbolPicker } from '../utils/Random';
import type { SlotSymbol } from '../symbols/SlotSymbol';

export class ReelController {
  readonly container: Container;
  private reels: Reel[] = [];
  private factory: SymbolFactory;
  private spinning = false;
  private reelsStopped = 0;
  private onAllStoppedCallback: (() => void) | null = null;

  private reelLayer: Container;
  private wins: WinPresenter;
  /** Layer for feature visuals that sit on top of cells (sticky symbols). */
  readonly overlay = new Container();
  /** Reels whose start (reelStartInterval stagger) is still pending: index → start now. */
  private pendingStarts = new Map<number, { timer: ReturnType<typeof setTimeout>; start: () => void }>();
  private anticipation: AnticipationDirector;
  /** While set (e.g. during a feature) spinning blur symbols come only from this pool. */
  private blurPool: string[] | null = null;
  private readonly reelCount: number;
  private readonly rowCount: number;
  private readonly reelWidth: number;
  /** Current spin uses the turbo landing animations (turbo / quick spins). */
  private turbo = false;
  /** Cells playing a landing animation. */
  private landing = new Set<SlotSymbol>();

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
      bg.roundRect(-8, -8, REEL_AREA_WIDTH + 16, REEL_AREA_HEIGHT + 16, 8).fill(color(bgColor));
      this.container.addChild(bg);
    }

    // grid lines sit UNDER the symbols (visible in the symbol.gap between tiles)
    this.container.addChild(this.buildSeparators());

    this.reelLayer = new Container();
    const mask = new Graphics();
    mask.rect(0, 0, REEL_AREA_WIDTH, REEL_AREA_HEIGHT).fill(0xFFFFFF);
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

    // Above the reels, below winners: feature sticky cells, then anticipation FX
    this.container.addChild(this.overlay);
    this.anticipation = new AnticipationDirector(cfg, this.reels);
    this.container.addChild(this.anticipation.fx.container);

    // Win layer (above mask — winning symbols render here unclipped)
    this.wins = new WinPresenter(cfg, this.reels);
    this.container.addChild(this.wins.layer);
  }

  /** Optional thin grid lines between cells (cfg.reelStyle.separators), centred in the symbol gap; drawn under the symbols. */
  private buildSeparators(): Graphics {
    const g = new Graphics();
    const sep = this.cfg.reelStyle?.separators;
    if (!sep) return g;
    const { reelAreaWidth, reelAreaHeight, cellHeight } = this.cfg;
    const half = this.cfg.symbol.gap / 2;
    for (let i = 1; i < this.reelCount; i++) {
      g.moveTo(i * this.reelWidth - half, 0);
      g.lineTo(i * this.reelWidth - half, reelAreaHeight);
    }
    for (let r = 1; r < this.rowCount && sep.rows !== false; r++) {
      g.moveTo(0, r * cellHeight - half);
      g.lineTo(reelAreaWidth, r * cellHeight - half);
    }
    g.stroke({ width: sep.width, color: color(sep.color), alpha: sep.alpha });
    return g;
  }

  get isSpinning(): boolean {
    return this.spinning;
  }

  /** Normal spin; `anticipate[i]` makes reel i tease (see AnticipationDirector). */
  startSpin(result: SpinResult, onComplete: () => void, anticipate: boolean[] | null = null, suppressed?: () => boolean): void {
    if (!this.beginSpin(onComplete)) return;
    this.turbo = false;
    const { reelStartInterval, scrollScreens } = this.cfg.spin;
    const extra = this.anticipation.plan(anticipate, suppressed);
    for (let i = 0; i < this.reelCount; i++) {
      const screens = (scrollScreens[i] ?? (i + 1)) + extra[i];
      const start = (skipBounceUp = false) => {
        this.pendingStarts.delete(i);
        this.anticipation.markStarted(i);
        this.reels[i].startSpin(result.grid[i], screens, () => this.onReelStopped(), skipBounceUp);
      };
      if (i === 0 || reelStartInterval <= 0) start();
      else this.pendingStarts.set(i, { timer: setTimeout(() => start(), i * reelStartInterval), start: () => start(true) });
    }
  }

  startTurboSpin(result: SpinResult, onComplete: () => void): void {
    if (!this.beginSpin(onComplete)) return;
    this.turbo = true;
    this.anticipation.plan(null);
    for (let i = 0; i < this.reelCount; i++) {
      this.reels[i].startSpin(result.grid[i], 1, () => this.onReelStopped(), true);
    }
  }

  setBlurPool(symbols: string[] | null): void {
    this.blurPool = symbols?.length ? symbols : null;
  }

  /** Show a grid instantly (no spin), e.g. the base grid after a feature. */
  snapTo(grid: string[][]): void {
    this.wins.demote();
    grid.forEach((col, i) => this.reels[i].snapToTarget(col));
  }

  /**
   * STOP: all reels land together, like a turbo stop. Reels still waiting for
   * their staggered start start now; every spinning reel scrolls its targets
   * in over the same number of frames (one screen at turbo speed).
   */
  forceStop(): void {
    if (!this.spinning) return;
    this.anticipation.cancel();
    for (const { timer, start } of this.pendingStarts.values()) {
      clearTimeout(timer);
      start();
    }
    const { spinSpeed, turboSpeedMultiplier } = this.cfg.spin;
    const frames = (this.rowCount * this.cfg.cellHeight) / (spinSpeed * turboSpeedMultiplier);
    for (const reel of this.reels) reel.forceStop(frames);
  }

  private beginSpin(onComplete: () => void): boolean {
    if (this.spinning) return false;
    this.spinning = true;
    this.pendingStarts.clear();
    this.reelsStopped = 0;
    this.onAllStoppedCallback = onComplete;
    this.wins.demote();
    this.landing.clear();
    this.wins.forEachVisible((sym) => {
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
    this.reels.forEach((reel, i) => {
      // compare before / after this update: a long frame can start and land a reel in one step
      const before = reel.isSpinning;
      reel.update(dt);
      if (before && !reel.isSpinning) {
        gameEvents.emit('reelLand', { reel: i });
        this.playLandings(i, reel.getVisibleSymbols());
      }
    });
    for (const sym of this.landing) {
      sym.updateLanding(dt);
      if (!sym.landing) this.landing.delete(sym);
    }
    this.anticipation.update(dt);
    this.wins.update(dt);
  }

  /** Symbols with a landing animation (config.symbols[].landing / turboLanding) play it as their reel stops. */
  private playLandings(reel: number, cells: SlotSymbol[]): void {
    cells.forEach((sym, row) => {
      const spec = this.cfg.landing(sym.symbolId, this.turbo);
      if (!spec) return;
      sym.playLanding(spec);
      this.landing.add(sym);
      gameEvents.emit('symbolLanding', { reel, row, symbol: sym.symbolId, turbo: this.turbo });
    });
  }

  /** Highlight every winning position with a pulse; dim the rest. */
  showWins(result: SpinResult, cycleMs = 1500): void {
    this.wins.highlight(result.wins, (sym) => sym.startWinAnimation(cycleMs));
  }

  /** Turbo win display: static gold frame on winners, dim losers. */
  showWinsTurbo(result: SpinResult): void {
    this.wins.highlight(result.wins, (sym) => sym.showTurboHighlight());
  }

  /** Show only the symbols belonging to a single winning line. */
  showWinLine(win: WinResult, cycleMs = 1500): void {
    this.wins.demote();
    this.wins.resetAll();
    this.wins.highlight([win], (sym) => sym.startWinAnimation(cycleMs));
  }

  /** Clear win highlights and restore all symbols. */
  clearWins(): void {
    this.wins.demote();
    this.wins.undim();
  }
}
