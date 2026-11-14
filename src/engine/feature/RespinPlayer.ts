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

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Plays back a sticky-respin FeatureRound decided by the math:
 * intro → trigger scatters stick → respins (new sticky cells pop in, line
 * wins flash) → sticky cells "hatch" one by one → optional full-grid prize →
 * outro with the feature total → base grid restored.
 */
export class RespinPlayer {
  private sticky: StickyLayer;
  private meter: FeatureMeter | null = null;
  private banner: FeatureBanner;

  constructor(private cfg: SlotConfig, private reels: ReelController, renderer: SymbolRenderer, private stage: Container) {
    this.sticky = new StickyLayer(cfg, renderer, reels.overlay);
    this.banner = new FeatureBanner(cfg);
  }

  /** Banner/meter layers; call once after the game view is mounted. */
  mount(): void {
    this.stage.addChild(this.banner.container);
  }

  update(dt: number): void {
    this.sticky.update(dt);
    this.banner.update(dt);
  }

  async play(f: FeatureRound, baseGrid: string[][], lineBet: number, fast: boolean, view: GameView): Promise<void> {
    const fc = this.cfg.feature ?? {};
    const ms = (normal: number, quick: number) => (fast ? quick : normal);
    const money = (v: number) => formatMoney(this.cfg, v * lineBet);
    const label = (c: StickyCell) => (c.tag ? t(`feature.jackpot.${c.tag}`) : formatMoney(this.cfg, c.value * lineBet, false));
    if (!this.meter) {
      this.meter = new FeatureMeter(this.cfg, f.initialRespins);
      this.stage.addChild(this.meter.container);
    }
    const meter = this.meter;

    // 1. trigger: scatters pulse, then the intro banner
    const scatter = f.initialSticky[0]?.symbol ?? '';
    const triggerWin: WinResult = { paylineIndex: -1, symbol: scatter, count: f.trigger.length, multiplier: 0, positions: f.trigger };
    this.reels.showWins({ grid: baseGrid, wins: [triggerWin], totalWin: 0 }, 700);
    await wait(ms(1200, 400));
    this.reels.clearWins();
    view.setFeatureMode?.(true);
    this.reels.setBlurPool(f.reelSymbols ?? null);
    await this.banner.show(t('feature.title'), t('feature.subtitle', { n: f.initialRespins }), ms(fc.introMs ?? 2000, 900));

    // 2. triggering scatters become sticky
    let running = 0;
    for (const c of f.initialSticky) {
      this.sticky.add(c, label(c));
      running += c.value;
    }
    meter.show(f.initialRespins, money(running));
    await wait(ms(600, 200));

    // 3. respins
    let respins = f.initialRespins;
    for (const step of f.steps) {
      meter.setRespins(respins - 1);
      await this.spin(step.grid, fast);
      for (const c of step.newSticky) {
        this.sticky.add(c, label(c));
        running += c.value;
      }
      running += step.lineWin;
      meter.setTotal(money(running));
      if (step.newSticky.length) await wait(ms(450, 150));
      if (step.wins.length) {
        this.reels.showWins({ grid: step.grid, wins: step.wins, totalWin: step.lineWin }, 700);
        await wait(ms(900, 250));
        this.reels.clearWins();
      }
      respins = step.respinsLeft;
      meter.setRespins(respins);
      await wait(ms(fc.stepPauseMs ?? 300, 80));
    }

    // 4. hatch: every sticky cell pays, one after another
    const cells = [...this.sticky.cells].sort((a, b) => a.reel - b.reel || a.row - b.row);
    for (const c of cells) {
      this.sticky.bump(c);
      await wait(ms(fc.collectMs ?? 130, 40));
    }
    if (f.fullBonus > 0) {
      running += f.fullBonus;
      meter.setTotal(money(running));
      await this.banner.show(t('feature.grand'), money(f.fullBonus), ms(2600, 1200));
    }

    // 5. outro, back to the base game
    await this.banner.show(t('feature.total'), money(f.totalWin), ms(fc.outroMs ?? 2200, 1000));
    this.sticky.clear();
    meter.hide();
    this.reels.setBlurPool(null);
    this.reels.snapTo(baseGrid);
    view.setFeatureMode?.(false);
  }

  private spin(grid: string[][], fast: boolean): Promise<void> {
    return new Promise(resolve => {
      const result = { grid, wins: [], totalWin: 0 };
      if (fast) this.reels.startTurboSpin(result, resolve);
      else this.reels.startSpin(result, resolve);
    });
  }
}
