import { Application } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, BET_OPTIONS } from './Config';
import { spin as spinConfig } from '../gameConfig.json';
import { GameInput } from './GameInput';
import { ReelController } from '../reels/ReelController';
import { SlotMath, type SpinResult } from '../math/SlotMath';
import { PrecomputedTable } from '../math/PrecomputedTable';
import { SpinButton } from '../ui/SpinButton';
import { BetButton } from '../ui/BetButton';
import { WinCelebration } from '../ui/WinCelebration';
import { PaytableScreen, InfoButton } from '../ui/PaytableScreen';
import { GameHUD } from '../ui/GameHUD';
import type { SpinPipeline, SpinContext } from '../pipeline/SpinPipeline';
import { buildSpinPipeline } from '../pipeline/buildSpinPipeline';

export class Game {
  private app: Application;
  private reelController: ReelController;
  private slotMath: SlotMath;
  private spinButton: SpinButton;
  private hud: GameHUD;
  private input!: GameInput;

  private betDecrBtn: BetButton;
  private betIncrBtn: BetButton;
  private winCycleTimer: ReturnType<typeof setTimeout> | null = null;
  private winCelebration: WinCelebration;
  private paytableScreen: PaytableScreen;
  private infoBtn: InfoButton;
  readonly pipeline: SpinPipeline;

  private balance = 10000;
  private betIndex = 0;
  private get lineBet(): number { return BET_OPTIONS[this.betIndex]; }
  private readonly numLines = 20;
  private get totalBet(): number { return this.lineBet * this.numLines; }

  private inTurboMode = false;

  constructor() {
    this.app = new Application({
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: 0x0D0D1A,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });

    this.slotMath = new SlotMath();
    this.reelController = new ReelController();
    this.spinButton = new SpinButton();
    this.betDecrBtn = new BetButton('−');
    this.betIncrBtn = new BetButton('+');
    this.winCelebration = new WinCelebration();
    this.paytableScreen = new PaytableScreen();
    this.hud = new GameHUD();
    this.infoBtn = new InfoButton(() => this.paytableScreen.toggle());

    this.pipeline = buildSpinPipeline({
      slotMath: this.slotMath,
      reelController: this.reelController,
      winCelebration: this.winCelebration,
      hud: this.hud,
      isButtonHeld: () => this.input.buttonHeld,
      setBalance: (b) => { this.balance = b; },
      showStopButton: () => {
        this.spinButton.setStopMode(true);
        this.betDecrBtn.enabled = false;
        this.betIncrBtn.enabled = false;
      },
      hideStopButton: () => {
        this.spinButton.setStopMode(false);
      },
      disableBetButtons: () => {
        this.betDecrBtn.enabled = false;
        this.betIncrBtn.enabled = false;
      },
      enableControls: () => {
        this.spinButton.enabled = true;
        this.updateBetButtonStates();
      },
      stopWinCycle: () => this.stopWinCycle(),
      startWinCycle: (result) => this.startWinCycle(result),
    });

    this.hud.updateBalanceDisplay(this.balance, this.totalBet);
    this.spinButton.enabled = false;
    this.betDecrBtn.enabled = false;
    this.betIncrBtn.enabled = false;
    this.hud.setStatus('Loading screens...');
  }

async init(): Promise<void> {
    const canvas = this.app.view as HTMLCanvasElement;
    document.body.appendChild(canvas);

    this.input = new GameInput(canvas, this.spinButton, this.betDecrBtn, this.betIncrBtn, {
      onSpin: () => this.doSpin(false),
      onStop: () => this.reelController.forceStop(),
      onBetChange: (delta) => {
        const newIndex = this.betIndex + delta;
        if (newIndex >= 0 && newIndex < BET_OPTIONS.length) {
          this.betIndex = newIndex;
          this.hud.updateBalanceDisplay(this.balance, this.totalBet);
          this.updateBetButtonStates();
        }
      },
    });

    this.setupStage();
    this.setupTicker();
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    const table = new PrecomputedTable();
    try {
      await table.load(import.meta.env.BASE_URL + 'screens.bin');
      this.slotMath.setTable(table);
      this.hud.setStatus('Place your bets');
      this.spinButton.enabled = true;
      this.updateBetButtonStates();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.hud.setStatus('Failed to load screens.bin');
      console.error('[Game] Failed to load precomputed table:', message);
    }
  }

  private setupStage(): void {
    this.positionBetButtons();
    this.app.stage.addChild(this.reelController.container);
    this.app.stage.addChild(this.spinButton.container);
    this.app.stage.addChild(this.betDecrBtn.container);
    this.app.stage.addChild(this.betIncrBtn.container);
    this.hud.addToStage(this.app.stage);
    this.app.stage.addChild(this.winCelebration.container);

    this.infoBtn.container.x = 46;
    this.infoBtn.container.y = GAME_HEIGHT - 46;
    this.app.stage.addChild(this.infoBtn.container);
    this.app.stage.addChild(this.paytableScreen.container);
  }

  private positionBetButtons(): void {
    const spinCenterX = GAME_WIDTH / 2;
    const spinCenterY = this.spinButton.container.y + 50;
    const betBtnRadius = 35;
    const gap = 25;

    this.betDecrBtn.container.x = spinCenterX - 50 - gap - betBtnRadius * 2;
    this.betDecrBtn.container.y = spinCenterY - betBtnRadius;
    this.betIncrBtn.container.x = spinCenterX + 50 + gap;
    this.betIncrBtn.container.y = spinCenterY - betBtnRadius;

    this.updateBetButtonStates();
  }

  private updateBetButtonStates(): void {
    this.betDecrBtn.enabled = this.betIndex > 0;
    this.betIncrBtn.enabled = this.betIndex < BET_OPTIONS.length - 1;
  }

  private setupTicker(): void {
    this.app.ticker.add((dt) => {
      this.reelController.update(dt);
      this.winCelebration.update(dt);
    });
  }

  private async doSpin(turbo: boolean): Promise<void> {
    if (this.reelController.isSpinning) return;

    let isTurbo = turbo;
    do {
      const ctx: SpinContext = {
        balance: this.balance,
        lineBet: this.lineBet,
        totalBet: this.totalBet,
        turbo: isTurbo,
        result: null,
        winAmount: 0,
        cancelled: false,
        meta: new Map(),
      };

      await this.pipeline.execute(ctx);
      this.balance = ctx.balance;

      if (ctx.cancelled) break;

      isTurbo = ctx.turbo && this.input.buttonHeld;
      if (isTurbo && !this.inTurboMode) {
        this.inTurboMode = true;
        console.log('turbo mode started');
      }
    } while (isTurbo && this.balance >= this.totalBet);

    this.endSpinCycle();
  }

  private endSpinCycle(): void {
    if (this.inTurboMode) {
      this.inTurboMode = false;
      console.log('turbo mode finished');
    }
    if (this.spinButton.isStopMode || !this.spinButton.enabled) {
      this.hud.setStatus('Place your bets');
      this.spinButton.setStopMode(false);
      this.spinButton.enabled = true;
      this.updateBetButtonStates();
    }
  }

  private startWinCycle(result: SpinResult): void {
    const { winAllDelay, winLineInterval } = spinConfig;
    let lineIndex = 0;
    const showNextLine = () => {
      const win = result.wins[lineIndex];
      this.reelController.showWinLine(win, winLineInterval);
      const amount = win.multiplier * this.lineBet;
      this.hud.setLineInfo(`Line ${win.paylineIndex + 1} pays ${amount}`);
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
