import type { Container } from 'pixi.js';
import type { SlotConfig } from '../config/SlotConfig';
import type { GameView, SymbolRenderer } from '../contracts';
import type { FeatureRound, StickyCell, WinResult } from '../math/types';
import type { ReelController } from '../reels/ReelController';
import { t } from '../i18n/I18n';
import { formatMoney } from '../utils/Money';
import { FeatureBanner } from '../ui/FeatureBanner';
import { FeatureMeter } from './FeatureMeter';
import { StickyLayer } from './StickyLayer';
import { RespinFlyFX } from './RespinFlyFX';
import { planRespinStep } from './respinStep';
import { gameEvents } from '../core/GameEvents';

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Plays back a sticky-respin FeatureRound decided by the math:
 * trigger pulse → "CONGRATULATIONS! YOU WON N RESPINS" window → optional
 * initial sticky cells → respins (new sticky cells pop in, line wins flash) →
 * cells with a cash value pay one by one → optional full-grid prize →
 * "TOTAL WIN" window → base grid restored.
 */
export class RespinPlayer {
  private sticky: StickyLayer;
  private meter: FeatureMeter | null = null;
  private banner: FeatureBanner;
  private fly = new RespinFlyFX();

  private stage!: Container;

  constructor(private cfg: SlotConfig, private reels: ReelController, renderer: SymbolRenderer) {
    this.sticky = new StickyLayer(cfg, renderer, reels.overlay);
    this.banner = new FeatureBanner(cfg);
  }

  /** Banner/meter layers; call once after the game view is mounted. */
  mount(stage: Container): void {
    this.stage = stage;
    this.stage.addChild(this.fly.container, this.banner.container);
  }

  update(dt: number): void {
    this.sticky.update(dt);
    this.banner.update(dt);
    this.fly.update(dt);
    this.meter?.update(dt);
  }

  async play(f: FeatureRound, baseGrid: string[][], lineBet: number, fast: boolean, view: GameView): Promise<void> {
    const ft = this.cfg.featureTiming;
    const ms = (normal: number) => (fast ? normal * ft.fastFactor : normal);
    const money = (v: number) => formatMoney(this.cfg, v * lineBet);
    const label = (c: StickyCell) => (c.tag ? t(`feature.jackpot.${c.tag}`)
      : c.value > 0 ? formatMoney(this.cfg, c.value * lineBet, false) : null);
    this.meter?.container.destroy({ children: true });
    const meter = (this.meter = new FeatureMeter(this.cfg));
    this.stage.addChildAt(meter.container, this.stage.getChildIndex(this.fly.container));

    gameEvents.emit('featureStart', { feature: f });
    // 1. trigger: scatters pulse, then the intro banner
    const [r0, row0] = f.trigger[0] ?? [0, 0];
    const scatter = baseGrid[r0]?.[row0] ?? '';
    const triggerWin: WinResult = { paylineIndex: -1, symbol: scatter, count: f.trigger.length, multiplier: 0, positions: f.trigger };
    this.reels.showWins({ grid: baseGrid, wins: [triggerWin], totalWin: 0 }, 700);
    await wait(ms(ft.triggerMs));
    this.reels.clearWins();
    view.setFeatureMode?.(true);
    this.reels.setBlurPool(f.reelSymbols ?? null);
    await this.banner.show(t('feature.title'), t('feature.intro'), t('feature.won', { n: f.initialRespins }), ms(ft.introMs));

    // 2. optional initial sticky cells (e.g. scatters that stay)
    let running = 0;
    for (const c of f.initialSticky) {
      this.sticky.add(c, label(c));
      running += c.value;
    }
    meter.show(f.initialRespins, money(running));
    if (f.initialSticky.length) await wait(ms(ft.stickMs));

    // 3. respins
    let respins = f.initialRespins;
    for (const step of f.steps) {
      const plan = planRespinStep(respins, step);
      meter.setRespins(plan.during);
      await this.spin(step.grid, fast);
      for (const c of step.newSticky) {
        this.sticky.add(c, label(c));
        running += c.value;
      }
      running += step.lineWin;
      meter.setTotal(money(running));
      if (step.newSticky.length) await wait(ms(ft.newStickyMs));
      // every new sticky cell fires a comet into the counter; the number ticks up when they land
      if (plan.fly.length) {
        const to = meter.counterPoint();
        await Promise.all(plan.fly.map(c => this.fly.fly(this.cellCenter(c), to, ms(ft.flyMs))));
        if (plan.pop) meter.pop();
      }
      respins = plan.after;
      meter.setRespins(respins);
      if (step.wins.length) {
        this.reels.showWins({ grid: step.grid, wins: step.wins, totalWin: step.lineWin }, 700);
        await wait(ms(ft.stepWinMs));
        this.reels.clearWins();
      }
      gameEvents.emit('featureStep', { index: f.steps.indexOf(step), newSticky: step.newSticky.length, respinsLeft: respins });
      await wait(ms(ft.stepPauseMs));
    }

    // 4. collect: every sticky cell with a cash value pays, one after another
    const cells = [...this.sticky.cells].filter(c => c.value > 0 || c.tag)
      .sort((a, b) => a.reel - b.reel || a.row - b.row);
    for (const c of cells) {
      this.sticky.bump(c);
      await wait(ms(ft.collectMs));
    }
    if (f.fullBonus > 0) {
      running += f.fullBonus;
      meter.setTotal(money(running));
      await this.banner.show(t('feature.title'), t('feature.grand'), money(f.fullBonus), ms(ft.grandMs));
    }

    // 5. outro, back to the base game
    await this.banner.show(t('feature.title'), t('feature.total'), money(f.totalWin), ms(ft.outroMs));
    this.sticky.clear();
    this.fly.clear();
    meter.hide();
    this.reels.setBlurPool(null);
    this.reels.snapTo(baseGrid);
    view.setFeatureMode?.(false);
    gameEvents.emit('featureEnd', { totalWin: f.totalWin * lineBet });
  }

  /** Centre of a grid cell in stage px. */
  private cellCenter(c: StickyCell): { x: number; y: number } {
    const { reelOffsetX, reelOffsetY, reelWidth, cellHeight, symbol } = this.cfg;
    return { x: reelOffsetX + c.reel * reelWidth + symbol.width / 2, y: reelOffsetY + c.row * cellHeight + symbol.height / 2 };
  }

  private spin(grid: string[][], fast: boolean): Promise<void> {
    return new Promise(resolve => {
      const result = { grid, wins: [], totalWin: 0 };
      if (fast) this.reels.startTurboSpin(result, resolve);
      else this.reels.startSpin(result, resolve);
    });
  }
}
