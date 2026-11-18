import { SpinPipeline, type SpinContext } from './SpinPipeline';
import { getWinCategory } from '../ui/WinCelebration';
import { computeAnticipation } from '../math/anticipation';
import { debugging, forced } from '../core/devFlags';
import { gameEvents } from '../core/GameEvents';
import { t } from '../i18n/I18n';
import type { SlotConfig } from '../config/SlotConfig';
import type { SpinResult } from '../math/types';
import type { Hud, MathModel } from '../contracts';
import type { ReelController } from '../reels/ReelController';
import type { WinCelebration } from '../ui/WinCelebration';
import type { WinBox } from '../ui/WinBox';

export interface PipelineDeps {
  cfg: SlotConfig;
  slotMath: MathModel;
  reelController: ReelController;
  winCelebration: WinCelebration;
  /** Status line + win amount (engine win box, placed by GameView.winBox). */
  winBox: WinBox;
  hud: Hud;
  isButtonHeld(): boolean;
  setBalance(b: number): void;
  showStopButton(): void;
  hideStopButton(): void;
  disableBetButtons(): void;
  enableControls(): void;
  stopWinCycle(): void;
  startWinCycle(result: SpinResult): void;
  /** Play a bonus round decided by the math (e.g. sticky respins). */
  playFeature(result: SpinResult, ctx: SpinContext): Promise<void>;
  /** Drop mode: cascades + multiplier of the spin (SpinResult.tumbles / multiplier). */
  playTumbles(result: SpinResult, ctx: SpinContext): Promise<void>;
  /** Drop mode: free spins triggered by the spin (SpinResult.freeSpins). */
  playFreeSpins(result: SpinResult, ctx: SpinContext): Promise<void>;
}

