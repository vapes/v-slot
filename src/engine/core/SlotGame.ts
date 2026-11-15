import { Application } from 'pixi.js';
import { color, type SlotConfig } from '../config/SlotConfig';
import { createApp } from './createApp';
import type { GameDefinition, GameView, MathModel } from '../contracts';
import { GameInput } from './GameInput';
import { fitCanvas, goToLobby } from './fitCanvas';
import { keepScreenAwake } from './wakeLock';
import { Wallet } from './Wallet';
import { WinCycle } from './WinCycle';
import { SpinLoop } from './SpinLoop';
import { installQaHooks } from './qaHooks';
import { ReelController } from '../reels/ReelController';
import { WinCelebration } from '../ui/WinCelebration';
import { RespinPlayer } from '../feature/RespinPlayer';
import { HtmlPaytable } from '../ui/HtmlPaytable';
import { t } from '../i18n/I18n';
import { HomeButton } from '../ui/HomeButton';
import { SoundButton } from '../ui/SoundButton';
import { BuyFeatureDialog } from '../ui/BuyFeatureDialog';
import { formatMoney } from '../utils/Money';
import type { SpinPipeline } from '../pipeline/SpinPipeline';
import { buildSpinPipeline } from '../pipeline/buildSpinPipeline';

/**
 * Game-agnostic composition root: builds the Pixi app and every engine part
 * (Wallet = money, SpinLoop = single / turbo / autoplay spins, WinCycle =
 * line-by-line win display, ReelController, RespinPlayer, celebration,
 * paytable, home + sound buttons) and wires them to the game's view and
 * math through the spin pipeline. Everything visual around the reels comes
 * from the game's GameView.
 */
export class SlotGame {
  private readonly cfg: SlotConfig;
  /** Created in init() (Pixi v8 renderers initialise asynchronously). */
  private app!: Application;
  private reels: ReelController;
  private math: MathModel;
  private view: GameView;
  private input!: GameInput;
  private wallet: Wallet;
  private loop: SpinLoop;
  private winCycle: WinCycle;
  private celebration: WinCelebration;
  private respins: RespinPlayer;
  private paytable!: HtmlPaytable;
  private buyDialog: BuyFeatureDialog;
  readonly pipeline: SpinPipeline;

  constructor(def: GameDefinition) {
    const cfg = (this.cfg = def.config);

    this.wallet = new Wallet(cfg);
    this.math = def.createMath();
    const renderer = def.createSymbolRenderer();
    this.reels = new ReelController(cfg, renderer);
    this.respins = new RespinPlayer(cfg, this.reels, renderer);
    this.celebration = new WinCelebration(cfg);
    this.buyDialog = new BuyFeatureDialog(cfg);
    this.view = def.createView({
      changeBet: (d, wrap) => this.changeBet(d, wrap ?? false),
      openPaytable: () => void this.paytable.show(this.wallet.totalBet),
      togglePaytable: () => this.paytable.toggle(this.wallet.totalBet),
      toggleAutoplay: () => this.loop.setAutoplay(!this.loop.autoplay),
      toggleQuickSpin: () => this.loop.toggleQuickSpin(),
      buyFeature: () => void this.buyFeature(),
    });
    const { view, reels } = this;
    this.winCycle = new WinCycle(cfg, reels, view.hud);
    this.loop = new SpinLoop(cfg, this.wallet, view, reels, () => this.pipeline,
      () => this.input.buttonHeld, (on) => this.updateBetControls(on));

    this.pipeline = buildSpinPipeline({
      cfg,
      slotMath: this.math,
      reelController: reels,
      winCelebration: this.celebration,
      hud: view.hud,
      isButtonHeld: () => this.input.buttonHeld,
      setBalance: (b) => { this.wallet.balance = b; },
      showStopButton: () => view.spinButton.setStopMode(true),
      hideStopButton: () => view.spinButton.setStopMode(false),
      disableBetButtons: () => this.updateBetControls(false),
      enableControls: () => {
        view.spinButton.enabled = true;
        this.updateBetControls(!this.loop.active);
      },
      stopWinCycle: () => this.winCycle.stop(),
      startWinCycle: (result) => this.winCycle.start(result, this.wallet.lineBet),
      playFeature: (result, ctx) =>
        this.respins.play(result.feature!, result.grid, ctx.lineBet, ctx.turbo || ctx.quick, view),
    });
  }

  async init(): Promise<void> {
    const { view, cfg } = this;
    this.app = await createApp(cfg.canvas.width, cfg.canvas.height, color(cfg.backgroundColor));
    const canvas = this.app.canvas;
    document.body.appendChild(canvas);
    this.paytable = new HtmlPaytable(cfg, canvas);
    this.input = new GameInput(canvas, cfg.canvas.width, view.spinButton, {
      onSpin: () => this.loop.onSpinPressed(),
      onStop: () => this.reels.forceStop(),
      canInteract: () => !this.paytable.isOpen && !this.buyDialog.isOpen,
    });

    const stage = this.app.stage;
    view.mountBelowReels(stage);
    stage.addChild(this.reels.container);
    view.mountAboveReels(stage);
    this.respins.mount(stage);
    stage.addChild(new HomeButton(cfg.homeButton.x, cfg.homeButton.y, goToLobby, cfg.homeButton.r).container);
    if (cfg.soundButton) {
      const { x, y, r } = cfg.soundButton;
      stage.addChild(new SoundButton(x, y, r).container);
    }
    stage.addChild(this.celebration.container, this.buyDialog.container);

    this.app.ticker.add((ticker) => {
      const dt = ticker.deltaTime; // 1 = one 60 fps frame, as every update() expects
      this.reels.update(dt);
      this.celebration.update(dt);
      this.respins.update(dt);
      view.update?.(dt);
    });
    fitCanvas(this.app, cfg.canvas.width, cfg.canvas.height);
    keepScreenAwake(); // a running game must not let the device sleep
    installQaHooks({
      spin: () => this.loop.onSpinPressed(),
      openPaytable: () => void this.paytable.show(this.wallet.totalBet),
      closePaytable: () => this.paytable.hide(),
      buyFeature: () => void this.buyFeature(true),
      state: () => ({ balance: this.wallet.balance, totalBet: this.wallet.totalBet, spinning: this.loop.active }),
    });

    view.hud.updateBalanceDisplay(this.wallet.balance, this.wallet.totalBet);
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
    if (this.loop.active || !this.wallet.changeBet(delta, wrap)) return;
    this.view.hud.updateBalanceDisplay(this.wallet.balance, this.wallet.totalBet);
    this.updateBetControls(true);
  }

  /** Feature buy: confirm the price (`skipConfirm` for QA), then one bought spin. */
  private async buyFeature(skipConfirm = false): Promise<void> {
    const price = this.loop.buyPrice;
    if (price === null || this.loop.active || this.loop.autoplay || this.buyDialog.isOpen) return;
    if (this.wallet.balance < price) {
      this.view.hud.setStatus(t('status.noBalance'));
      return;
    }
    if (skipConfirm || await this.buyDialog.ask(formatMoney(this.cfg, price))) this.loop.buyFeature();
  }

  private updateBetControls(enabled: boolean): void {
    const price = this.loop?.buyPrice ?? null;
    this.view.setBetControls({
      enabled,
      canDecrease: this.wallet.canDecrease,
      canIncrease: this.wallet.canIncrease,
      canBuy: enabled && price !== null && this.wallet.balance >= price,
    });
  }
}
