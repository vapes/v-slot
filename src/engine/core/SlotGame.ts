import { Application } from 'pixi.js';
import { color, type SlotConfig } from '../config/SlotConfig';
import type { GameDefinition, GameView, MathModel } from '../contracts';
import type { SpinResult } from '../math/types';
import { lineBetOf } from '../math/Paytable';
import { GameInput } from './GameInput';
import { fitCanvas, goToLobby } from './fitCanvas';
import { keepScreenAwake } from './wakeLock';
import { ReelController } from '../reels/ReelController';
import { WinCelebration } from '../ui/WinCelebration';
import { RespinPlayer } from '../feature/RespinPlayer';
import { HtmlPaytable } from '../ui/HtmlPaytable';
import { t } from '../i18n/I18n';
import { HomeButton } from '../ui/HomeButton';
import { SoundButton } from '../ui/SoundButton';
import { formatMoney } from '../utils/Money';
import type { SpinPipeline, SpinContext } from '../pipeline/SpinPipeline';
import { buildSpinPipeline } from '../pipeline/buildSpinPipeline';

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Game-agnostic slot orchestrator: owns balance/bet state, the spin loop
 * (single, hold-to-turbo, autoplay, quick spin), the win cycle and the
 * shared layers (reels, celebration, paytable, home button). Everything
 * visual around the reels comes from the game's GameView.
 */
export class SlotGame {
  private readonly cfg: SlotConfig;
  private app: Application;
  private reelController: ReelController;
  private math: MathModel;
  private view: GameView;
  private input!: GameInput;
  private winCelebration: WinCelebration;
  private respins: RespinPlayer;
  private paytable!: HtmlPaytable;
  private homeButton: HomeButton;
  readonly pipeline: SpinPipeline;

  private winCycleTimer: ReturnType<typeof setTimeout> | null = null;
  private balance: number;
  private betIndex: number;
  private spinLoopActive = false;
  private autoplay = false;
  private quickSpin = false;

  private get totalBet(): number { return this.cfg.betOptions[this.betIndex]; }
  private get lineBet(): number { return lineBetOf(this.cfg, this.totalBet); }

  constructor(def: GameDefinition) {
    const cfg = (this.cfg = def.config);
    this.balance = cfg.startBalance;
    this.betIndex = cfg.defaultBetIndex;

    this.app = new Application({
      width: cfg.canvas.width,
      height: cfg.canvas.height,
      backgroundColor: color(cfg.backgroundColor),
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });

    this.math = def.createMath();
    const renderer = def.createSymbolRenderer();
    this.reelController = new ReelController(cfg, renderer);
    this.respins = new RespinPlayer(cfg, this.reelController, renderer, this.app.stage);
    this.winCelebration = new WinCelebration(cfg);
    this.view = def.createView({
      changeBet: (d, wrap) => this.changeBet(d, wrap ?? false),
      openPaytable: () => void this.paytable.show(this.totalBet),
      togglePaytable: () => this.paytable.toggle(this.totalBet),
      toggleAutoplay: () => this.setAutoplay(!this.autoplay),
      toggleQuickSpin: () => {
        this.quickSpin = !this.quickSpin;
        this.view.setQuickSpin?.(this.quickSpin);
      },
    });
    this.homeButton = new HomeButton(cfg.homeButton.x, cfg.homeButton.y, goToLobby, cfg.homeButton.r);

    const { view, reelController, winCelebration } = this;
    this.pipeline = buildSpinPipeline({
      cfg,
      slotMath: this.math,
      reelController,
      winCelebration,
      hud: view.hud,
      isButtonHeld: () => this.input.buttonHeld,
      setBalance: (b) => { this.balance = b; },
      showStopButton: () => view.spinButton.setStopMode(true),
      hideStopButton: () => view.spinButton.setStopMode(false),
      disableBetButtons: () => this.updateBetControls(false),
      enableControls: () => {
        view.spinButton.enabled = true;
        this.updateBetControls(!this.spinLoopActive);
      },
      stopWinCycle: () => this.stopWinCycle(),
      startWinCycle: (result) => this.startWinCycle(result),
      playFeature: (result, ctx) =>
        this.respins.play(result.feature!, result.grid, ctx.lineBet, ctx.turbo || ctx.quick, view),
    });
  }

