import type { SlotConfig } from '../config/SlotConfig';
import type { MathModel } from '../contracts';
import type { SpinResult } from './types';
import { toSpinResult } from './evaluateLines';
import { random } from './rng';

/**
 * Classic reel-strip RNG: each reel stops uniformly on its strip and shows
 * `rows` consecutive symbols. RTP is a property of strips + paytable.
 */
export class ReelStripMath implements MathModel {
  /** `rng` defaults to the seedable engine RNG (math/rng.ts). */
  constructor(private cfg: SlotConfig, private strips: string[][], private rng: () => number = random) {
    if (strips.length !== cfg.grid.cols) {
      throw new Error(`ReelStripMath: ${strips.length} strips for ${cfg.grid.cols} reels`);
    }
  }

  spin(): SpinResult {
    const rows = this.cfg.grid.rows;
    const grid = this.strips.map(strip => {
      const stop = Math.floor(this.rng() * strip.length);
      return Array.from({ length: rows }, (_, r) => strip[(stop + r) % strip.length]);
    });
    return toSpinResult(this.cfg, grid);
  }
}
