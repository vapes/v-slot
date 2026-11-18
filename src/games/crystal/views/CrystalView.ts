import { Container, Sprite } from 'pixi.js';
import {
  SpriteButton, SpriteSpinButton, type BetControlsState, type GameActions, type GameView,
} from '@/engine';
import { config, SKIN_SCALE, uiAnchor, skin } from '../config';
import { backgroundTexture, uiTexture, type UiSpriteName } from '../assets';
import { CrystalHUD, LABEL_STYLE, BUY_STYLE, crystalWinBox } from './CrystalHUD';

/** Free spins: the cavern turns to a deep aurora. */
const FREE_TINT = 0xB8A0FF;

/** Drawn background + round buttons at their skin anchors. */
export class CrystalView implements GameView {
  readonly spinButton = makeSpin();
  readonly hud = new CrystalHUD();
  readonly winBox = crystalWinBox();
  private readonly minus = make('minus');
  private readonly plus = make('plus');
  private readonly info = make('info');
  private readonly auto = make('auto');
  private readonly turbo = make('turbo');
  private readonly buy = make('buy');
  private bg: Sprite | null = null;

  constructor(actions: GameActions) {
    this.minus.onClick(() => actions.changeBet(-1));
    this.plus.onClick(() => actions.changeBet(1));
    this.info.onClick(actions.openPaytable);
    this.buy.onClick(actions.buyFeature);
    this.auto.onClick(actions.toggleAutoplay);
    this.turbo.onClick(actions.toggleQuickSpin);
    skin.labelButton(this.auto, 'autoLabel', 'button.auto', LABEL_STYLE);
    skin.labelButton(this.turbo, 'turboLabel', 'button.turbo', LABEL_STYLE);
    skin.labelButton(this.buy, 'buyLabel', 'button.buy', BUY_STYLE);
  }

  private get buttons(): SpriteButton[] {
    return [this.spinButton, this.minus, this.plus, this.info, this.auto, this.turbo, this.buy];
  }

  mountBelowReels(stage: Container): void {
    const bg = (this.bg = new Sprite(backgroundTexture()));
    bg.width = config.canvas.width;
    bg.height = config.canvas.height;
    stage.addChild(bg);
  }

  mountAboveReels(stage: Container): void {
    for (const b of this.buttons) stage.addChild(b.container);
    this.hud.addToStage(stage);
  }

  setBetControls({ enabled, canDecrease, canIncrease, canBuy }: BetControlsState): void {
    this.buy.enabled = canBuy;
    this.minus.enabled = enabled && canDecrease;
    this.plus.enabled = enabled && canIncrease;
  }

  setAutoplay(on: boolean): void { this.auto.active = on; }
  setQuickSpin(on: boolean): void { this.turbo.active = on; }
  setFeatureMode(on: boolean): void { if (this.bg) this.bg.tint = on ? FREE_TINT : 0xFFFFFF; }

  update(dt: number): void {
    for (const b of this.buttons) b.update(dt);
  }
}

function makeSpin(): SpriteSpinButton {
  const a = uiAnchor('spin');
  return new SpriteSpinButton(uiTexture('spin'), a.x, a.y, a.r, SKIN_SCALE, { discColor: 0x1A0840, accent: 0xFFD36A });
}

function make(name: UiSpriteName): SpriteButton {
  const a = uiAnchor(name);
  const btn = new SpriteButton(uiTexture(name), a.r, SKIN_SCALE);
  btn.setPosition(a.x, a.y);
  return btn;
}
