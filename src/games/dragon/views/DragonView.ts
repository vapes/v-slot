import { Circle, Container, Sprite } from 'pixi.js';
import {
  SpriteButton, SpriteSpinButton, type BetControlsState, type GameActions, type GameView, type PaytableTheme,
} from '@/engine';
import { config, SKIN_SCALE, uiAnchor } from '../config';
import { backgroundTexture, uiTexture, type UiSpriteName } from '../assets';
import { DragonHUD } from './DragonHUD';
import { buildDragonPaytable, DRAGON_THEME } from './DragonPaytable';

/** Skin background + every button placed exactly over its baked spot. */
export class DragonView implements GameView {
  readonly spinButton = makeSpin();
  readonly hud = new DragonHUD();
  readonly paytableTheme: PaytableTheme = DRAGON_THEME;
  private readonly minus = make('minus');
  private readonly plus = make('plus');
  private readonly coins = make('coins');
  private readonly auto = make('auto');
  private readonly turbo = make('turbo');
  private readonly trophy = make('trophy');
  private readonly menu = make('menu', 22);
  private readonly fullscreenZone = new Container();

  constructor(actions: GameActions) {
    this.minus.onClick(() => actions.changeBet(-1));
    this.plus.onClick(() => actions.changeBet(1));
    this.coins.onClick(() => actions.changeBet(1, true));
    this.auto.onClick(actions.toggleAutoplay);
    this.turbo.onClick(actions.toggleQuickSpin);
    this.trophy.onClick(actions.openPaytable);
    this.menu.onClick(actions.togglePaytable);

    // The fullscreen icon is baked into the background; this is its hit zone.
    const z = this.fullscreenZone;
    z.eventMode = 'static';
    z.cursor = 'pointer';
    z.hitArea = new Circle(0, 0, 40 * SKIN_SCALE);
    z.position.set(912 * SKIN_SCALE, 58 * SKIN_SCALE);
    z.on('pointertap', toggleFullscreen);
  }

  private get buttons(): SpriteButton[] {
    return [this.spinButton, this.minus, this.plus, this.coins, this.auto, this.turbo, this.trophy, this.menu];
  }

  mountBelowReels(stage: Container): void {
    const bg = new Sprite(backgroundTexture());
    bg.width = config.canvas.width;
    bg.height = config.canvas.width * bg.texture.height / bg.texture.width;
    stage.addChild(bg);
  }

  mountAboveReels(stage: Container): void {
    for (const b of this.buttons) stage.addChild(b.container);
    stage.addChild(this.fullscreenZone);
    this.hud.addToStage(stage);
  }

  setBetControls({ enabled, canDecrease, canIncrease }: BetControlsState): void {
    this.minus.enabled = enabled && canDecrease;
    this.plus.enabled = enabled && canIncrease;
    this.coins.enabled = enabled;
  }

  setAutoplay(on: boolean): void { this.auto.active = on; }
  setQuickSpin(on: boolean): void { this.turbo.active = on; }

  buildPaytable(root: Container, lineBet: number): number {
    return buildDragonPaytable(root, lineBet);
  }

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
