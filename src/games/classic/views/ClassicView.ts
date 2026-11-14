import { Sprite, type Container } from 'pixi.js';
import {
  SpriteButton, SpriteSpinButton, type BetControlsState, type GameActions, type GameView, type PaytableTheme,
} from '@/engine';
import { config, SKIN_SCALE, uiAnchor, type UiAnchorName } from '../config';
import { backgroundTexture, uiTexture, type UiSpriteName } from '../assets';
import { ClassicHUD } from './ClassicHUD';
import { buildClassicPaytable, CLASSIC_THEME } from './ClassicPaytable';

/** "777 Casino Classic" skin: background art + every button over its baked spot. */
export class ClassicView implements GameView {
  readonly spinButton = makeSpin();
  readonly hud = new ClassicHUD();
  readonly paytableTheme: PaytableTheme = CLASSIC_THEME;
  private readonly minus = make('minus', 'minus');
  private readonly plus = make('plus', 'plus');
  private readonly auto = make('auto', 'auto');
  private readonly info = make('info', 'info');
  private readonly infoI = make('info_i', 'infoI');

  constructor(actions: GameActions) {
    this.minus.onClick(() => actions.changeBet(-1));
    this.plus.onClick(() => actions.changeBet(1));
    this.auto.onClick(actions.toggleAutoplay);
    this.info.onClick(actions.openPaytable);
    this.infoI.onClick(actions.togglePaytable);
  }

  private get buttons(): SpriteButton[] {
    return [this.spinButton, this.minus, this.plus, this.auto, this.info, this.infoI];
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

  buildPaytable(root: Container, lineBet: number): number {
    return buildClassicPaytable(root, lineBet);
  }

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
  const btn = new SpriteButton(uiTexture(texture), a.r, SKIN_SCALE);
  btn.setPosition(a.x, a.y);
  return btn;
}
