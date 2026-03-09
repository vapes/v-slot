import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { SYMBOL_WIDTH, SYMBOL_HEIGHT, SYMBOL_COLORS, type SymbolId } from '../core/Config';

const TEXT_STYLE = new TextStyle({
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: 48,
  fontWeight: 'bold',
  fill: 0xFFFFFF,
  dropShadow: true,
  dropShadowColor: 0x000000,
  dropShadowDistance: 2,
  dropShadowBlur: 4,
});

export class SlotSymbol extends Container {
  private content: Container;
  private bg: Graphics;
  private label: Text;
  private _symbolId: SymbolId;
  private _winAnimating = false;
  private _winElapsedMs = 0;
  private _winCycleMs = 1500;

  constructor(symbolId: SymbolId) {
    super();
    this._symbolId = symbolId;

    this.content = new Container();
    this.addChild(this.content);

    this.bg = new Graphics();
    this.content.addChild(this.bg);

    this.label = new Text(symbolId, TEXT_STYLE);
    this.label.anchor.set(0.5);
    this.label.x = SYMBOL_WIDTH / 2;
    this.label.y = SYMBOL_HEIGHT / 2;
    this.content.addChild(this.label);

    this.drawSymbol();
  }

  get symbolId(): SymbolId {
    return this._symbolId;
  }

  /** Update symbol identity (used for recycling). */
  setSymbol(id: SymbolId): void {
    this._symbolId = id;
    this.label.text = id;
    this.drawSymbol();
    this.stopWinAnimation();
  }

  private drawSymbol(): void {
    const color = SYMBOL_COLORS[this._symbolId];
    this.bg.clear();
    this.bg.beginFill(color, 0.9);
    this.bg.drawRoundedRect(0, 0, SYMBOL_WIDTH, SYMBOL_HEIGHT, 12);
    this.bg.endFill();

    // Subtle border
    this.bg.lineStyle(2, 0xFFFFFF, 0.15);
    this.bg.drawRoundedRect(0, 0, SYMBOL_WIDTH, SYMBOL_HEIGHT, 12);
  }

  /** Start pulsating win animation. One full pulse cycle = cycleMs. */
  startWinAnimation(cycleMs = 1500): void {
    this._winAnimating = true;
    this._winElapsedMs = 0;
    this._winCycleMs = cycleMs;
    this.content.pivot.set(SYMBOL_WIDTH / 2, SYMBOL_HEIGHT / 2);
    this.content.position.set(SYMBOL_WIDTH / 2, SYMBOL_HEIGHT / 2);
  }

  /** Stop win animation and reset. */
  stopWinAnimation(): void {
    this._winAnimating = false;
    this._winElapsedMs = 0;
    this.content.scale.set(1);
    this.content.pivot.set(0, 0);
    this.content.position.set(0, 0);
    this.alpha = 1;
  }

  /** Called each frame to update win animation. dt is Pixi ticker delta (1 = 60fps frame). */
  updateWinAnimation(dt: number): void {
    if (!this._winAnimating) return;
    this._winElapsedMs += dt * (1000 / 60);
    const phase = (this._winElapsedMs / this._winCycleMs) * Math.PI * 2;
    const s = 1 + Math.sin(phase) * 0.08;
    this.content.scale.set(s);
  }

}
