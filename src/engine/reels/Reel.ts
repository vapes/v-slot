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
  private maxSpeed = 0;
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

  /** Spin to `targetSymbols` (top→bottom) after `scrollScreens` screens of blur symbols. */
  startSpin(targetSymbols: SymbolId[], scrollScreens: number, onStop: () => void, skipBounceUp = false): void {
    this.targetSymbols = targetSymbols;
    this.onStopCallback = onStop;
    this.state = skipBounceUp ? ReelState.Spinning : ReelState.BounceUp;
    this.maxSpeed = this.spinConfig.spinSpeed * (skipBounceUp ? this.spinConfig.turboSpeedMultiplier : 1);
    this.speed = skipBounceUp ? this.maxSpeed : 0;
    this.totalScrolled = 0;
    this.targetPlaced = 0;
    this.phaseFrame = 0;

    this.blurDistance = scrollScreens * this.rows * this.cell;
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
        const envelope = Math.sin(progress * Math.PI);
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
        if (this.speed >= this.maxSpeed) {
          this.speed = this.maxSpeed;
          this.state = ReelState.Spinning;
        }
        this.scroll(dt);
        this.checkScrollComplete();
        break;

      case ReelState.Spinning:
        if (this.speed < this.maxSpeed) this.speed = Math.min(this.maxSpeed, this.speed + this.spinConfig.acceleration * dt);
        this.scroll(dt);
        this.checkScrollComplete();
        break;

      case ReelState.BounceDown: {
        this.phaseFrame += dt;
        const cfg = this.spinConfig.bounceDown;
        const progress = Math.min(this.phaseFrame / cfg.duration, 1);
        const bounceAmount = cfg.amount * this.cell;
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
        const ease = 1 - Math.pow(1 - progress, 3);

        if (progress >= 1) {
          this.symbolContainer.y = 0;
          this.state = ReelState.Idle;
          const cb = this.onStopCallback;
          this.onStopCallback = null;
          cb?.();
        } else {
          this.symbolContainer.y *= (1 - ease * 0.3);
        }
        break;
      }
    }
  }

  /** Anticipation: raise the top speed of a reel that is still spinning. */
  boost(multiplier: number): void {
    this.maxSpeed = this.spinConfig.spinSpeed * multiplier;
  }

  /** True until the reel has landed on its targets (bounce/settle no longer counts). */
  get isSpinning(): boolean {
    return this.state === ReelState.BounceUp || this.state === ReelState.SpinUp || this.state === ReelState.Spinning;
  }

  /**
   * Slam stop, landing in exactly `frames` frames (the controller passes the
   * same value to every reel, so all reels land together like a turbo stop):
   * the blur stretch is cut, the targets scroll in at the constant speed that
   * covers the remaining distance in time, then bounce and settle. A reel in
   * its bounce-up starts scrolling at once.
   */
  forceStop(frames: number): void {
    if (!this.isSpinning) return;
    if (this.state === ReelState.BounceUp) {
      this.symbolContainer.y = 0;
      for (const sym of this.symbols) sym.alpha = this.spinConfig.blurAlpha;
    }
    // still in the blur zone: bring the targets in now (else they are already arriving)
    if (this.totalScrolled < this.blurDistance) {
      this.blurDistance = this.totalScrolled;
      this.totalDistance = this.blurDistance + this.rows * this.cell;
    }
    this.speed = this.maxSpeed = Math.max((this.totalDistance - this.totalScrolled) / frames, 1);
    this.state = ReelState.Spinning;
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

  /** Snap instantly to the target column (or to `ids`, e.g. restoring a grid after a feature). */
  snapToTarget(ids?: SymbolId[]): void {
    if (ids) this.targetSymbols = ids;
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
