import { Container } from 'pixi.js';
import type { SlotConfig } from '../config/SlotConfig';
import type { SlotSymbol } from '../symbols/SlotSymbol';
import type { SymbolFactory } from '../symbols/SymbolFactory';

type SymbolId = string;

export enum ReelState {
  Idle,
  BounceUp,      // elastic jump upward before spin
  SpinUp,        // acceleration phase
  Spinning,      // constant speed, distance-based
  BounceDown,    // overshoot bounce down after stop
  Settling,      // final settle animation
}

/**
 * Single reel column.
 * Uses symbol recycling: symbols that scroll off the top are repositioned at the bottom.
 */
export class Reel {
  readonly container: Container;
  readonly symbolContainer: Container;
  private symbols: SlotSymbol[] = [];
  private readonly spinConfig: SlotConfig['spin'];
  private readonly rows: number;
  private readonly cell: number;

  private state: ReelState = ReelState.Idle;
  private speed = 0;
  private targetSymbols: SymbolId[] | null = null;

  private readonly bufferCount: number;
  private phaseFrame = 0;
  private onStopCallback: (() => void) | null = null;

  private totalScrolled = 0;
  private blurDistance = 0;   // pixels of blur symbols before targets
  private totalDistance = 0;  // total pixels to scroll (blur + target entry)
  private targetPlaced = 0;  // how many target symbols have been recycled in

  constructor(cfg: SlotConfig, factory: SymbolFactory, private pickBlur: () => SymbolId) {
    this.spinConfig = cfg.spin;
    this.rows = cfg.grid.rows;
    this.cell = cfg.cellHeight;
    this.bufferCount = this.rows + 2;
    this.container = new Container();

    this.symbolContainer = new Container();
    this.container.addChild(this.symbolContainer);

    for (let i = 0; i < this.bufferCount; i++) {
      const sym = factory.acquire(this.pickBlur());
      sym.x = 0;
      sym.y = (i - 1) * this.cell;
      this.symbolContainer.addChild(sym);
      this.symbols.push(sym);
    }
  }

  getVisibleSymbols(): SlotSymbol[] {
    return this.symbols.slice(1, 1 + this.rows);
  }

  /**
   * Start spinning.
   * @param targetSymbols final visible symbols (top to bottom)
   * @param scrollScreens how many screens of blur symbols to scroll before targets appear
   */
  startSpin(targetSymbols: SymbolId[], scrollScreens: number, onStop: () => void, skipBounceUp = false): void {
    this.targetSymbols = targetSymbols;
    this.onStopCallback = onStop;
    this.state = skipBounceUp ? ReelState.Spinning : ReelState.BounceUp;
    this.speed = skipBounceUp ? this.spinConfig.spinSpeed * this.spinConfig.turboSpeedMultiplier : 0;
    this.totalScrolled = 0;
    this.targetPlaced = 0;
    this.phaseFrame = 0;

    // Blur zone: scrollScreens worth of random alpha symbols
    this.blurDistance = scrollScreens * this.rows * this.cell;
    // Total: blur + one more screen for target symbols to scroll into view
    this.totalDistance = this.blurDistance + this.rows * this.cell;

    for (const sym of this.symbols) {
      sym.stopWinAnimation();
    }
  }

