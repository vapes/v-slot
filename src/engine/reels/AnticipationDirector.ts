import type { SlotConfig } from '../config/SlotConfig';
import { AnticipationFX } from '../fx/AnticipationFX';
import type { Reel } from './Reel';

/**
 * Runs anticipation for one spin: extends the planned distance of the
 * anticipating reel (and the reels after it, so they still land in order),
 * then — once every reel to its left has landed — boosts its speed and shows
 * the effect until it lands. Skipped while `suppressed()` (e.g. SPIN held).
 */
export class AnticipationDirector {
  readonly fx: AnticipationFX;
  private flags: boolean[] = [];
  private started: boolean[] = [];
  private state: ('idle' | 'active' | 'done')[] = [];
  private suppressed: () => boolean = () => false;

  constructor(private cfg: SlotConfig, private reels: Reel[]) {
    this.fx = new AnticipationFX(cfg);
  }

  /** Extra blur screens per reel for this spin (0 when no anticipation). */
  plan(flags: boolean[] | null, suppressed?: () => boolean): number[] {
    const cols = this.cfg.grid.cols;
    this.flags = flags ?? new Array(cols).fill(false);
    this.started = new Array(cols).fill(false);
    this.state = new Array(cols).fill('idle');
    this.suppressed = suppressed ?? (() => false);
    const a = this.cfg.anticipation ?? {};
    const frames = (a.extraMs ?? 1400) / (1000 / 60);
    const extra = (frames * this.cfg.spin.spinSpeed * (a.speedBoost ?? 1.6)) / this.cfg.reelAreaHeight;
    let acc = 0;
    return this.flags.map(f => (acc += f ? extra : 0));
  }

  markStarted(reel: number): void {
    this.started[reel] = true;
  }

  /** Call every frame after the reels updated. */
  update(dt: number): void {
    const landed = (i: number) => this.started[i] && !this.reels[i].isSpinning;
    this.flags.forEach((on, i) => {
      if (!on) return;
      if (this.state[i] === 'idle' && this.reels.slice(0, i).every((_, r) => landed(r))) {
        if (this.suppressed() || landed(i)) {
          this.state[i] = 'done';
        } else {
          this.state[i] = 'active';
          this.reels[i].boost(this.cfg.anticipation?.speedBoost ?? 1.6);
          this.fx.start(i);
        }
      } else if (this.state[i] === 'active' && landed(i)) {
        this.state[i] = 'done';
        this.fx.stop(i);
      }
    });
    this.fx.update(dt);
  }

  /** Slam stop: drop every effect. */
  cancel(): void {
    this.state = this.state.map(() => 'done');
    this.fx.stopAll();
  }
}
