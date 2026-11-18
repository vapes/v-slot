import { SlotSymbol } from './SlotSymbol';
import { cellSymbol } from '../math/cells';
import type { SymbolRenderer } from '../contracts';
import type { SlotConfig } from '../config/SlotConfig';

/** Object pool for SlotSymbol instances to avoid GC during spins. */
export class SymbolFactory {
  private pool: SlotSymbol[] = [];

  constructor(private cfg: SlotConfig, private renderer: SymbolRenderer) {}

  acquire(id: string): SlotSymbol {
    const sym = this.pool.pop();
    if (sym) {
      sym.setSymbol(id);
      sym.visible = true;
      return sym;
    }
    const { width, height } = this.cfg.symbol;
    const base = cellSymbol(id);
    const fresh = new SlotSymbol(this.renderer.createView(base), base, width, height);
    fresh.setSymbol(id); // a cell value ("mult:25") becomes the view's caption
    return fresh;
  }

  release(symbol: SlotSymbol): void {
    symbol.visible = false;
    symbol.scale.set(1);
    symbol.alpha = 1;
    symbol.x = 0;
    symbol.parent?.removeChild(symbol);
    symbol.stopWinAnimation();
    this.pool.push(symbol);
  }
}
