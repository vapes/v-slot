import { Container } from 'pixi.js';
import type { SlotConfig } from '../config/SlotConfig';
import type { DROP_DEFAULTS } from '../config/defaults';
import type { SlotSymbol } from '../symbols/SlotSymbol';
import type { SymbolFactory } from '../symbols/SymbolFactory';
import type { ReelView } from './ReelView';

/** One falling cell: waits `delay` frames, then falls under gravity to `targetY` and bounces like a pebble. */
interface Faller {
  sym: SlotSymbol;
  /** Target row, or -1 = leaves the screen at the bottom. */
  row: number;
  targetY: number;
  vy: number;
  delay: number;
  /** Frames into the landing bounce; -1 while still falling. */
  bounce: number;
}

interface Pop { sym: SlotSymbol; age: number; y: number }

/**
 * Drop-mode column (config.drop): no spinning strip. On a spin the screen
 * falls out (bottom row first) and the new symbols drop in from above; in a
 * tumble the winning cells burst, the cells above fall into the gaps and new
 * ones drop in on top. Cells come from the shared SymbolFactory pool.
 */
export class DropReel implements ReelView {
  readonly container = new Container();
  readonly symbolContainer = new Container();
  private cells: SlotSymbol[] = [];
  private fallers: Faller[] = [];
  private pops: Pop[] = [];
  private landed: { sym: SlotSymbol; row: number }[] = [];
  private targets: string[] | null = null;
  private onStop: (() => void) | null = null;
  private gravity: number;
  private readonly rows: number;
  private readonly cell: number;
  private readonly d: typeof DROP_DEFAULTS;

  constructor(private cfg: SlotConfig, private factory: SymbolFactory, pick: () => string) {
    this.rows = cfg.grid.rows;
    this.cell = cfg.cellHeight;
    this.d = cfg.dropTiming!;
    this.gravity = this.d.gravity;
    this.container.addChild(this.symbolContainer);
    for (let r = 0; r < this.rows; r++) this.cells.push(this.place(pick(), r * this.cell));
  }

  getVisibleSymbols(): SlotSymbol[] {
    return this.cells;
  }

  get isSpinning(): boolean {
    return this.pops.length > 0 || this.fallers.some(f => f.bounce < 0);
  }

  /** Old screen falls out, `targets` drop in; `screens` > 1 holds the column empty longer (anticipation). */
  startSpin(targets: string[], screens: number, onStop: () => void, fast = false): void {
    this.finishAll();
    this.targets = targets;
    this.onStop = onStop;
    this.gravity = this.d.gravity * (fast ? this.d.turboGravity : 1);
    const { rowDelay, refillDelay } = this.d;
    const bottom = this.rows * this.cell;
    // leaving: bottom row first
    this.cells.forEach((sym, r) => {
      sym.stopWinAnimation();
      this.fall(sym, -1, bottom + this.cell, (this.rows - 1 - r) * rowDelay);
    });
    const hold = Math.max(0, screens - 1) * (this.cfg.reelAreaHeight / this.cfg.spin.spinSpeed);
    const base = (this.rows - 1) * rowDelay + refillDelay + hold;
    this.cells = targets.map((id, r) => {
      const sym = this.place(id, -(this.rows - r) * this.cell);
      this.fall(sym, r, r * this.cell, base + (this.rows - 1 - r) * rowDelay);
      return sym;
    });
  }

  /**
   * Tumble: cells in `removedRows` burst, the others fall into the gaps and
   * `newTop` (top → bottom, one per removed cell) drop in from above.
   */
  tumble(removedRows: number[], newTop: string[], onStop: () => void, fast = false): void {
    this.finishAll();
    this.onStop = onStop;
    this.gravity = this.d.gravity * (fast ? this.d.turboGravity : 1);
    const popFrames = (this.d.popMs * (fast ? this.d.fastFactor : 1)) / (1000 / 60);
    const gone = new Set(removedRows);
    const kept: SlotSymbol[] = [];
    this.cells.forEach((sym, r) => {
      if (gone.has(r)) this.pops.push({ sym, age: 0, y: sym.y });
      else kept.push(sym);
    });
    const fresh = newTop.map((id, i) => this.place(id, -(newTop.length - i) * this.cell));
    this.cells = [...fresh, ...kept];
    this.cells.forEach((sym, r) => {
      if (sym.y !== r * this.cell) this.fall(sym, r, r * this.cell, popFrames + (this.rows - 1 - r) * this.d.rowDelay * 0.5);
    });
    this.popFrames = popFrames;
    if (!this.fallers.length && !this.pops.length) this.done();
  }

