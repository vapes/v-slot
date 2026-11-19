import { Circle, Container } from 'pixi.js';
import {
  SpriteButton, SpriteSpinButton, VideoBackdrop, type BetControlsState, type GameActions, type GameView,
} from '@/engine';
import { config, SKIN_SCALE, uiAnchor, skin } from '../config';
import { backgroundTexture, backgroundVideos, overlayTexture, uiTexture, type UiSpriteName } from '../assets';
import { DragonHUD, DRAGON_LABEL_STYLE, dragonWinBox } from './DragonHUD';

const NIGHT_TINT = 0x8C7BC8;

/** Skin background + every button placed exactly over its baked spot. */
export class DragonView implements GameView {
  readonly spinButton = makeSpin();
  readonly hud = new DragonHUD();
  readonly winBox = dragonWinBox();
  private readonly minus = make('minus');
  private readonly plus = make('plus');
  private readonly info = make('info');
  private readonly auto = make('auto');
  private readonly turbo = make('turbo');
  private readonly buy = make('buy');
  private readonly fullscreenZone = new Container();

  constructor(actions: GameActions) {
    this.minus.onClick(() => actions.changeBet(-1));
    this.plus.onClick(() => actions.changeBet(1));
    this.info.onClick(actions.openPaytable);
    this.buy.onClick(actions.buyFeature);
    this.auto.onClick(actions.toggleAutoplay);
    this.turbo.onClick(actions.toggleQuickSpin);
    skin.labelButton(this.auto, 'autoLabel', 'button.auto', DRAGON_LABEL_STYLE);
    skin.labelButton(this.turbo, 'turboLabel', 'button.turbo', DRAGON_LABEL_STYLE);
    skin.labelButton(this.buy, 'buyLabel', 'button.buy', DRAGON_LABEL_STYLE);

    // The fullscreen icon is baked into the background; this is its hit zone.
    const z = this.fullscreenZone;
    z.eventMode = 'static';
    z.cursor = 'pointer';
    z.hitArea = new Circle(0, 0, 40 * SKIN_SCALE);
    z.position.set(912 * SKIN_SCALE, 58 * SKIN_SCALE);
    z.on('pointertap', toggleFullscreen);
  }

  private get buttons(): SpriteButton[] {
    return [this.spinButton, this.minus, this.plus, this.info, this.auto, this.turbo, this.buy];
  }

  private bg: VideoBackdrop | null = null;

  /** Looping scenery video (muted, autoplay) under the frame / plates / dragon overlay; bg.jpg if it cannot play. */
  mountBelowReels(stage: Container): void {
    const bg = (this.bg = new VideoBackdrop({
      sources: backgroundVideos(), still: backgroundTexture(), overlay: overlayTexture(),
      width: config.canvas.width, height: config.canvas.height,
    }));
    stage.addChild(bg.container);
    void bg.start();
  }

  mountAboveReels(stage: Container): void {
    for (const b of this.buttons) stage.addChild(b.container);
    stage.addChild(this.fullscreenZone);
    this.hud.addToStage(stage);
  }

  setBetControls({ enabled, canDecrease, canIncrease, canBuy }: BetControlsState): void {
    this.buy.enabled = canBuy;
    this.minus.enabled = enabled && canDecrease;
    this.plus.enabled = enabled && canIncrease;
  }

  setAutoplay(on: boolean): void { this.auto.active = on; }
  /** Dragon's Nest: the scene falls into a moonlit night. */
  setFeatureMode(on: boolean): void { if (this.bg) this.bg.tint = on ? NIGHT_TINT : 0xFFFFFF; }
  setQuickSpin(on: boolean): void { this.turbo.active = on; }

  update(dt: number): void {
    for (const b of this.buttons) b.update(dt);
  }
}

function makeSpin(): SpriteSpinButton {
  const a = uiAnchor('spin');
  return new SpriteSpinButton(uiTexture('spin'), a.x, a.y, a.r, SKIN_SCALE, { discColor: 0x1A0B05, accent: 0xFFC94A });
}

function make(name: UiSpriteName & Parameters<typeof uiAnchor>[0], radius?: number): SpriteButton {
  const a = uiAnchor(name);
  const btn = new SpriteButton(uiTexture(name), radius ?? a.r, SKIN_SCALE);
  btn.setPosition(a.x, a.y);
  return btn;
}

function toggleFullscreen(): void {
  if (document.fullscreenElement) {
    document.exitFullscreen?.().catch(() => undefined);
  } else {
    document.documentElement.requestFullscreen?.().catch(() => undefined);
  }
}
