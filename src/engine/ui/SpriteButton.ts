import { Circle, Container, Graphics, Sprite, type Texture } from 'pixi.js';

const DISABLED_TINT = 0x6A6A6A;

/**
 * Round button made from a sprite sliced out of a skin mockup.
 * Positioned by its centre. Supports enabled/disabled (tint) and a toggled
 * "active" state rendered as a pulsing glow ring.
 */
export class SpriteButton {
  readonly container: Container;
  protected readonly sprite: Sprite;
  private glow: Graphics;
  private _enabled = true;
  private _active = false;
  private glowPhase = 0;
  private onClickCallback: (() => void) | null = null;

  /** `scale` maps texture pixels to game pixels (skin source → canvas). */
  constructor(texture: Texture, readonly radius: number, private readonly scale = 1) {
    this.container = new Container();
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';
    this.container.hitArea = new Circle(0, 0, radius);

    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5);
    this.sprite.scale.set(this.scale);
    this.container.addChild(this.sprite);

    this.glow = new Graphics();
    this.glow.visible = false;
    this.container.addChild(this.glow);

    this.container.on('pointerdown', () => {
      if (!this._enabled) return;
      this.sprite.scale.set(this.scale * 0.94);
      this.onClickCallback?.();
    });
    const release = () => this.sprite.scale.set(this.scale);
    this.container.on('pointerup', release);
    this.container.on('pointerupoutside', release);
    this.container.on('pointerout', release);
  }

  setPosition(x: number, y: number): void {
    this.container.position.set(x, y);
  }

  set enabled(value: boolean) {
    this._enabled = value;
    this.container.cursor = value ? 'pointer' : 'default';
    this.sprite.tint = value ? 0xFFFFFF : DISABLED_TINT;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  set active(value: boolean) {
    this._active = value;
    this.glow.visible = value;
    this.glowPhase = 0;
  }

  get active(): boolean {
    return this._active;
  }

  onClick(callback: () => void): void {
    this.onClickCallback = callback;
  }

  /** Animate the active glow. dt is Pixi ticker delta. */
  update(dt: number): void {
    if (!this._active) return;
    this.glowPhase += dt * 0.08;
    const a = 0.55 + Math.sin(this.glowPhase) * 0.35;
    this.glow.clear();
    this.glow.lineStyle(8, 0xFF9800, a * 0.45);
    this.glow.drawCircle(0, 0, this.radius + 3);
    this.glow.lineStyle(3, 0xFFE082, a);
    this.glow.drawCircle(0, 0, this.radius);
  }
}
