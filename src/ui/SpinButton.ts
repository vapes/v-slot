import { Graphics } from 'pixi.js';
import { uiAnchor } from '../core/Config';
import { SpriteButton } from './SpriteButton';

const anchor = uiAnchor('spin');

/**
 * Big dragon-wing spin button. In stop mode a dark disc with a gold
 * "stop" square covers the arrow. Input is handled by GameInput (hit test).
 */
export class SpinButton extends SpriteButton {
  private stopOverlay: Graphics;
  private _isStopMode = false;
  private spinAngle = 0;

  constructor() {
    super('spin', anchor.r);
    this.setPosition(anchor.x, anchor.y);
    // GameInput drives this button from window pointer events (turbo hold detection)
    this.container.eventMode = 'none';

    this.stopOverlay = new Graphics();
    const r = anchor.r * 0.8;
    this.stopOverlay.beginFill(0x1A0B05, 0.92);
    this.stopOverlay.drawCircle(0, 0, r);
    this.stopOverlay.endFill();
    this.stopOverlay.lineStyle(3, 0xFFC94A, 0.9);
    this.stopOverlay.drawCircle(0, 0, r);
    const s = r * 0.62;
    this.stopOverlay.lineStyle(0);
    this.stopOverlay.beginFill(0xFFC94A, 1);
    this.stopOverlay.drawRoundedRect(-s / 2, -s / 2, s, s, 6);
    this.stopOverlay.endFill();
    this.stopOverlay.visible = false;
    this.container.addChild(this.stopOverlay);
  }

  get centerX(): number { return this.container.x; }
  get centerY(): number { return this.container.y; }

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
