import { Circle, Container } from 'pixi.js';
import { SKIN_SCALE, uiAnchor } from '../core/Config';
import { SpinButton } from './SpinButton';
import { SpriteButton } from './SpriteButton';
import { InfoButton } from './PaytableScreen';
import type { UiSpriteName } from '../core/SkinAssets';

export interface ControlCallbacks {
  onMenu(): void;
  onCoins(): void;
  onAuto(): void;
  onTurbo(): void;
  onTrophy(): void;
}

/** All skin buttons, placed exactly over their spots in the sliced background. */
export class ControlPanel {
  readonly spinButton = new SpinButton();
  readonly betDecrBtn = ControlPanel.make('minus');
  readonly betIncrBtn = ControlPanel.make('plus');
  readonly coinsBtn = ControlPanel.make('coins');
  readonly autoBtn = ControlPanel.make('auto');
  readonly turboBtn = ControlPanel.make('turbo');
  readonly trophyBtn = ControlPanel.make('trophy');
  readonly infoBtn: InfoButton;
  private readonly fullscreenZone: Container;

  constructor(cb: ControlCallbacks) {
    this.infoBtn = new InfoButton(cb.onMenu);
    this.coinsBtn.onClick(cb.onCoins);
    this.autoBtn.onClick(cb.onAuto);
    this.turboBtn.onClick(cb.onTurbo);
    this.trophyBtn.onClick(cb.onTrophy);

    // The fullscreen icon is baked into the background; this is its hit zone.
    this.fullscreenZone = new Container();
    this.fullscreenZone.eventMode = 'static';
    this.fullscreenZone.cursor = 'pointer';
    this.fullscreenZone.hitArea = new Circle(0, 0, 40 * SKIN_SCALE);
    this.fullscreenZone.position.set(912 * SKIN_SCALE, 58 * SKIN_SCALE);
    this.fullscreenZone.on('pointertap', ControlPanel.toggleFullscreen);
  }

  private static make(name: UiSpriteName): SpriteButton {
    const a = uiAnchor(name);
    const btn = new SpriteButton(name, a.r);
    btn.setPosition(a.x, a.y);
    return btn;
  }

  private static toggleFullscreen(): void {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => undefined);
    } else {
      document.documentElement.requestFullscreen?.().catch(() => undefined);
    }
  }

  private get buttons(): SpriteButton[] {
    return [
      this.spinButton, this.betDecrBtn, this.betIncrBtn, this.coinsBtn,
      this.autoBtn, this.turboBtn, this.trophyBtn, this.infoBtn,
    ];
  }

  addToStage(stage: Container): void {
    for (const b of this.buttons) stage.addChild(b.container);
    stage.addChild(this.fullscreenZone);
  }

  update(dt: number): void {
    for (const b of this.buttons) b.update(dt);
  }
}
