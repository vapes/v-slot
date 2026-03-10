import { Application, Text, TextStyle, Graphics, Container } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, BET_OPTIONS, REEL_OFFSET_Y, REEL_AREA_HEIGHT } from './Config';
import spinConfig from './spinConfig.json';
import { ReelController } from '../reels/ReelController';
import { SlotMath, type SpinResult } from '../math/SlotMath';
import { PrecomputedTable } from '../math/PrecomputedTable';
import { SpinButton, BUTTON_SIZE } from '../ui/SpinButton';
import { BetButton } from '../ui/BetButton';
import { WinCelebration, getWinCategory } from '../ui/WinCelebration';
import { PaytableScreen } from '../ui/PaytableScreen';

export class Game {
  private app: Application;
  private reelController: ReelController;
  private slotMath: SlotMath;
  private spinButton: SpinButton;
  private statusText: Text;
  private winLabelText: Text;
  private winValueText: Text;
  private statsRow: Container;
  private balanceLabel: Text;
  private balanceValue: Text;
  private betLabel: Text;
  private betValue: Text;

  private betDecrBtn: BetButton;
  private betIncrBtn: BetButton;
  private lineInfoText: Text;
  private winCycleTimer: ReturnType<typeof setTimeout> | null = null;
  private winCelebration: WinCelebration;
  private paytableScreen: PaytableScreen;
  private infoBtn: HTMLButtonElement;

  private balance = 10000;
  private betIndex = 0;       // index into BET_OPTIONS
  private get lineBet(): number { return BET_OPTIONS[this.betIndex]; }
  private readonly numLines = 20;
  private get totalBet(): number { return this.lineBet * this.numLines; }
  private currentResult: SpinResult | null = null;

  // True while the spin button (or spacebar) is physically held down
  private buttonHeld = false;
  // True while turbo auto-repeat chain is active
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
    this.infoBtn = this.createInfoButton();

    // Status text — sits between reels and spin button
    this.statusText = new Text('', new TextStyle({
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 28,
      fontWeight: 'bold',
      fill: 0xFFFFFF,
    }));
    this.statusText.anchor.set(0.5, 0.5);
    this.statusText.x = GAME_WIDTH / 2;
    this.statusText.y = REEL_OFFSET_Y + REEL_AREA_HEIGHT + 50;

    const statusY = REEL_OFFSET_Y + REEL_AREA_HEIGHT + 50;
    const winStyle = new TextStyle({ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 28, fontWeight: 'bold', fill: 0xFFD700 });
    const winValStyle = new TextStyle({ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 28, fontWeight: 'bold', fill: 0xFFFFFF });
    this.winLabelText = new Text('WIN:', winStyle);
    this.winLabelText.anchor.set(0, 0.5);
    this.winLabelText.y = statusY;
    this.winValueText = new Text('', winValStyle);
    this.winValueText.anchor.set(0, 0.5);
    this.winValueText.y = statusY;

    this.lineInfoText = new Text('', new TextStyle({
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 20,
      fill: 0xFFFFFF,
    }));
    this.lineInfoText.anchor.set(0.5, 0);
    this.lineInfoText.x = GAME_WIDTH / 2;
    this.lineInfoText.y = statusY + 22;
    this.lineInfoText.visible = false;

    // Stats row: Balance label + value | Bet label + value — one centered line
    const labelStyle = new TextStyle({ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 20, fill: 0xFFD700 });
    const valueStyle = new TextStyle({ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 20, fill: 0xFFFFFF });

    this.balanceLabel = new Text('Balance:', labelStyle);
    this.balanceValue = new Text('', valueStyle);
    this.betLabel = new Text('Bet:', labelStyle);
    this.betValue = new Text('', valueStyle);

    this.statsRow = new Container();
    this.statsRow.addChild(this.balanceLabel, this.balanceValue, this.betLabel, this.betValue);
    this.statsRow.y = GAME_HEIGHT - 60;

