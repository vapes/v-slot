import { Container, Graphics, Text, TextStyle } from 'pixi.js';

const SIZE = 70;
const RADIUS = SIZE / 2;

export class BetButton {
  readonly container: Container;
  private bg: Graphics;
  private _enabled = true;
  private onClickCallback: (() => void) | null = null;

  constructor(label: string) {
    this.container = new Container();
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';

    this.bg = new Graphics();
    this.container.addChild(this.bg);

    const text = new Text(label, new TextStyle({
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 32,
      fontWeight: 'bold',
      fill: 0xFFFFFF,
    }));
    text.anchor.set(0.5);
    text.x = RADIUS;
    text.y = RADIUS;
    this.container.addChild(text);

    this.draw(false);

    this.container.on('pointerdown', this.onPress, this);
    this.container.on('pointerover', () => { if (this._enabled) this.draw(true); });
    this.container.on('pointerout', () => this.draw(false));
  }

  set enabled(value: boolean) {
    this._enabled = value;
    this.container.cursor = value ? 'pointer' : 'default';
    this.container.alpha = value ? 1 : 0.4;
    this.draw(false);
  }

  get enabled(): boolean {
    return this._enabled;
  }

  onClick(callback: () => void): void {
    this.onClickCallback = callback;
  }

  private draw(hover: boolean): void {
    this.bg.clear();
    this.bg.beginFill(hover ? 0x5B8DEF : 0x3A6FD8);
    this.bg.drawCircle(RADIUS, RADIUS, RADIUS);
    this.bg.endFill();
  }

  private onPress(): void {
    if (!this._enabled) return;
    this.onClickCallback?.();
  }
}
