import { Graphics, type Texture } from 'pixi.js';
import type { SpinControl } from '../contracts';
import { SpriteButton } from './SpriteButton';

export interface SpinButtonStyle {
  /** Disc that covers the button face in stop mode. */
  discColor: number;
  /** Ring + stop square colour. */
  accent: number;
  /** Disc radius as a fraction of the hit radius. */
  discScale?: number;
}

/**
 * Sprite spin button. In stop mode a disc with a "stop" square covers the
 * face. Input comes from GameInput through hitTest (not Pixi events), so
 * hold-to-turbo works.
 */
export class SpriteSpinButton extends SpriteButton implements SpinControl {
  private stopOverlay: Graphics;
  private _isStopMode = false;
  private spinAngle = 0;

  constructor(texture: Texture, x: number, y: number, radius: number, scale: number, style: SpinButtonStyle) {
    super(texture, radius, scale);
    this.setPosition(x, y);
    // GameInput drives this button from window pointer events (turbo hold detection)
    this.container.eventMode = 'none';

    this.stopOverlay = new Graphics();
    const r = radius * (style.discScale ?? 0.8);
    this.stopOverlay.beginFill(style.discColor, 0.92);
    this.stopOverlay.drawCircle(0, 0, r);
    this.stopOverlay.endFill();
    this.stopOverlay.lineStyle(3, style.accent, 0.9);
    this.stopOverlay.drawCircle(0, 0, r);
    const s = r * 0.62;
    this.stopOverlay.lineStyle(0);
    this.stopOverlay.beginFill(style.accent, 1);
    this.stopOverlay.drawRoundedRect(-s / 2, -s / 2, s, s, 6);
    this.stopOverlay.endFill();
    this.stopOverlay.visible = false;
    this.container.addChild(this.stopOverlay);
  }

  hitTest(x: number, y: number): boolean {
    return (x - this.container.x) ** 2 + (y - this.container.y) ** 2 <= this.radius ** 2;
  }

  get isStopMode(): boolean {
    return this._isStopMode;
  }

  setStopMode(stop: boolean): void {
    this._isStopMode = stop;
    this.enabled = true;
    this.stopOverlay.visible = stop;
    if (!stop) this.sprite.rotation = 0;
  }

  /** Small wobble while the reels spin. */
  override update(dt: number): void {
    super.update(dt);
    if (!this._isStopMode) return;
    this.spinAngle += dt * 0.25;
    this.sprite.rotation = Math.sin(this.spinAngle) * 0.03;
  }
}
