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
  /** Frames to rest after landing before the bounce (bounces ripple up the column). */
  wait: number;
}

interface Pop { sym: SlotSymbol; age: number; y: number }

/**
 * Drop-mode column (config.drop): no spinning strip. On a spin the whole
 * column falls as one stack — the old cells drop out at the bottom while the
 * new ones, stacked right on top of them, fall into place (the screen is
 * never empty). In a tumble the winning cells burst, everything above a gap
 * falls as one block and the new cells come stacked right on top.
 * Cells come from the shared SymbolFactory pool.
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

  /** `col` = column index (the clearing wave starts at the bottom-left cell). */
  constructor(private cfg: SlotConfig, private factory: SymbolFactory, pick: () => string, private col = 0) {
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

  /**
   * Clear, then fill: the old cells fall out in a wave that starts at the
   * bottom-left cell (column → right, row → up), the empty screen waits
   * `clearMs` (+ `lag` frames: reel order, + extra `screens`: anticipation),
   * then `targets` drop in as one stack.
   */
  startSpin(targets: string[], screens: number, onStop: () => void, fast = false, lag = 0): void {
    this.finishAll();
    this.targets = targets;
    this.onStop = onStop;
    this.gravity = this.d.gravity * (fast ? this.d.turboGravity : 1);
    const drop = this.rows * this.cell;
    const { clearColDelay, clearRowDelay } = this.d;
    const wave = (r: number) => this.col * clearColDelay + (this.rows - 1 - r) * clearRowDelay;
    this.cells.forEach((sym, r) => {
      sym.stopWinAnimation();
      this.fall(sym, -1, r * this.cell + drop, wave(r));
    });
    // frames until the last (top-right) cell of the screen is gone
    const cols = this.cfg.grid.cols;
    const out = (cols - 1) * clearColDelay + (this.rows - 1) * clearRowDelay + Math.sqrt((2 * drop) / this.gravity);
    const pause = (this.d.clearMs * (fast ? this.d.fastFactor : 1)) / (1000 / 60);
    const hold = Math.max(0, screens - 1) * (this.cfg.reelAreaHeight / this.cfg.spin.spinSpeed);
    const delay = out + pause + hold + lag;
    this.cells = targets.map((id, r) => {
      const sym = this.place(id, r * this.cell - drop);
      this.fall(sym, r, r * this.cell, delay, this.stagger(r));
      return sym;
    });
  }

  /** The stack lands at once; the bounce ripples up from the bottom row (pebble feel, no gaps). */
  private stagger(row: number): number {
    return (this.rows - 1 - row) * this.d.landStagger;
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
    // everything above a gap starts together, so a block stays a block
    this.cells.forEach((sym, r) => {
      if (sym.y !== r * this.cell) this.fall(sym, r, r * this.cell, popFrames, this.stagger(r));
    });
    this.popFrames = popFrames;
    if (!this.fallers.length && !this.pops.length) this.done();
  }

  private popFrames = 1;

  forceStop(): void {
    if (!this.isSpinning) return;
    // old cells vanish, every new stack drops now and faster (all reels land together)
    this.gravity = this.d.gravity * this.d.turboGravity;
    for (const f of this.fallers) if (f.row < 0) this.factory.release(f.sym);
    this.fallers = this.fallers.filter(f => f.row >= 0);
    for (const f of this.fallers) f.delay = 0;
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
      } else if (f.wait > 0) {
        f.wait -= dt;
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

  private fall(sym: SlotSymbol, row: number, targetY: number, delay: number, wait = 0): void {
    this.fallers.push({ sym, row, targetY, vy: 0, delay, bounce: -1, wait });
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
