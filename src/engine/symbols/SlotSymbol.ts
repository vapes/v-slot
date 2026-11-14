import { Container, Graphics } from 'pixi.js';
import type { SymbolView } from '../contracts';

/**
 * One reel cell. The game-provided SymbolView draws the art; this class adds
 * the win pulse (inner `content` container, isolated from spin positioning)
 * and the gold win frame.
 */
export class SlotSymbol extends Container {
  private content: Container;
  private winBorder: Graphics;
  private _symbolId: string;
  private _winAnimating = false;
  private _winElapsedMs = 0;
  private _winCycleMs = 1500;

  constructor(private view: SymbolView, symbolId: string, private w: number, private h: number) {
    super();
    this._symbolId = symbolId;
    this.content = new Container();
    this.addChild(this.content);
    this.content.addChild(view.display);
    this.winBorder = new Graphics();
    this.content.addChild(this.winBorder);
  }

  get symbolId(): string {
    return this._symbolId;
  }

  /** Update symbol identity (used for recycling). */
  setSymbol(id: string): void {
    if (id !== this._symbolId) {
      this._symbolId = id;
      this.view.setSymbol(id);
    }
    this.stopWinAnimation();
  }

  /** Pulse once per cycleMs with a gold frame. */
  startWinAnimation(cycleMs = 1500): void {
    this._winAnimating = true;
    this._winElapsedMs = 0;
    this._winCycleMs = cycleMs;
    this.content.pivot.set(this.w / 2, this.h / 2);
    this.content.position.set(this.w / 2, this.h / 2);
    this.drawFrame();
  }

  /** Static gold frame for turbo win highlight. */
  showTurboHighlight(): void {
    this.drawFrame();
  }

  private drawFrame(): void {
    this.winBorder.clear();
    this.winBorder.lineStyle(6, 0xFF8A00, 0.35);
    this.winBorder.drawRoundedRect(1, 1, this.w - 2, this.h - 2, 8);
    this.winBorder.lineStyle(3, 0xFFD54A, 1);
    this.winBorder.drawRoundedRect(2, 2, this.w - 4, this.h - 4, 8);
  }

  stopWinAnimation(): void {
    this._winAnimating = false;
    this._winElapsedMs = 0;
    this.winBorder.clear();
    this.content.scale.set(1);
    this.content.pivot.set(0, 0);
    this.content.position.set(0, 0);
    this.alpha = 1;
  }

  /** dt is Pixi ticker delta (1 = 60fps frame). */
  updateWinAnimation(dt: number): void {
    if (!this._winAnimating) return;
    this._winElapsedMs += dt * (1000 / 60);
    const phase = (this._winElapsedMs / this._winCycleMs) * Math.PI * 2;
    this.content.scale.set(1 + Math.sin(phase) * 0.08);
  }
}
