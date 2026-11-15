import { Sprite, type Container } from 'pixi.js';
import {
  SpriteButton, SpriteSpinButton, type BetControlsState, type GameActions, type GameView,
} from '@/engine';
import { config, SKIN_SCALE, uiAnchor, type UiAnchorName, skin } from '../config';
import { backgroundTexture, uiTexture, type UiSpriteName } from '../assets';
import { ClassicHUD, CLASSIC_BUTTON_STYLE, CLASSIC_SPIN_STYLE, classicWinBox } from './ClassicHUD';

/** "777 Casino Classic" skin: background art + every button over its baked spot. */
export class ClassicView implements GameView {
  readonly spinButton = makeSpin();
  readonly hud = new ClassicHUD();
  readonly winBox = classicWinBox();
  private readonly minus = make('minus', 'minus');
  private readonly plus = make('plus', 'plus');
  private readonly auto = make('auto', 'auto');
  private readonly turbo = make('turbo', 'turbo');
  private readonly infoI = make('info_i', 'infoI');

  constructor(actions: GameActions) {
    this.minus.onClick(() => actions.changeBet(-1));
    this.plus.onClick(() => actions.changeBet(1));
    this.auto.onClick(actions.toggleAutoplay);
    this.turbo.onClick(actions.toggleQuickSpin);
    this.infoI.onClick(actions.togglePaytable);
    skin.labelButton(this.spinButton, 'spinLabel', 'button.spin', CLASSIC_SPIN_STYLE);
    skin.labelButton(this.auto, 'autoLabel', 'button.autoSpin', CLASSIC_BUTTON_STYLE);
    skin.labelButton(this.turbo, 'turboLabel', 'button.turbo', CLASSIC_BUTTON_STYLE);
  }

  private get buttons(): SpriteButton[] {
    return [this.spinButton, this.minus, this.plus, this.auto, this.turbo, this.infoI];
  }

  mountBelowReels(stage: Container): void {
    const bg = new Sprite(backgroundTexture());
    bg.width = config.canvas.width;
    bg.height = config.canvas.width * bg.texture.height / bg.texture.width;
    stage.addChild(bg);
  }

  mountAboveReels(stage: Container): void {
    for (const b of this.buttons) stage.addChild(b.container);
    this.hud.addToStage(stage);
  }

  setBetControls({ enabled, canDecrease, canIncrease }: BetControlsState): void {
    this.minus.enabled = enabled && canDecrease;
    this.plus.enabled = enabled && canIncrease;
  }

  setAutoplay(on: boolean): void { this.auto.active = on; }
  setQuickSpin(on: boolean): void { this.turbo.active = on; }

  update(dt: number): void {
    for (const b of this.buttons) b.update(dt);
    this.hud.update(dt);
  }
}

function makeSpin(): SpriteSpinButton {
  const a = uiAnchor('spin');
  return new SpriteSpinButton(uiTexture('spin'), a.x, a.y, a.r, SKIN_SCALE, { discColor: 0x0B3D12, accent: 0xFFFFFF, discScale: 0.72 });
}

function make(texture: UiSpriteName, anchor: UiAnchorName): SpriteButton {
  const a = uiAnchor(anchor);
  const btn = new SpriteButton(uiTexture(texture), a.r, SKIN_SCALE * a.s);
  btn.setPosition(a.x, a.y);
  return btn;
}