    this.updateBalanceDisplay();
    this.setStatus('Place your bets');
  }

  private createInfoButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = 'i';
    btn.className = 'pt-info-btn';
    btn.addEventListener('click', () => this.paytableScreen.toggle());
    document.body.appendChild(btn);
    return btn;
  }

  /** Initialize and start the game. */
  async init(): Promise<void> {
    document.body.appendChild(this.app.view as HTMLCanvasElement);
    this.setupStage();
    this.setupInput();
    this.setupTicker();
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    // Log theoretical RTP from reel strips
    const { rtp, breakdown } = SlotMath.calculateRTP();
    console.log(`Theoretical RTP (reel strips): ${(rtp * 100).toFixed(2)}%`);
    for (const [sym, contrib] of Object.entries(breakdown)) {
      console.log(`  ${sym}: ${(contrib * 100).toFixed(4)}%`);
    }

    // Load precomputed screen table (non-blocking; falls back to live math if unavailable)
    const table = new PrecomputedTable();
    table.load(import.meta.env.BASE_URL + 'screens.bin')
      .then(() => { this.slotMath.setTable(table); })
      .catch((err: Error) => {
        console.warn('[Game] Precomputed table unavailable, using live math:', err.message);
      });
  }

  private setupStage(): void {
    this.positionBetButtons();
    this.app.stage.addChild(this.reelController.container);
    this.app.stage.addChild(this.spinButton.container);
    this.app.stage.addChild(this.betDecrBtn.container);
    this.app.stage.addChild(this.betIncrBtn.container);
    this.app.stage.addChild(this.statusText);
    this.app.stage.addChild(this.winLabelText);
    this.app.stage.addChild(this.winValueText);
    this.app.stage.addChild(this.lineInfoText);
    this.app.stage.addChild(this.statsRow);
    this.app.stage.addChild(this.winCelebration.container);
  }

  private positionBetButtons(): void {
    // Spin button: x=[220..320], center y = spinButton.container.y + 50
    // Bet buttons size = 70, radius = 35; gap = 25 from spin button edges
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

  private setupInput(): void {
    // Use raw window pointer events so PixiJS internals can't interfere with hold tracking.
    window.addEventListener('pointerdown', (e) => {
      if (this.isOnSpinButton(e) && this.spinButton.enabled) {
        console.log('spin button down');
        this.buttonHeld = true;
        this.doSpin(false);
      }
    });
    window.addEventListener('pointerup', () => {
      if (this.buttonHeld) console.log('spin button up');
      this.buttonHeld = false;
    });
    window.addEventListener('pointercancel', () => {
      if (this.buttonHeld) console.log('spin button up');
      this.buttonHeld = false;
    });

    this.betDecrBtn.onClick(() => {
      if (this.betIndex > 0) {
        this.betIndex--;
        this.updateBalanceDisplay();
        this.updateBetButtonStates();
      }
    });

    this.betIncrBtn.onClick(() => {
      if (this.betIndex < BET_OPTIONS.length - 1) {
        this.betIndex++;
        this.updateBalanceDisplay();
        this.updateBetButtonStates();
      }
    });

    // Spacebar: same hold behaviour
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        console.log('spin button down');
        this.buttonHeld = true;
        if (this.spinButton.enabled) this.doSpin(false);
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        console.log('spin button up');
        this.buttonHeld = false;
      }
    });
  }

  /** Returns true if the pointer event lands inside the spin button circle. */
  private isOnSpinButton(e: PointerEvent): boolean {
    const canvas = this.app.view as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const cssScale = rect.width / GAME_WIDTH;
    const gameX = (e.clientX - rect.left) / cssScale;
    const gameY = (e.clientY - rect.top) / cssScale;
    const cx = this.spinButton.container.x + BUTTON_SIZE / 2;
    const cy = this.spinButton.container.y + BUTTON_SIZE / 2;
    const r = BUTTON_SIZE / 2;
    return (gameX - cx) ** 2 + (gameY - cy) ** 2 <= r * r;
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

  private doSpin(turbo: boolean): void {
    if (this.reelController.isSpinning) return;
    if (this.balance < this.totalBet) return;

    this.stopWinCycle();
    this.winCelebration.stop();

    this.balance -= this.totalBet;
    this.updateBalanceDisplay();
    this.setStatus('Good luck!');

    this.currentResult = this.slotMath.spin();

    this.spinButton.enabled = false;
    this.betDecrBtn.enabled = false;
    this.betIncrBtn.enabled = false;

    if (turbo) {
      if (!this.inTurboMode) {
        console.log('turbo mode started');
        this.inTurboMode = true;
      }
      console.log('spin turbo');
      this.reelController.startTurboSpin(this.currentResult, () => this.onSpinComplete());
    } else {
      console.log('spin normal');
      this.reelController.startSpin(this.currentResult, () => this.onSpinComplete());
    }
  }

  private onSpinComplete(): void {
    if (!this.currentResult) return;
    const result = this.currentResult;
    // If button is still held when spin lands → turbo win display + auto-repeat
    const turbo = this.buttonHeld;

    if (result.totalWin > 0) {
      const winAmount = result.totalWin * this.lineBet;
      this.balance += winAmount;
      this.setWinStatus(winAmount);

      if (turbo) {
        this.reelController.showWinsTurbo(result);
        const category = getWinCategory(winAmount, this.totalBet);
        if (category) this.winCelebration.playStatic(category, 500);
        setTimeout(() => {
          this.reelController.clearWins();
          this.updateBalanceDisplay();
          this.afterTurboRound();
        }, 300);
      } else {
        this.reelController.showWins(result, spinConfig.winAllDelay);
        this.startWinCycle(result);
        const category = getWinCategory(winAmount, this.totalBet);
        if (category) this.winCelebration.play(category);
        this.updateBalanceDisplay();
        this.spinButton.enabled = true;
        this.updateBetButtonStates();
      }
    } else {
      this.updateBalanceDisplay();
      if (turbo) {
        this.afterTurboRound();
      } else {
        this.setStatus('Place your bets');
        this.spinButton.enabled = true;
        this.updateBetButtonStates();
      }
    }
  }

  /** Called after turbo win display ends. Restarts if button still held. */
  private afterTurboRound(): void {
    if (this.buttonHeld && this.balance >= this.totalBet) {
      this.doSpin(true);
    } else {
      console.log('turbo mode finished');
      this.inTurboMode = false;
      this.setStatus('Place your bets');
      this.spinButton.enabled = true;
      this.updateBetButtonStates();
    }
  }

  private setStatus(msg: string): void {
    this.statusText.text = msg;
    this.winLabelText.visible = false;
    this.winValueText.visible = false;
    this.lineInfoText.visible = false;
    this.statusText.visible = true;
  }

  private setWinStatus(amount: number): void {
    this.statusText.visible = false;
    this.winLabelText.text = 'WIN:';
    this.winValueText.text = ` ${amount}`;
    // position inline, centered
    const totalW = this.winLabelText.width + this.winValueText.width;
    this.winLabelText.x = (GAME_WIDTH - totalW) / 2;
    this.winValueText.x = this.winLabelText.x + this.winLabelText.width;
    this.winLabelText.visible = true;
    this.winValueText.visible = true;
  }

  private startWinCycle(result: SpinResult): void {
    const { winAllDelay, winLineInterval } = spinConfig;
    let lineIndex = 0;
    const showNextLine = () => {
      const win = result.wins[lineIndex];
      this.reelController.showWinLine(win, winLineInterval);
      const amount = win.multiplier * this.lineBet;
      this.lineInfoText.text = `Line ${win.paylineIndex + 1} pays ${amount}`;
      this.lineInfoText.visible = true;
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
    this.lineInfoText.visible = false;
  }

  private updateBalanceDisplay(): void {
    this.balanceValue.text = ` ${this.balance}`;
    this.betValue.text = ` ${this.totalBet}`;

    const gap = 24;
    const balW = this.balanceLabel.width + this.balanceValue.width;
    const betW = this.betLabel.width + this.betValue.width;
    const totalW = balW + gap + betW;
    let x = (GAME_WIDTH - totalW) / 2;

    this.balanceLabel.x = x;
    x += this.balanceLabel.width;
    this.balanceValue.x = x;
    x += this.balanceValue.width + gap;
    this.betLabel.x = x;
    x += this.betLabel.width;
    this.betValue.x = x;
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
