import type { SlotConfig } from '../config/SlotConfig';
import { getWinCategory } from './WinCelebration';

/** Count-up length for a win, from cfg.winPresentation (0 = show instantly). */
export function rollupDuration(cfg: SlotConfig, win: number, totalBet: number): number {
  const wp = cfg.winPresentation;
  if (!wp || win <= 0) return 0;
  const category = getWinCategory(cfg, win, totalBet);
  if (category && wp.bigRollupMs) return wp.bigRollupMs[category];
  const ratio = win / totalBet;
  const tier = wp.rollup?.find(t => ratio < t.below) ?? wp.rollup?.[wp.rollup.length - 1];
  return tier?.ms ?? 0;
}

/** Ticker-driven win counter (ease-out), snapped to the final value by finish(). */
export class WinRollup {
  private target = 0;
  private elapsed = 0;
  private duration = 0;
  private onValue: ((v: number) => void) | null = null;

  start(amount: number, durationMs: number, onValue: (v: number) => void): void {
    this.target = amount;
    this.elapsed = 0;
    this.duration = durationMs;
    this.onValue = onValue;
    if (durationMs <= 0) this.finish();
    else onValue(0);
  }

  /** dt is Pixi ticker delta (1 = 60 fps frame). */
  update(dt: number): void {
    if (!this.onValue) return;
    this.elapsed += dt * (1000 / 60);
    if (this.elapsed >= this.duration) {
      this.finish();
      return;
    }
    const t = this.elapsed / this.duration;
    const eased = 1 - Math.pow(1 - t, 2);
    this.onValue(Math.floor(this.target * eased));
  }

  finish(): void {
    const cb = this.onValue;
    this.onValue = null;
    cb?.(this.target);
  }
}
