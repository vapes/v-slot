import type { SlotConfig } from '../config/SlotConfig';
import type { GameView } from '../contracts';
import type { SpinPipeline, SpinContext } from '../pipeline/SpinPipeline';
import type { ReelController } from '../reels/ReelController';
import { t } from '../i18n/I18n';
import { gameEvents } from './GameEvents';
import type { Wallet } from './Wallet';

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Runs spins through the pipeline: a single spin, the hold-to-turbo loop
 * (while SPIN stays pressed) and autoplay; owns the autoplay / quick-spin
 * toggles and restores controls when the loop ends.
 */
export class SpinLoop {
  private running = false;
  private _autoplay = false;
  private _quick = false;

  constructor(
    private cfg: SlotConfig,
    private wallet: Wallet,
    private view: GameView,
    private reels: ReelController,
    private pipeline: () => SpinPipeline,
    private isButtonHeld: () => boolean,
    private updateBetControls: (enabled: boolean) => void,
  ) {}

  get active(): boolean { return this.running; }
  get autoplay(): boolean { return this._autoplay; }

  setAutoplay(on: boolean): void {
    this._autoplay = on;
    this.view.setAutoplay?.(on);
    gameEvents.emit('autoplay', { on });
    if (on && !this.running) void this.run();
  }

  toggleQuickSpin(): void {
    this._quick = !this._quick;
    this.view.setQuickSpin?.(this._quick);
    gameEvents.emit('quickSpin', { on: this._quick });
  }

  /** SPIN pressed: stops autoplay if it runs, else starts a spin (loop). */
  onSpinPressed(): void {
    if (this._autoplay) this.setAutoplay(false);
    else void this.run();
  }

  async run(): Promise<void> {
    if (this.reels.isSpinning || this.running) return;
    this.running = true;
    const { wallet, view } = this;

    let isTurbo = false;
    let lastWon = false;
    do {
      const ctx: SpinContext = {
        balance: wallet.balance, lineBet: wallet.lineBet, totalBet: wallet.totalBet,
        turbo: isTurbo, quick: this._quick,
        result: null, winAmount: 0, cancelled: false, meta: new Map(),
      };
      await this.pipeline().execute(ctx);
      wallet.balance = ctx.balance;
      lastWon = ctx.winAmount > 0;

      if (ctx.cancelled) {
        view.hud.setStatus(t('status.noBalance'));
        break;
      }
      isTurbo = ctx.turbo && this.isButtonHeld();
      if (!isTurbo && this._autoplay) {
        await delay(lastWon ? this.cfg.timing.autoplayWinPauseMs : this.cfg.timing.autoplayPauseMs);
      }
    } while ((isTurbo || this._autoplay) && wallet.canAffordSpin);

    if (!wallet.canAffordSpin) this.setAutoplay(false);
    // turbo spins skip the idle text; restore it once the loop is over (a win keeps its WIN line)
    if (!lastWon && wallet.canAffordSpin) view.hud.setStatus(t('status.idle'));
    this.running = false;
    view.spinButton.setStopMode(false);
    view.spinButton.enabled = true;
    this.updateBetControls(true);
  }
}
