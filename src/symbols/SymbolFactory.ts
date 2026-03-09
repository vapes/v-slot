import { SlotSymbol } from './Symbol';
import type { SymbolId } from '../core/Config';

/**
 * Object pool for SlotSymbol instances to reduce GC pressure.
 */
export class SymbolFactory {
  private pool: Map<SymbolId, SlotSymbol[]> = new Map();

  /** Get a symbol from the pool or create a new one. */
  acquire(id: SymbolId): SlotSymbol {
    const available = this.pool.get(id);
    if (available && available.length > 0) {
      const sym = available.pop()!;
      sym.setSymbol(id);
      sym.visible = true;
      return sym;
    }
    return new SlotSymbol(id);
  }

  /** Return a symbol to the pool for reuse. */
  release(symbol: SlotSymbol): void {
    symbol.visible = false;
    symbol.stopWinAnimation();
    const id = symbol.symbolId;
    if (!this.pool.has(id)) {
      this.pool.set(id, []);
    }
    this.pool.get(id)!.push(symbol);
  }
}
