import { SlotSymbol } from './SlotSymbol';
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
    return new SlotSymbol(this.renderer.createView(id), id, width, height);
  }

  release(symbol: SlotSymbol): void {
    symbol.visible = false;
    symbol.stopWinAnimation();
    this.pool.push(symbol);
  }
}
