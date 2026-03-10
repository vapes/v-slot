import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, REEL_AREA_HEIGHT, REEL_OFFSET_Y } from '../core/Config';

export const BUTTON_SIZE = 100;

export class SpinButton {
  readonly container: Container;
  private bg: Graphics;
  private label: Text;
  private _enabled = true;
  private _isStopMode = false;

  constructor() {
    this.container = new Container();
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';

    this.bg = new Graphics();
    this.container.addChild(this.bg);

    this.label = new Text('SPIN', new TextStyle({
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 28,
      fontWeight: 'bold',
      fill: 0xFFFFFF,
    }));
    this.label.anchor.set(0.5);
    this.label.x = BUTTON_SIZE / 2;
    this.label.y = BUTTON_SIZE / 2;
    this.container.addChild(this.label);

    this.draw();
    this.positionButton();

    this.container.on('pointerover', this.onOver, this);
    this.container.on('pointerout', this.onOut, this);
  }

  set enabled(value: boolean) {
    this._enabled = value;
    this.container.cursor = value ? 'pointer' : 'default';
    this.container.alpha = value ? 1 : 0.5;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  get isStopMode(): boolean {
    return this._isStopMode;
  }

  setStopMode(stop: boolean): void {
    this._isStopMode = stop;
    this._enabled = true;
    this.container.cursor = 'pointer';
    this.container.alpha = 1;
    this.draw();
  }

  /** @deprecated kept for compatibility */
  onSpin(_cb: () => void): void { /* no-op */ }

  private draw(): void {
    this.bg.clear();
    if (this._isStopMode) {
      this.bg.beginFill(0xE53935, 1);
      this.bg.drawCircle(BUTTON_SIZE / 2, BUTTON_SIZE / 2, BUTTON_SIZE / 2);
      this.bg.endFill();
      // Stop icon: white rounded rectangle
      const iconSize = 30;
      const iconX = (BUTTON_SIZE - iconSize) / 2;
      const iconY = (BUTTON_SIZE - iconSize) / 2;
      this.bg.beginFill(0xFFFFFF, 1);
      this.bg.drawRoundedRect(iconX, iconY, iconSize, iconSize, 6);
      this.bg.endFill();
      this.label.visible = false;
    } else {
      this.bg.beginFill(0x4CAF50, 1);
      this.bg.drawCircle(BUTTON_SIZE / 2, BUTTON_SIZE / 2, BUTTON_SIZE / 2);
      this.bg.endFill();
      this.label.visible = true;
    }
  }

  positionButton(): void {
    const reelBottom = REEL_OFFSET_Y + REEL_AREA_HEIGHT;
    const centerY = (reelBottom + GAME_HEIGHT) / 2;
    this.container.x = (GAME_WIDTH - BUTTON_SIZE) / 2;
    this.container.y = centerY - BUTTON_SIZE / 2;
  }

  private onOver(): void {
    if (!this._enabled) return;
    this.bg.clear();
    if (this._isStopMode) {
      this.bg.beginFill(0xEF5350, 1);
      this.bg.drawCircle(BUTTON_SIZE / 2, BUTTON_SIZE / 2, BUTTON_SIZE / 2);
      this.bg.endFill();
      const iconSize = 30;
      const iconX = (BUTTON_SIZE - iconSize) / 2;
      const iconY = (BUTTON_SIZE - iconSize) / 2;
      this.bg.beginFill(0xFFFFFF, 1);
      this.bg.drawRoundedRect(iconX, iconY, iconSize, iconSize, 6);
      this.bg.endFill();
    } else {
      this.bg.beginFill(0x66BB6A, 1);
      this.bg.drawCircle(BUTTON_SIZE / 2, BUTTON_SIZE / 2, BUTTON_SIZE / 2);
      this.bg.endFill();
    }
  }

  private onOut(): void {
    this.draw();
  }
}
