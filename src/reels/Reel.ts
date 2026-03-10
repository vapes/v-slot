import { Container } from 'pixi.js';
import {
  ROW_COUNT,
  CELL_HEIGHT,
  REEL_AREA_HEIGHT,
  type SymbolId,
} from '../core/Config';
import { SlotSymbol } from '../symbols/Symbol';
import { SymbolFactory } from '../symbols/SymbolFactory';
import { Random } from '../utils/Random';
import { spin as spinConfig } from '../gameConfig.json';

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
  private factory: SymbolFactory;

  private state: ReelState = ReelState.Idle;
  private speed = 0;
  private targetSymbols: SymbolId[] | null = null;

  private readonly bufferCount = ROW_COUNT + 2;
  private phaseFrame = 0;
  private onStopCallback: (() => void) | null = null;

  // Distance-based spin tracking
  private totalScrolled = 0;
  private blurDistance = 0;   // pixels of blur symbols before targets
  private totalDistance = 0;  // total pixels to scroll (blur + target entry)
  private targetPlaced = 0;  // how many target symbols have been recycled in

  constructor(factory: SymbolFactory) {
    this.factory = factory;
    this.container = new Container();

    this.symbolContainer = new Container();
    this.container.addChild(this.symbolContainer);

    for (let i = 0; i < this.bufferCount; i++) {
      const sym = factory.acquire(Random.weightedPick());
      sym.x = 0;
      sym.y = (i - 1) * CELL_HEIGHT;
      this.symbolContainer.addChild(sym);
      this.symbols.push(sym);
    }
  }

  getVisibleSymbols(): SlotSymbol[] {
    return this.symbols.slice(1, 1 + ROW_COUNT);
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
    this.speed = skipBounceUp ? spinConfig.spinSpeed * spinConfig.turboSpeedMultiplier : 0;
    this.totalScrolled = 0;
    this.targetPlaced = 0;
    this.phaseFrame = 0;

    // Blur zone: scrollScreens worth of random alpha symbols
    this.blurDistance = scrollScreens * ROW_COUNT * CELL_HEIGHT;
    // Total: blur + one more screen for target symbols to scroll into view
    this.totalDistance = this.blurDistance + ROW_COUNT * CELL_HEIGHT;

    for (const sym of this.symbols) {
      sym.stopWinAnimation();
    }
  }

  /** Turbo: instantly snap to target symbols, skip all animation. */
  startTurboSpin(targetSymbols: SymbolId[], onStop: () => void): void {
    this.targetSymbols = targetSymbols;
    for (const sym of this.symbols) {
      sym.stopWinAnimation();
    }
    this.snapToTarget();
    this.state = ReelState.Idle;
    setTimeout(onStop, 0);
  }

  update(dt: number): void {
    switch (this.state) {
      case ReelState.Idle:
        return;

      case ReelState.BounceUp: {
        this.phaseFrame += dt;
        const cfg = spinConfig.bounceUp;
        const progress = Math.min(this.phaseFrame / cfg.duration, 1);
        // Smooth bell curve: rise then return to 0
        const envelope = Math.sin(progress * Math.PI);
        // Ease-out for smooth deceleration at peak
        const ease = 1 - Math.pow(1 - Math.min(progress * 2, 1), 3);
        this.symbolContainer.y = -ease * envelope * (cfg.amount * CELL_HEIGHT);

        if (progress >= 1) {
          this.symbolContainer.y = 0;
          for (const sym of this.symbols) {
            sym.alpha = spinConfig.blurAlpha;
          }
          this.state = ReelState.SpinUp;
          this.phaseFrame = 0;
        }
        break;
      }

      case ReelState.SpinUp:
        this.speed += spinConfig.acceleration * dt;
        if (this.speed >= spinConfig.spinSpeed) {
          this.speed = spinConfig.spinSpeed;
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
        const cfg = spinConfig.bounceDown;
        const progress = Math.min(this.phaseFrame / cfg.duration, 1);
        const bounceAmount = cfg.amount * CELL_HEIGHT;
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
        const progress = Math.min(this.phaseFrame / spinConfig.settle.duration, 1);
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
    const bottomEdge = REEL_AREA_HEIGHT + CELL_HEIGHT;

    for (let i = 0; i < this.symbols.length; i++) {
      const sym = this.symbols[i];
      if (sym.y > bottomEdge) {
        let topY = Infinity;
        for (const s of this.symbols) {
          if (s.y < topY) topY = s.y;
        }
        sym.y = topY - CELL_HEIGHT;

        // In target zone: place target symbols with full alpha
        if (this.totalScrolled >= this.blurDistance && this.targetPlaced < ROW_COUNT && this.targetSymbols) {
          // First recycled target → scrolls most → bottom row
          const idx = ROW_COUNT - 1 - this.targetPlaced;
          sym.setSymbol(this.targetSymbols[idx]);
          sym.alpha = 1;
          this.targetPlaced++;
        } else {
          sym.setSymbol(Random.weightedPick());
          sym.alpha = spinConfig.blurAlpha;
        }
      }
    }
  }

  private snapToTarget(): void {
    if (!this.targetSymbols) return;

    this.symbols.sort((a, b) => a.y - b.y);

    for (let i = 0; i < this.bufferCount; i++) {
      const sym = this.symbols[i];
      sym.y = (i - 1) * CELL_HEIGHT;
      sym.alpha = 1;

      if (i === 0) {
        sym.setSymbol(Random.weightedPick());
      } else if (i <= ROW_COUNT) {
        sym.setSymbol(this.targetSymbols[i - 1]);
      } else {
        sym.setSymbol(Random.weightedPick());
      }
    }

    this.symbolContainer.y = 0;
  }
}
