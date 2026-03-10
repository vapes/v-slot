import { SpinPipeline } from './SpinPipeline';
import { spin as spinConfig } from '../gameConfig.json';
import { getWinCategory } from '../ui/WinCelebration';
import type { SpinResult } from '../math/SlotMath';
import type { SlotMath } from '../math/SlotMath';
import type { ReelController } from '../reels/ReelController';
import type { WinCelebration } from '../ui/WinCelebration';
import type { GameHUD } from '../ui/GameHUD';

export interface PipelineDeps {
  slotMath: SlotMath;
  reelController: ReelController;
  winCelebration: WinCelebration;
  hud: GameHUD;
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
  const { slotMath, reelController, winCelebration, hud } = deps;
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
      hud.setStatus('Good luck!');
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
        if (ctx.turbo) {
          reelController.startTurboSpin(ctx.result!, resolve);
        } else {
          reelController.startSpin(ctx.result!, resolve);
          // If button is held, auto-forceStop after all reels have started
          const allReelsStartDelay = spinConfig.reelStartInterval * 5;
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
        hud.setStatus('Place your bets');
      }
    },
  });

  pipeline.add('post', {
    name: 'showWinAnimations',
    execute: (ctx) => {
      if (!ctx.result || ctx.winAmount <= 0) return;
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
    execute: (ctx) => {
      if (ctx.winAmount <= 0) return;
      const category = getWinCategory(ctx.winAmount, ctx.totalBet);
      if (!category) return;
      if (ctx.turbo) {
        winCelebration.playStatic(category, 500);
      } else {
        winCelebration.play(category);
      }
    },
  });

  pipeline.add('post', {
    name: 'turboWinDelay',
    execute: async (ctx) => {
      if (!ctx.turbo || ctx.winAmount <= 0) return;
      await new Promise(r => setTimeout(r, 300));
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
