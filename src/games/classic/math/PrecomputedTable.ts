import type { SlotConfig } from '@/engine';

type SymbolId = string;

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
  /** Symbol by nibble index (generator encodes in config.symbols order). */
  private readonly symbols: SymbolId[];
  private readonly reels: number;
  private readonly rows: number;
  private readonly screenBytes: number;

  constructor(cfg: SlotConfig, private probabilities: number[]) {
    this.symbols = cfg.symbolIds;
    this.reels = cfg.grid.cols;
    this.rows = cfg.grid.rows;
    this.screenBytes = Math.ceil((this.reels * this.rows) / 2);
  }

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

    // Build cumulative probability thresholds from config.payoutDistribution (same order)
    let cumProb = 0;
    for (const probability of this.probabilities) {
      cumProb += probability;
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

  /** Decode screen at `screenIndex` into a reels×rows SymbolId grid. */
  private _decodeGrid(screenIndex: number): SymbolId[][] {
    const buf  = this.screens!;
    const base = screenIndex * this.screenBytes;
    const grid: SymbolId[][] = Array.from({ length: this.reels }, () => new Array<SymbolId>(this.rows));
    let n = 0;
    for (let r = 0; r < this.reels; r++) {
      for (let row = 0; row < this.rows; row++) {
        const nibble = n % 2 === 0
          ? (buf[base + (n >> 1)] >> 4) & 0xF
          :  buf[base + (n >> 1)]       & 0xF;
        grid[r][row] = this.symbols[nibble];
        n++;
      }
    }
    return grid;
  }
}
