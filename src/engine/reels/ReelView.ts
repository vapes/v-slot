import type { Container } from 'pixi.js';
import type { SlotSymbol } from '../symbols/SlotSymbol';

/**
 * One column of the grid as the ReelController drives it: a spinning `Reel`
 * or a falling `DropReel` (config.drop). Both keep their visible cells in
 * `symbolContainer` at y = row × cellHeight once landed.
 */
export interface ReelView {
  readonly container: Container;
  readonly symbolContainer: Container;
  /** Visible cells, top → bottom. */
  getVisibleSymbols(): SlotSymbol[];
  /** True until the column has landed on its targets (bounce no longer counts). */
  readonly isSpinning: boolean;
  /** Land `targets` (top → bottom); `screens` = spin length (drop: 1 + extra wait), `fast` = turbo start. */
  startSpin(targets: string[], screens: number, onStop: () => void, fast?: boolean): void;
  /** Slam stop: land within `frames` frames. */
  forceStop(frames: number): void;
  /** Show `ids` instantly (or the last targets). */
  snapToTarget(ids?: string[]): void;
  /** Anticipation: speed up (spinning reels only). */
  boost(multiplier: number): void;
  update(dt: number): void;
  /** Drop mode: cells that landed since the last call (each pebble lands on its own). */
  takeLanded?(): { sym: SlotSymbol; row: number }[];
}
