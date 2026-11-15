import { Circle, Container, Graphics, Sprite, type Text, type Texture } from 'pixi.js';
import { fitText } from './fitText';

const DISABLED_TINT = 0x6A6A6A;

/**
 * Round button made from a sprite sliced out of a skin mockup.
 * Positioned by its centre. Supports enabled/disabled (tint) and a toggled
 * "active" state rendered as a pulsing glow ring. Captions baked into the art
 * are erased by the slicer and re-added as translated Text via setLabel().
 */
export class SpriteButton {
  readonly container: Container;
  /** Sprite + labels; scaled on press, rotated by subclasses. */
  protected readonly face = new Container();
  protected readonly sprite: Sprite;
  protected label: Text | null = null;
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
    this.face.addChild(this.sprite);
    this.container.addChild(this.face);

    // drawn once; only its alpha pulses (no per-frame geometry rebuild)
    this.glow = new Graphics()
      .circle(0, 0, this.radius + 3).stroke({ width: 8, color: 0xFF9800, alpha: 0.45 })
      .circle(0, 0, this.radius).stroke({ width: 3, color: 0xFFE082 });
    this.glow.visible = false;
    this.container.addChild(this.glow);

    this.container.on('pointerdown', () => {
      if (!this._enabled) return;
      this.face.scale.set(0.94);
      this.onClickCallback?.();
    });
    const release = () => this.face.scale.set(1);
    this.container.on('pointerup', release);
    this.container.on('pointerupoutside', release);
    this.container.on('pointerout', release);
  }

  /** Caption at (dx, dy) from the centre, shrunk to fit maxWidth (game px). */
  setLabel(text: Text, dx: number, dy: number, maxWidth: number): void {
    this.label?.destroy();
    this.label = text;
    text.anchor.set(0.5);
    text.position.set(dx, dy);
    fitText(text, maxWidth);
    text.alpha = this._enabled ? 1 : 0.55;
    this.face.addChild(text);
  }

  setPosition(x: number, y: number): void {
    this.container.position.set(x, y);
  }

  set enabled(value: boolean) {
    this._enabled = value;
    this.container.cursor = value ? 'pointer' : 'default';
    this.sprite.tint = value ? 0xFFFFFF : DISABLED_TINT;
    if (this.label) this.label.alpha = value ? 1 : 0.55;
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
    this.glow.alpha = 0.55 + Math.sin(this.glowPhase) * 0.35;
  }
}
