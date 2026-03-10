import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, REEL_AREA_HEIGHT, REEL_OFFSET_Y } from '../core/Config';

export const BUTTON_SIZE = 100;

export class SpinButton {
  readonly container: Container;
  private bg: Graphics;
  private label: Text;
  private _enabled = true;

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

  /** @deprecated kept for compatibility */
  onSpin(_cb: () => void): void { /* no-op */ }

  private draw(): void {
    this.bg.clear();
    this.bg.beginFill(0x4CAF50, 1);
    this.bg.drawCircle(BUTTON_SIZE / 2, BUTTON_SIZE / 2, BUTTON_SIZE / 2);
    this.bg.endFill();
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
    this.bg.beginFill(0x66BB6A, 1);
    this.bg.drawCircle(BUTTON_SIZE / 2, BUTTON_SIZE / 2, BUTTON_SIZE / 2);
    this.bg.endFill();
  }

  private onOut(): void {
    this.draw();
  }
}