  async init(): Promise<void> {
    const canvas = this.app.view as HTMLCanvasElement;
    document.body.appendChild(canvas);
    const { view, cfg } = this;
    this.paytable = new HtmlPaytable(cfg, canvas);

    this.input = new GameInput(canvas, cfg.canvas.width, view.spinButton, {
      onSpin: () => (this.autoplay ? this.setAutoplay(false) : void this.doSpin()),
      onStop: () => this.reelController.forceStop(),
      canInteract: () => !this.paytable.isOpen,
    });

    const stage = this.app.stage;
    view.mountBelowReels(stage);
    stage.addChild(this.reelController.container);
    view.mountAboveReels(stage);
    this.respins.mount();
    stage.addChild(this.homeButton.container);
    if (cfg.soundButton) {
      const { x, y, r } = cfg.soundButton;
      stage.addChild(new SoundButton(x, y, r).container);
    }
    stage.addChild(this.winCelebration.container);

    this.app.ticker.add((dt) => {
      this.reelController.update(dt);
      this.winCelebration.update(dt);
      this.respins.update(dt);
      view.update?.(dt);
    });
    fitCanvas(this.app, cfg.canvas.width, cfg.canvas.height);
    keepScreenAwake(); // a running game must not let the device sleep

    view.hud.updateBalanceDisplay(this.balance, this.totalBet);
    view.spinButton.enabled = false;
    this.updateBetControls(false);
    try {
      await this.math.load?.();
      view.hud.setStatus(t('status.idle'));
      view.spinButton.enabled = true;
      this.updateBetControls(true);
    } catch (err) {
      view.hud.setStatus(t('status.loadFailed'));
      console.error('[SlotGame] math load failed:', err);
    }
  }

  private changeBet(delta: -1 | 1, wrap: boolean): void {
    if (this.spinLoopActive) return;
    const n = this.cfg.betOptions.length;
    let next = this.betIndex + delta;
    if (wrap) next = (next + n) % n;
    if (next < 0 || next >= n) return;
    this.betIndex = next;
    this.view.hud.updateBalanceDisplay(this.balance, this.totalBet);
    this.updateBetControls(true);
  }

  private updateBetControls(enabled: boolean): void {
    this.view.setBetControls({
      enabled,
      canDecrease: this.betIndex > 0,
      canIncrease: this.betIndex < this.cfg.betOptions.length - 1,
    });
  }

  private setAutoplay(on: boolean): void {
    this.autoplay = on;
    this.view.setAutoplay?.(on);
    if (on && !this.spinLoopActive) void this.doSpin();
  }

  private async doSpin(): Promise<void> {
    if (this.reelController.isSpinning || this.spinLoopActive) return;
    this.spinLoopActive = true;
    const { spin } = this.cfg;

    let isTurbo = false;
    let lastWon = false;
    do {
      const ctx: SpinContext = {
        balance: this.balance,
        lineBet: this.lineBet,
        totalBet: this.totalBet,
        turbo: isTurbo,
        quick: this.quickSpin,
        result: null,
        winAmount: 0,
        cancelled: false,
        meta: new Map(),
      };

      await this.pipeline.execute(ctx);
      this.balance = ctx.balance;
      lastWon = ctx.winAmount > 0;

      if (ctx.cancelled) {
        this.view.hud.setStatus(t('status.noBalance'));
        break;
      }

      isTurbo = ctx.turbo && this.input.buttonHeld;
      if (!isTurbo && this.autoplay) {
        await delay(ctx.winAmount > 0 ? spin.autoplayWinPause ?? 1600 : spin.autoplayPause ?? 250);
      }
    } while ((isTurbo || this.autoplay) && this.balance >= this.totalBet);

    if (this.balance < this.totalBet) this.setAutoplay(false);
    // turbo spins skip the idle text; restore it once the loop is over (a win keeps its WIN line)
    if (!lastWon && this.balance >= this.totalBet) this.view.hud.setStatus(t('status.idle'));
    this.spinLoopActive = false;
    this.view.spinButton.setStopMode(false);
    this.view.spinButton.enabled = true;
    this.updateBetControls(true);
  }

  private startWinCycle(result: SpinResult): void {
    if (result.wins.length === 0) return;
    const { winAllDelay, winLineInterval } = this.cfg.spin;
    const lineBet = this.lineBet;
    let i = 0;
    const showNextLine = () => {
      const win = result.wins[i];
      this.reelController.showWinLine(win, winLineInterval);
      const symbol = t(`symbol.${win.symbol}`, {}, this.cfg.symbolName(win.symbol)).toUpperCase();
      const amount = formatMoney(this.cfg, win.multiplier * lineBet);
      this.view.hud.setLineInfo(t('win.line', { line: win.paylineIndex + 1, count: win.count, symbol, amount }));
      i = (i + 1) % result.wins.length;
      this.winCycleTimer = setTimeout(showNextLine, winLineInterval);
    };
    this.winCycleTimer = setTimeout(showNextLine, winAllDelay);
  }

  private stopWinCycle(): void {
    if (this.winCycleTimer !== null) {
      clearTimeout(this.winCycleTimer);
      this.winCycleTimer = null;
    }
    this.view.hud.hideLineInfo();
  }
}