  private popFrames = 1;

  forceStop(frames: number): void {
    if (!this.isSpinning) return;
    this.gravity = this.d.gravity * this.d.turboGravity;
    for (const f of this.fallers) {
      if (f.row < 0) {
        this.factory.release(f.sym);
        f.delay = Infinity; // removed below
      } else {
        f.delay = Math.min(f.delay, Math.max(0, frames / 2 - (this.rows - 1 - f.row)));
      }
    }
    this.fallers = this.fallers.filter(f => f.delay !== Infinity);
  }

  snapToTarget(ids?: string[]): void {
    if (ids) this.targets = ids;
    if (!this.targets) return;
    this.finishAll();
    for (const sym of this.cells) this.factory.release(sym);
    this.cells = this.targets.map((id, r) => this.place(id, r * this.cell));
    this.onStop = null;
  }

  /** Drop reels fall under gravity; anticipation only holds them longer. */
  boost(): void {}

  takeLanded(): { sym: SlotSymbol; row: number }[] {
    const out = this.landed;
    this.landed = [];
    return out;
  }

  update(dt: number): void {
    if (!this.fallers.length && !this.pops.length) return;
    this.updatePops(dt);
    const { bounce, bounceFrames } = this.d;
    for (const f of this.fallers) {
      if (f.delay > 0) {
        f.delay -= dt;
        if (f.delay > 0) continue;
      }
      if (f.bounce < 0) {
        f.vy += this.gravity * dt;
        f.sym.y += f.vy * dt;
        if (f.sym.y >= f.targetY) {
          f.sym.y = f.targetY;
          f.bounce = 0;
          if (f.row >= 0) this.landed.push({ sym: f.sym, row: f.row });
        }
      } else {
        f.bounce += dt;
        const p = Math.min(f.bounce / bounceFrames, 1);
        f.sym.y = f.targetY - Math.sin(p * Math.PI) * (1 - p) * bounce * this.cell;
        if (p >= 1) f.sym.y = f.targetY;
      }
    }
    // finished: landed + bounced, or left the screen
    this.fallers = this.fallers.filter(f => {
      const out = f.bounce >= 0 && (f.row < 0 || f.bounce >= bounceFrames);
      if (out && f.row < 0) this.factory.release(f.sym);
      return !out;
    });
    if (!this.fallers.length && !this.pops.length) this.done();
  }

  /** Bursting cells: swell, flash out, back to the pool. */
  private updatePops(dt: number): void {
    const { width: w, height: h } = this.cfg.symbol;
    for (const p of this.pops) {
      p.age += dt;
      const t = Math.min(p.age / this.popFrames, 1);
      const s = 1 + 0.4 * Math.sin(t * Math.PI * 0.5);
      p.sym.scale.set(s);
      p.sym.x = (w - w * s) / 2;
      p.sym.y = p.y + (h - h * s) / 2;
      p.sym.alpha = t < 0.4 ? 1 : 1 - (t - 0.4) / 0.6;
      if (t >= 1) this.factory.release(p.sym);
    }
    this.pops = this.pops.filter(p => p.age < this.popFrames);
  }

  private done(): void {
    const cb = this.onStop;
    this.onStop = null;
    cb?.();
  }

  private fall(sym: SlotSymbol, row: number, targetY: number, delay: number): void {
    this.fallers.push({ sym, row, targetY, vy: 0, delay, bounce: -1 });
  }

  private place(id: string, y: number): SlotSymbol {
    const sym = this.factory.acquire(id);
    sym.x = 0;
    sym.y = y;
    sym.alpha = 1;
    sym.scale.set(1);
    this.symbolContainer.addChild(sym);
    return sym;
  }

  /** Jump every running animation to its end (a new spin / tumble starts from a clean column). */
  private finishAll(): void {
    for (const p of this.pops) this.factory.release(p.sym);
    this.pops = [];
    for (const f of this.fallers) {
      if (f.row < 0) this.factory.release(f.sym);
      else f.sym.y = f.targetY;
    }
    this.fallers = [];
    this.landed = [];
  }
}
