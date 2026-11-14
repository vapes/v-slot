import { Container, Graphics, Sprite } from 'pixi.js';
import { SYMBOL_WIDTH, SYMBOL_HEIGHT, type SymbolId } from '../core/Config';
import { symbolTexture } from '../core/SkinAssets';

export class SlotSymbol extends Container {
  private content: Container;
  private sprite: Sprite;
  private winBorder: Graphics;
  private _symbolId: SymbolId;
  private _winAnimating = false;
  private _winElapsedMs = 0;
  private _winCycleMs = 1500;

  constructor(symbolId: SymbolId) {
    super();
    this._symbolId = symbolId;

    this.content = new Container();
    this.addChild(this.content);

    this.sprite = new Sprite(symbolTexture(symbolId));
    this.sprite.width = SYMBOL_WIDTH;
    this.sprite.height = SYMBOL_HEIGHT;
    this.content.addChild(this.sprite);

    this.winBorder = new Graphics();
    this.content.addChild(this.winBorder);
  }

  get symbolId(): SymbolId {
    return this._symbolId;
  }

  /** Update symbol identity (used for recycling). */
  setSymbol(id: SymbolId): void {
    if (id !== this._symbolId) {
      this._symbolId = id;
      this.sprite.texture = symbolTexture(id);
      this.sprite.width = SYMBOL_WIDTH;
      this.sprite.height = SYMBOL_HEIGHT;
    }
    this.stopWinAnimation();
  }

  /** Start pulsating win animation with a glowing gold frame. One pulse = cycleMs. */
  startWinAnimation(cycleMs = 1500): void {
    this._winAnimating = true;
    this._winElapsedMs = 0;
    this._winCycleMs = cycleMs;
    this.content.pivot.set(SYMBOL_WIDTH / 2, SYMBOL_HEIGHT / 2);
    this.content.position.set(SYMBOL_WIDTH / 2, SYMBOL_HEIGHT / 2);
    this.drawFrame();
  }

  /** Show a static gold frame for turbo win highlight. */
  showTurboHighlight(): void {
    this.drawFrame();
  }

  private drawFrame(): void {
    this.winBorder.clear();
    this.winBorder.lineStyle(6, 0xFF8A00, 0.35);
    this.winBorder.drawRoundedRect(1, 1, SYMBOL_WIDTH - 2, SYMBOL_HEIGHT - 2, 8);
    this.winBorder.lineStyle(3, 0xFFD54A, 1);
    this.winBorder.drawRoundedRect(2, 2, SYMBOL_WIDTH - 4, SYMBOL_HEIGHT - 4, 8);
  }

  /** Stop win animation and reset. */
  stopWinAnimation(): void {
    this._winAnimating = false;
    this._winElapsedMs = 0;
    this.winBorder.clear();
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
    this.content.scale.set(1 + Math.sin(phase) * 0.08);
  }
}