  update(dt: number): void {
    switch (this.state) {
      case ReelState.Idle:
        return;

      case ReelState.BounceUp: {
        this.phaseFrame += dt;
        const cfg = this.spinConfig.bounceUp;
        const progress = Math.min(this.phaseFrame / cfg.duration, 1);
        // Smooth bell curve: rise then return to 0
        const envelope = Math.sin(progress * Math.PI);
        // Ease-out for smooth deceleration at peak
        const ease = 1 - Math.pow(1 - Math.min(progress * 2, 1), 3);
        this.symbolContainer.y = -ease * envelope * (cfg.amount * this.cell);

        if (progress >= 1) {
          this.symbolContainer.y = 0;
          for (const sym of this.symbols) {
            sym.alpha = this.spinConfig.blurAlpha;
          }
          this.state = ReelState.SpinUp;
          this.phaseFrame = 0;
        }
        break;
      }

      case ReelState.SpinUp:
        this.speed += this.spinConfig.acceleration * dt;
        if (this.speed >= this.spinConfig.spinSpeed) {
          this.speed = this.spinConfig.spinSpeed;
          this.state = ReelState.Spinning;
        }
        this.scroll(dt);
        this.checkScrollComplete();
        break;

      case ReelState.Spinning:
        this.scroll(dt);
        this.checkScrollComplete();
        break;

      case ReelState.BounceDown: {
        this.phaseFrame += dt;
        const cfg = this.spinConfig.bounceDown;
        const progress = Math.min(this.phaseFrame / cfg.duration, 1);
        const bounceAmount = cfg.amount * this.cell;
        // Single smooth overshoot: goes down then back with exponential decay
        const decay = Math.pow(1 - progress, 2);
        const wave = Math.sin(progress * Math.PI);
        this.symbolContainer.y = wave * decay * bounceAmount;

        if (progress >= 1) {
          this.symbolContainer.y = 0;
          this.state = ReelState.Settling;
          this.phaseFrame = 0;
        }
        break;
      }

      case ReelState.Settling: {
        this.phaseFrame += dt;
        const progress = Math.min(this.phaseFrame / this.spinConfig.settle.duration, 1);
        // Smooth ease-out cubic
        const ease = 1 - Math.pow(1 - progress, 3);

        if (progress >= 1) {
          this.symbolContainer.y = 0;
          this.state = ReelState.Idle;
          const cb = this.onStopCallback;
          this.onStopCallback = null;
          cb?.();
        } else {
          // Gentle settle from any residual offset
          this.symbolContainer.y *= (1 - ease * 0.3);
        }
        break;
      }
    }
  }

  get isIdle(): boolean {
    return this.state === ReelState.Idle;
  }

  /** Snap to target symbols and play the BounceDown→Settling easing (same as turbo stop). */
  forceStop(): void {
    if (this.state === ReelState.Idle) return;
    this.speed = 0;
    this.snapToTarget();
    this.state = ReelState.BounceDown;
    this.phaseFrame = 0;
  }

  private checkScrollComplete(): void {
    if (this.totalScrolled >= this.totalDistance) {
      this.speed = 0;
      this.snapToTarget();
      this.state = ReelState.BounceDown;
      this.phaseFrame = 0;
    }
  }

  private scroll(dt: number): void {
    const delta = this.speed * dt;
    this.totalScrolled += delta;

    for (const sym of this.symbols) {
      sym.y += delta;
    }

    this.recycleSymbols();
  }

  private recycleSymbols(): void {
    const bottomEdge = this.rows * this.cell + this.cell;

    for (let i = 0; i < this.symbols.length; i++) {
      const sym = this.symbols[i];
      if (sym.y > bottomEdge) {
        let topY = Infinity;
        for (const s of this.symbols) {
          if (s.y < topY) topY = s.y;
        }
        sym.y = topY - this.cell;

        // In target zone: place target symbols with full alpha
        if (this.totalScrolled >= this.blurDistance && this.targetPlaced < this.rows && this.targetSymbols) {
          // First recycled target → scrolls most → bottom row
          const idx = this.rows - 1 - this.targetPlaced;
          sym.setSymbol(this.targetSymbols[idx]);
          sym.alpha = 1;
          this.targetPlaced++;
        } else {
          sym.setSymbol(this.pickBlur());
          sym.alpha = this.spinConfig.blurAlpha;
        }
      }
    }
  }

  private snapToTarget(): void {
    if (!this.targetSymbols) return;

    this.symbols.sort((a, b) => a.y - b.y);

    for (let i = 0; i < this.bufferCount; i++) {
      const sym = this.symbols[i];
      sym.y = (i - 1) * this.cell;
      sym.alpha = 1;

      if (i === 0) {
        sym.setSymbol(this.pickBlur());
      } else if (i <= this.rows) {
        sym.setSymbol(this.targetSymbols[i - 1]);
      } else {
        sym.setSymbol(this.pickBlur());
      }
    }

    this.symbolContainer.y = 0;
  }
}
