import type { Container } from 'pixi.js';
import type { SlotConfig } from '../config/SlotConfig';
import type { GameView } from '../contracts';
import type { FreeSpinsRound, SpinResult, WinResult } from '../math/types';
import type { ReelController } from '../reels/ReelController';
import type { TumblePlayer } from './TumblePlayer';
import { FeatureBanner } from '../ui/FeatureBanner';
import { FeatureMeter } from '../feature/FeatureMeter';
import { gameEvents } from '../core/GameEvents';
import { cellSymbol } from '../math/cells';
import { t } from '../i18n/I18n';
import { formatMoney } from '../utils/Money';

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Drop mode: plays a free-spins round decided by the math (FreeSpinsRound):
 * scatters pulse → "YOU WON N FREE SPINS" → every free spin drops in and
 * tumbles (TumblePlayer; the win box adds up) with the counter above the
 * reels, retriggers add spins → "TOTAL WIN" → the base grid comes back.
 */
export class FreeSpinsPlayer {
  private banner: FeatureBanner;
  private meter: FeatureMeter;

  constructor(private cfg: SlotConfig, private reels: ReelController, private tumbles: TumblePlayer) {
    this.banner = new FeatureBanner(cfg);
    this.meter = new FeatureMeter(cfg);
  }

  mount(stage: Container): void {
    stage.addChild(this.meter.container, this.banner.container);
  }

  update(dt: number): void {
    this.banner.update(dt);
    this.meter.update(dt);
  }

  /** `baseWin` = the triggering spin's own win (× line bet), already in the win box. */
  async play(fs: FreeSpinsRound, baseGrid: string[][], baseWin: number, lineBet: number, fast: boolean, view: GameView): Promise<void> {
    const ft = this.cfg.featureTiming;
    const d = this.cfg.dropTiming!;
    const ms = (v: number) => (fast ? v * ft.fastFactor : v);
    const money = (x: number) => formatMoney(this.cfg, Math.round(x * lineBet));
    gameEvents.emit('featureStart', { feature: fs });

    const [r0, row0] = fs.trigger[0] ?? [0, 0];
    const scatter: WinResult = {
      paylineIndex: -1, symbol: cellSymbol(baseGrid[r0]?.[row0] ?? ''), count: fs.trigger.length, multiplier: 0, positions: fs.trigger,
    };
    this.reels.showWins({ grid: baseGrid, wins: [scatter], totalWin: 0 }, 700);
    await wait(ms(ft.triggerMs));
    this.reels.clearWins();
    view.setFeatureMode?.(true);
    await this.banner.show(t('freespins.title'), t('freespins.intro'), t('freespins.won', { n: fs.initialSpins }), ms(ft.introMs));

    const meter = this.meter;
    let left = fs.initialSpins;
    let total = 0;
    meter.show(left, money(0), 'freespins.left');
    for (const [index, spin] of fs.spins.entries()) {
      meter.setRespins(left - 1);
      await this.drop(spin.result, fast);
      await this.tumbles.play(spin.result, lineBet, fast, Math.round((total + baseWin) * lineBet));
      total += spin.result.totalWin;
      meter.setTotal(money(total));
      if (spin.added > 0) {
        meter.setRespins(spin.spinsLeft);
        meter.pop();
        await this.banner.show(t('freespins.title'), t('freespins.retrigger'), t('freespins.more', { n: spin.added }), ms(d.retriggerMs));
      }
      left = spin.spinsLeft;
      meter.setRespins(left);
      gameEvents.emit('featureStep', { index, newSticky: 0, respinsLeft: left });
      await wait(ms(d.freeSpinPauseMs));
    }

    await this.banner.show(t('freespins.title'), t('feature.total'), money(fs.totalWin), ms(ft.outroMs));
    meter.hide();
    this.tumbles.clear();
    this.reels.snapTo(baseGrid);
    view.setFeatureMode?.(false);
    gameEvents.emit('featureEnd', { totalWin: Math.round(fs.totalWin * lineBet) });
  }

  private drop(result: SpinResult, fast: boolean): Promise<void> {
    return new Promise(resolve => {
      if (fast) this.reels.startTurboSpin(result, resolve);
      else this.reels.startSpin(result, resolve);
    });
  }
}
