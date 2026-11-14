import { SpinPipeline } from './SpinPipeline';
import { getWinCategory } from '../ui/WinCelebration';
import { t } from '../i18n/I18n';
import type { SlotConfig } from '../config/SlotConfig';
import type { SpinResult } from '../math/types';
import type { Hud, MathModel } from '../contracts';
import type { ReelController } from '../reels/ReelController';
import type { WinCelebration } from '../ui/WinCelebration';

export interface PipelineDeps {
  cfg: SlotConfig;
  slotMath: MathModel;
  reelController: ReelController;
  winCelebration: WinCelebration;
  hud: Hud;
  isButtonHeld(): boolean;
  setBalance(b: number): void;
  showStopButton(): void;
  hideStopButton(): void;
  disableBetButtons(): void;
  enableControls(): void;
  stopWinCycle(): void;
  startWinCycle(result: SpinResult): void;
}

export function buildSpinPipeline(deps: PipelineDeps): SpinPipeline {
  const { cfg, slotMath, reelController, winCelebration, hud } = deps;
  const spinConfig = cfg.spin;
  /** Turbo = hold-to-spin loop or the TURBO toggle: wins get a short static frame only. */
  const isTurbo = (ctx: { turbo: boolean; quick: boolean }) => ctx.turbo || ctx.quick;
  const turboFrameMs = spinConfig.turboWinFrameMs ?? 300;
  const turboBannerMs = spinConfig.turboBannerMs ?? 500;
  const pipeline = new SpinPipeline();

  // ── PRE (before server) ──────────────────────────
  pipeline.add('pre', {
    name: 'validateBalance',
    execute: (ctx) => {
      if (ctx.balance < ctx.totalBet) ctx.cancelled = true;
    },
  });

  pipeline.add('pre', {
    name: 'stopPreviousWins',
    execute: () => {
      deps.stopWinCycle();
      winCelebration.stop();
    },
  });

  pipeline.add('pre', {
    name: 'deductBalance',
    execute: (ctx) => {
      ctx.balance -= ctx.totalBet;
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
      hud.setStatus(t('status.spin'));
      hud.updateBalanceDisplay(ctx.balance, ctx.totalBet);
    },
  });

  // ── SERVER ───────────────────────────────────────
  pipeline.add('server', {
    name: 'generateResult',
    execute: (ctx) => {
      ctx.result = slotMath.spin();
    },
  });

  // ── POST (after server) ──────────────────────────
  pipeline.add('post', {
    name: 'spinAnimation',
    execute: (ctx) => {
      console.log(ctx.turbo ? 'spin turbo' : 'spin normal');
      return new Promise<void>((resolve) => {
        if (ctx.turbo || ctx.quick) {
          reelController.startTurboSpin(ctx.result!, resolve);
        } else {
          reelController.startSpin(ctx.result!, resolve);
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
      ctx.turbo = deps.isButtonHeld();
    },
  });

  pipeline.add('post', {
    name: 'calculateWins',
    execute: (ctx) => {
      if (ctx.result && ctx.result.totalWin > 0) {
        ctx.winAmount = ctx.result.totalWin * ctx.lineBet;
      }
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
        hud.setWinStatus(ctx.winAmount);
      } else if (!ctx.turbo) {
        hud.setStatus(t('status.idle'));
      }
    },
  });

  pipeline.add('post', {
    name: 'showWinAnimations',
    execute: (ctx) => {
      if (!ctx.result || ctx.winAmount <= 0) return;
      if (isTurbo(ctx)) {
        // no symbol animation and no line cycle — just frame the winners briefly
        reelController.showWinsTurbo(ctx.result);
      } else {
        reelController.showWins(ctx.result, spinConfig.winAllDelay);
        deps.startWinCycle(ctx.result);
      }
    },
  });

  pipeline.add('post', {
    name: 'playCelebration',
    execute: (ctx) => {
      if (ctx.winAmount <= 0) return;
      const category = getWinCategory(cfg, ctx.winAmount, ctx.totalBet);
      if (!category) return;
      if (isTurbo(ctx)) {
        winCelebration.playStatic(category, turboBannerMs);
      } else {
        winCelebration.play(category);
      }
    },
  });

  pipeline.add('post', {
    name: 'turboWinDelay',
    execute: async (ctx) => {
      if (!isTurbo(ctx) || ctx.winAmount <= 0) return;
      await new Promise(r => setTimeout(r, turboFrameMs));
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

  console.log(pipeline.describe());
  return pipeline;
}
