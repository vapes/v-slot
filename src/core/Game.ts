import { Application, Sprite } from 'pixi.js';
import {
  GAME_WIDTH, GAME_HEIGHT, BET_OPTIONS, DEFAULT_BET_INDEX, START_BALANCE, PAYLINES, SYMBOL_NAMES,
} from './Config';
import { spin as spinConfig } from '../gameConfig.json';
import { GameInput } from './GameInput';
import { backgroundTexture } from './SkinAssets';
import { ReelController } from '../reels/ReelController';
import { SlotMath, type SpinResult } from '../math/SlotMath';
import { ControlPanel } from '../ui/ControlPanel';
import { WinCelebration } from '../ui/WinCelebration';
import { PaytableScreen } from '../ui/PaytableScreen';
import { GameHUD } from '../ui/GameHUD';
import { formatMoney } from '../utils/Money';
import type { SpinPipeline, SpinContext } from '../pipeline/SpinPipeline';
import { buildSpinPipeline } from '../pipeline/buildSpinPipeline';

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export class Game {
  private app: Application;
  private reelController: ReelController;
  private slotMath: SlotMath;
  private controls: ControlPanel;
  private hud: GameHUD;
  private input!: GameInput;

  private winCycleTimer: ReturnType<typeof setTimeout> | null = null;
  private winCelebration: WinCelebration;
  private paytableScreen: PaytableScreen;
  readonly pipeline: SpinPipeline;

  /** Money is kept in integer cents. */
  private balance = START_BALANCE;
  private betIndex = DEFAULT_BET_INDEX;
  private get totalBet(): number { return BET_OPTIONS[this.betIndex]; }
  private get lineBet(): number { return this.totalBet / PAYLINES.length; }

  private spinLoopActive = false;
  private autoplay = false;
  private quickSpin = false;
  private inTurboMode = false;

  constructor() {
    this.app = new Application({
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: 0x120818,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });

    this.slotMath = new SlotMath();
    this.reelController = new ReelController();
    this.winCelebration = new WinCelebration();
    this.paytableScreen = new PaytableScreen();
    this.hud = new GameHUD();
    this.controls = new ControlPanel({
      onMenu: () => this.paytableScreen.toggle(this.lineBet),
      onTrophy: () => this.paytableScreen.show(this.lineBet),
      onCoins: () => this.changeBet(1, true),
      onAuto: () => this.setAutoplay(!this.autoplay),
      onTurbo: () => {
        this.quickSpin = !this.quickSpin;
        this.controls.turboBtn.active = this.quickSpin;
      },
    });
    const { spinButton, betDecrBtn, betIncrBtn } = this.controls;

    this.pipeline = buildSpinPipeline({
      slotMath: this.slotMath,
      reelController: this.reelController,
      winCelebration: this.winCelebration,
      hud: this.hud,
      isButtonHeld: () => this.input.buttonHeld,
      setBalance: (b) => { this.balance = b; },
      showStopButton: () => {
        spinButton.setStopMode(true);
        betDecrBtn.enabled = false;
        betIncrBtn.enabled = false;
      },
      hideStopButton: () => spinButton.setStopMode(false),
      disableBetButtons: () => this.setBetControlsEnabled(false),
      enableControls: () => {
        spinButton.enabled = true;
        this.updateBetButtonStates();
      },
      stopWinCycle: () => this.stopWinCycle(),
      startWinCycle: (result) => this.startWinCycle(result),
    });

    this.hud.updateBalanceDisplay(this.balance, this.totalBet);
    this.updateBetButtonStates();
  }

  async init(): Promise<void> {
    const canvas = this.app.view as HTMLCanvasElement;
    document.body.appendChild(canvas);

    const { spinButton, betDecrBtn, betIncrBtn } = this.controls;
    this.input = new GameInput(canvas, spinButton, betDecrBtn, betIncrBtn, {
      onSpin: () => {
        if (this.autoplay) this.setAutoplay(false);
        else void this.doSpin();
      },
      onStop: () => this.reelController.forceStop(),
      onBetChange: (delta) => this.changeBet(delta, false),
      canInteract: () => !this.paytableScreen.isOpen,
    });

    this.setupStage();
    this.app.ticker.add((dt) => {
      this.reelController.update(dt);
      this.winCelebration.update(dt);
      this.controls.update(dt);
    });
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
  }

  private setupStage(): void {
    const bg = new Sprite(backgroundTexture());
    bg.width = GAME_WIDTH;
    bg.height = GAME_WIDTH * bg.texture.height / bg.texture.width;
    this.app.stage.addChild(bg);

    this.app.stage.addChild(this.reelController.container);
    this.controls.addToStage(this.app.stage);
    this.hud.addToStage(this.app.stage);
    this.app.stage.addChild(this.winCelebration.container);
    this.app.stage.addChild(this.paytableScreen.container);
  }

  private changeBet(delta: -1 | 1, wrap: boolean): void {
    if (this.spinLoopActive) return;
    let next = this.betIndex + delta;
    if (wrap) next = (next + BET_OPTIONS.length) % BET_OPTIONS.length;
    if (next < 0 || next >= BET_OPTIONS.length) return;
    this.betIndex = next;
    this.hud.updateBalanceDisplay(this.balance, this.totalBet);
    this.updateBetButtonStates();
  }

  private setBetControlsEnabled(on: boolean): void {
    const { betDecrBtn, betIncrBtn, coinsBtn } = this.controls;
    betDecrBtn.enabled = on && this.betIndex > 0;
    betIncrBtn.enabled = on && this.betIndex < BET_OPTIONS.length - 1;
    coinsBtn.enabled = on;
  }

  private updateBetButtonStates(): void {
    this.setBetControlsEnabled(!this.spinLoopActive);
  }

  private setAutoplay(on: boolean): void {
    this.autoplay = on;
    this.controls.autoBtn.active = on;
    if (on && !this.spinLoopActive) void this.doSpin();
  }

  private async doSpin(): Promise<void> {
    if (this.reelController.isSpinning || this.spinLoopActive) return;
    this.spinLoopActive = true;

    let isTurbo = false;
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

      if (ctx.cancelled) {
        this.hud.setStatus('Not enough balance');
        break;
      }

      isTurbo = ctx.turbo && this.input.buttonHeld;
      if (isTurbo && !this.inTurboMode) {
        this.inTurboMode = true;
        console.log('turbo mode started');
      }
      if (!isTurbo && this.autoplay) {
        await delay(ctx.winAmount > 0 ? spinConfig.autoplayWinPause : spinConfig.autoplayPause);
      }
    } while ((isTurbo || this.autoplay) && this.balance >= this.totalBet);

    if (this.balance < this.totalBet) this.setAutoplay(false);
    this.spinLoopActive = false;
    this.endSpinCycle();
  }

  private endSpinCycle(): void {
    if (this.inTurboMode) {
      this.inTurboMode = false;
      console.log('turbo mode finished');
    }
    const { spinButton } = this.controls;
    spinButton.setStopMode(false);
    spinButton.enabled = true;
    this.updateBetButtonStates();
  }

  private startWinCycle(result: SpinResult): void {
    const { winAllDelay, winLineInterval } = spinConfig;
    const lineBet = this.lineBet;
    let lineIndex = 0;
    const showNextLine = () => {
      const win = result.wins[lineIndex];
      this.reelController.showWinLine(win, winLineInterval);
      const amount = formatMoney(win.multiplier * lineBet);
      this.hud.setLineInfo(`LINE ${win.paylineIndex + 1}: ${win.count}× ${SYMBOL_NAMES[win.symbol].toUpperCase()} — ${amount}`);
      lineIndex = (lineIndex + 1) % result.wins.length;
      this.winCycleTimer = setTimeout(showNextLine, winLineInterval);
    };
    this.winCycleTimer = setTimeout(showNextLine, winAllDelay);
  }

  private stopWinCycle(): void {
    if (this.winCycleTimer !== null) {
      clearTimeout(this.winCycleTimer);
      this.winCycleTimer = null;
    }
    this.hud.hideLineInfo();
  }

  private handleResize(): void {
    const canvas = this.app.view as HTMLCanvasElement;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const scale = Math.min(w / GAME_WIDTH, h / GAME_HEIGHT);

    canvas.style.width = `${GAME_WIDTH * scale}px`;
    canvas.style.height = `${GAME_HEIGHT * scale}px`;
    canvas.style.position = 'absolute';
    canvas.style.left = `${(w - GAME_WIDTH * scale) / 2}px`;
    canvas.style.top = `${(h - GAME_HEIGHT * scale) / 2}px`;
  }
}
