import gameConfig from '../gameConfig.json';
import type { SymbolId } from '../core/Config';

/** Symbol name by nibble index (must match generator encoding). */
const SYMBOLS: SymbolId[] = ['V', 'A', 'P', 'E', 'S'];

const SCREEN_BYTES   = 8;  // 15 nibbles + 1 padding, packed into 8 bytes
const NUM_CATEGORIES = 7;  // lose, small, medium, big, huge, epic, max

interface CategorySlice {
  /** First screen index (not byte offset) in the flat buffer. */
  start: number;
  count: number;
}

/**
 * Loads the precomputed screens.bin file and provides O(1) random-access
 * to categorised spin grids.
 *
 * Binary layout (see generate-screens.mjs for the authoritative spec):
 *   Header  : "SLOT"(4) + version(1) + numCats(1) + counts[7](7×4) = 34 bytes
 *   Screens : N × 8 bytes, nibble-packed, grouped by category
 */
export class PrecomputedTable {
  private screens: Uint8Array | null = null;
  private slices: CategorySlice[]    = [];
  private cumProbs: number[]          = [];
  private _ready = false;

  get isReady(): boolean { return this._ready; }

  async load(url: string): Promise<void> {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`PrecomputedTable: HTTP ${resp.status} for ${url}`);
    const buf = await resp.arrayBuffer();
    this._parse(new Uint8Array(buf));
    this._ready = true;

    const total = this.slices.reduce((s, c) => s + c.count, 0);
    console.log(`[PrecomputedTable] Loaded ${total.toLocaleString()} precomputed screens`);
  }

  /**
   * Pick a random grid according to the payoutDistribution probabilities.
   * Returns null if the table is not yet loaded (caller should fall back to live math).
   */
  pickGrid(): SymbolId[][] | null {
    if (!this._ready || !this.screens) return null;

    const ci    = this._pickCategory();
    const slice = this.slices[ci];
    if (slice.count === 0) return null;

    const idx = slice.start + ((Math.random() * slice.count) | 0);
    return this._decodeGrid(idx);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _parse(data: Uint8Array): void {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    const magic = String.fromCharCode(data[0], data[1], data[2], data[3]);
    if (magic !== 'SLOT') throw new Error('PrecomputedTable: invalid magic bytes');

    const numCats = data[5]; // byte [5]

    // Read per-category counts and build slice map
    let screenCursor = 0;
    for (let i = 0; i < numCats; i++) {
      const count = view.getUint32(6 + i * 4, /* littleEndian */ true);
      this.slices.push({ start: screenCursor, count });
      screenCursor += count;
    }

    // Screen data starts after header (4+1+1+numCats×4 bytes)
    const headerSize = 6 + numCats * 4;
    this.screens = new Uint8Array(data.buffer, data.byteOffset + headerSize);

    // Build cumulative probability thresholds from gameConfig (same category order)
    let cumProb = 0;
    for (const entry of gameConfig.payoutDistribution) {
      cumProb += entry.probability;
      this.cumProbs.push(cumProb);
    }
  }

  /** Sample a category index using the payoutDistribution CDF. */
  private _pickCategory(): number {
    const r = Math.random();
    for (let i = 0; i < this.cumProbs.length - 1; i++) {
      if (r < this.cumProbs[i]) return i;
    }
    return this.cumProbs.length - 1;
  }

  /** Decode screen at `screenIndex` into a 5×3 SymbolId grid. */
  private _decodeGrid(screenIndex: number): SymbolId[][] {
    const buf  = this.screens!;
    const base = screenIndex * SCREEN_BYTES;
    const grid: SymbolId[][] = Array.from({ length: 5 }, () => new Array<SymbolId>(3));
    let n = 0;
    for (let r = 0; r < 5; r++) {
      for (let row = 0; row < 3; row++) {
        const nibble = n % 2 === 0
          ? (buf[base + (n >> 1)] >> 4) & 0xF
          :  buf[base + (n >> 1)]       & 0xF;
        grid[r][row] = SYMBOLS[nibble];
        n++;
      }
    }
    return grid;
  }
}
