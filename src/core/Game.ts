import { Application, Text, TextStyle, Graphics } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT } from './Config';
import { ReelController } from '../reels/ReelController';
import { SlotMath, type SpinResult } from '../math/SlotMath';
import { SpinButton } from '../ui/SpinButton';

export class Game {
  private app: Application;
  private reelController: ReelController;
  private slotMath: SlotMath;
  private spinButton: SpinButton;
  private winText: Text;
  private balanceText: Text;
  private betText: Text;

  private balance = 10000;
  private lineBet = 1;        // bet per payline
  private readonly numLines = 20;
  private get totalBet(): number { return this.lineBet * this.numLines; }
  private currentResult: SpinResult | null = null;

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

    // Win text
    this.winText = new Text('', new TextStyle({
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 32,
      fontWeight: 'bold',
      fill: 0xFFD700,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowDistance: 2,
    }));
    this.winText.anchor.set(0.5, 0);
    this.winText.x = GAME_WIDTH / 2;
    this.winText.y = 50;

    // Balance text
    this.balanceText = new Text('', new TextStyle({
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 20,
      fill: 0xCCCCCC,
    }));
    this.balanceText.anchor.set(0.5, 0);
    this.balanceText.x = GAME_WIDTH / 2;
    this.balanceText.y = GAME_HEIGHT - 100;

    // Bet text
    this.betText = new Text('', new TextStyle({
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 20,
      fill: 0xCCCCCC,
    }));
    this.betText.anchor.set(0.5, 0);
    this.betText.x = GAME_WIDTH / 2;
    this.betText.y = GAME_HEIGHT - 70;

    this.updateBalanceDisplay();
  }

  /** Initialize and start the game. */
  async init(): Promise<void> {
    document.body.appendChild(this.app.view as HTMLCanvasElement);
    this.setupStage();
    this.setupInput();
    this.setupTicker();
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    // Log RTP on init
    const { rtp, breakdown } = SlotMath.calculateRTP();
    console.log(`Theoretical RTP: ${(rtp * 100).toFixed(2)}%`);
    for (const [sym, contrib] of Object.entries(breakdown)) {
      console.log(`  ${sym}: ${(contrib * 100).toFixed(4)}%`);
    }
  }

  private setupStage(): void {
    this.app.stage.addChild(this.reelController.container);
    this.app.stage.addChild(this.spinButton.container);
    this.app.stage.addChild(this.winText);
    this.app.stage.addChild(this.balanceText);
    this.app.stage.addChild(this.betText);
  }

  private setupInput(): void {
    this.spinButton.onSpin(() => this.doSpin());

    // Spacebar to spin
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && this.spinButton.enabled) {
        e.preventDefault();
        this.doSpin();
      }
    });
  }

  private setupTicker(): void {
    this.app.ticker.add((dt) => {
      this.reelController.update(dt);
    });
  }

  private doSpin(): void {
    if (this.reelController.isSpinning) return;
    if (this.balance < this.totalBet) return;

    // Deduct bet
    this.balance -= this.totalBet;
    this.updateBalanceDisplay();
    this.winText.text = '';

    // Generate result
    this.currentResult = this.slotMath.spin();

    // Disable button
    this.spinButton.enabled = false;

    // Start reels
    this.reelController.startSpin(this.currentResult, () => {
      this.onSpinComplete();
    });
  }

  private onSpinComplete(): void {
    if (!this.currentResult) return;

    const result = this.currentResult;

    if (result.totalWin > 0) {
      // totalWin is sum of paytable multipliers; each is × lineBet
      const winAmount = result.totalWin * this.lineBet;
      this.balance += winAmount;
      this.winText.text = `WIN: ${winAmount}`;
      this.reelController.showWins(result);
    }

    this.updateBalanceDisplay();
    this.spinButton.enabled = true;
  }

  private updateBalanceDisplay(): void {
    this.balanceText.text = `Balance: ${this.balance}`;
    this.betText.text = `Bet: ${this.totalBet} (${this.lineBet}×${this.numLines})`;
  }

  /** Responsive scaling to fit the viewport. */
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