export function buildSpinPipeline(deps: PipelineDeps): SpinPipeline {
  const { cfg, slotMath, reelController, winCelebration, winBox, hud } = deps;
  /** Win box count-up / ride run outside turbo / quick spins only. */
  const animated = (ctx: SpinContext) => !ctx.turbo && !ctx.quick;
  const spinConfig = cfg.spin;
  const pipeline = new SpinPipeline();

  // ── PRE (before server) ──────────────────────────
  pipeline.add('pre', {
    name: 'validateBalance',
    execute: (ctx) => {
      if (ctx.balance < ctx.stake) ctx.cancelled = true;
    },
  });

  pipeline.add('pre', {
    name: 'stopPreviousWins',
    execute: () => {
      deps.stopWinCycle();
      winCelebration.stop();
      winBox.finish();
    },
  });

  pipeline.add('pre', {
    name: 'deductBalance',
    execute: (ctx) => {
      ctx.balance -= ctx.stake;
      deps.setBalance(ctx.balance);
    },
  });

  pipeline.add('pre', {
    name: 'disableControls',
    execute: () => {
      deps.showStopButton();
      deps.disableBetButtons();
    },
  });

  pipeline.add('pre', {
    name: 'showPreSpinUI',
    execute: (ctx) => {
      winBox.setStatus(t('status.spin'));
      gameEvents.emit('spinStart', { totalBet: ctx.totalBet, turbo: ctx.turbo, quick: ctx.quick, buy: ctx.buy, stake: ctx.stake });
      hud.updateBalanceDisplay(ctx.balance, ctx.totalBet);
    },
  });

  // ── SERVER ───────────────────────────────────────
  pipeline.add('server', {
    name: 'generateResult',
    execute: (ctx) => {
      ctx.result = slotMath.spin(ctx.buy ? { buyFeature: true } : undefined);
    },
  });

  // ── POST (after server) ──────────────────────────
  pipeline.add('post', {
    name: 'spinAnimation',
    execute: (ctx) => {
      return new Promise<void>((resolve) => {
        if (ctx.turbo || ctx.quick) {
          reelController.startTurboSpin(ctx.result!, resolve);
        } else {
          // anticipation never in turbo / quick; also skipped while SPIN is held
          const tease = forced('anticipation')
            ? Array.from({ length: cfg.grid.cols }, (_, i) => i >= (cfg.tease?.startReel ?? cfg.grid.cols))
            : computeAnticipation(cfg, ctx.result!.grid);
          reelController.startSpin(ctx.result!, resolve, tease, deps.isButtonHeld);
          // If button is held, auto-forceStop after all reels have started
          const allReelsStartDelay = spinConfig.reelStartInterval * cfg.grid.cols;
          setTimeout(() => {
            if (deps.isButtonHeld()) reelController.forceStop();
          }, allReelsStartDelay);
        }
      });
    },
  });

  pipeline.add('post', {
    name: 'resolveTurboMode',
    execute: (ctx) => {
      gameEvents.emit('reelsStopped', { result: ctx.result! });
      ctx.turbo = deps.isButtonHeld();
    },
  });

  pipeline.add('post', {
    name: 'playTumbles',
    execute: async (ctx) => {
      if (ctx.result?.tumbles?.length || ctx.result?.multiplier) await deps.playTumbles(ctx.result, ctx);
    },
  });

  pipeline.add('post', {
    name: 'playFeature',
    execute: async (ctx) => {
      if (ctx.result?.feature) await deps.playFeature(ctx.result, ctx);
      if (ctx.result?.freeSpins) await deps.playFreeSpins(ctx.result, ctx);
    },
  });

  pipeline.add('post', {
    name: 'calculateWins',
    execute: (ctx) => {
      const r = ctx.result;
      const total = (r?.totalWin ?? 0) + (r?.feature?.totalWin ?? 0) + (r?.freeSpins?.totalWin ?? 0);
      if (total > 0) ctx.winAmount = Math.round(total * ctx.lineBet);
    },
  });

  pipeline.add('post', {
    name: 'creditBalance',
    execute: (ctx) => {
      if (ctx.winAmount > 0) {
        ctx.balance += ctx.winAmount;
        deps.setBalance(ctx.balance);
      }
    },
  });

  pipeline.add('post', {
    name: 'updateWinUI',
    execute: (ctx) => {
      if (ctx.winAmount > 0) {
        if (!animated(ctx)) winBox.showWin(ctx.winAmount);
        // small win: quick count-up in place (BIG+ counts in playCelebration)
        else if (getWinCategory(cfg, ctx.winAmount, ctx.totalBet)) return;
        // drop mode already ran the amount up tumble by tumble
        else if (cfg.dropTiming) winBox.showWin(ctx.winAmount);
        else void winBox.countUp(ctx.winAmount, ctx.totalBet);
      } else if (!ctx.turbo) {
        winBox.setStatus(t('status.idle'));
      }
    },
  });

  pipeline.add('post', {
    name: 'showWinAnimations',
    execute: (ctx) => {
      // line wins of the base grid only (a feature-only win has none to show)
      if (!ctx.result || ctx.winAmount <= 0 || ctx.result.wins.length === 0) return;
      if (ctx.turbo) {
        reelController.showWinsTurbo(ctx.result);
      } else {
        reelController.showWins(ctx.result, spinConfig.winAllDelay);
        deps.startWinCycle(ctx.result);
      }
    },
  });

  pipeline.add('post', {
    name: 'playCelebration',
    execute: async (ctx) => {
      if (ctx.winAmount <= 0) return;
      const category = getWinCategory(cfg, ctx.winAmount, ctx.totalBet);
      gameEvents.emit('win', { amount: ctx.winAmount, totalBet: ctx.totalBet, category });
      if (!category) return;
      if (animated(ctx)) {
        await winBox.countUp(ctx.winAmount, ctx.totalBet);
      } else if (ctx.turbo) {
        winCelebration.playStatic(category, cfg.timing.turboBannerMs);
      } else {
        winCelebration.play(category);
      }
    },
  });

  pipeline.add('post', {
    name: 'turboWinDelay',
    execute: async (ctx) => {
      if (!ctx.turbo || ctx.winAmount <= 0) return;
      await new Promise(r => setTimeout(r, cfg.timing.turboWinMs));
      reelController.clearWins();
    },
  });

  pipeline.add('post', {
    name: 'refreshBalance',
    execute: (ctx) => {
      hud.updateBalanceDisplay(ctx.balance, ctx.totalBet);
    },
  });

  pipeline.add('post', {
    name: 'enableControls',
    execute: (ctx) => {
      if (ctx.turbo) return;
      deps.hideStopButton();
      deps.enableControls();
    },
  });

  if (debugging('pipeline')) console.info(pipeline.describe());
  return pipeline;
}
