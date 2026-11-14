import { Container, Graphics } from 'pixi.js';
import type { SlotConfig } from '../config/SlotConfig';
import type { StickyCell } from '../math/types';
import type { SymbolRenderer, SymbolView } from '../contracts';

interface StickyItem {
  cell: StickyCell;
  root: Container;
  view: SymbolView;
  glow: Graphics;
  age: number;
}

const POP_FRAMES = 18;

/**
 * Sticky symbols drawn above the spinning reels (ReelController.overlay):
 * the reel underneath keeps spinning, the sticky cell stays put.
 */
export class StickyLayer {
  private items: StickyItem[] = [];
  private pulse = 0;

  constructor(private cfg: SlotConfig, private renderer: SymbolRenderer, private parent: Container) {}

  add(cell: StickyCell, label: string | null): void {
    const { width: w, height: h } = this.cfg.symbol;
    const root = new Container();
    root.position.set(cell.reel * this.cfg.reelWidth + w / 2, cell.row * this.cfg.cellHeight + h / 2);
    const view = this.renderer.createView(cell.symbol);
    view.setValue?.(label);
    view.display.position.set(-w / 2, -h / 2);
    const glow = new Graphics();
    root.addChild(view.display, glow);
    root.scale.set(0.2);
    this.parent.addChild(root);
    this.items.push({ cell, root, view, glow, age: 0 });
  }

  get cells(): StickyCell[] {
    return this.items.map(i => i.cell);
  }

  /** Short bounce on one sticky cell (used while collecting). */
  bump(cell: StickyCell): void {
    const item = this.items.find(i => i.cell === cell);
    if (item) item.age = POP_FRAMES / 2;
  }

  clear(): void {
    this.items.forEach(i => i.root.destroy({ children: true }));
    this.items = [];
  }

  update(dt: number): void {
    this.pulse += dt * 0.08;
    const { width: w, height: h } = this.cfg.symbol;
    for (const it of this.items) {
      it.age += dt;
      // pop-in with a little overshoot
      const t = Math.min(it.age / POP_FRAMES, 1);
      const s = t < 1 ? 0.2 + 0.8 * t + Math.sin(t * Math.PI) * 0.25 : 1;
      it.root.scale.set(s);
      const a = 0.65 + Math.sin(this.pulse) * 0.3;
      it.glow.clear();
      it.glow.lineStyle(6, 0xFF8A00, a * 0.45);
      it.glow.drawRoundedRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 8);
      it.glow.lineStyle(2.5, 0xFFE082, a);
      it.glow.drawRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 8);
    }
  }
}
