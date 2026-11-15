import { Text, TextStyle, Container } from 'pixi.js';
import { shadow, vGradient, formatMoney as fmt, type Hud, type WinBoxLayout } from '@/engine';
import { config, uiAnchor, type UiAnchorName, skin } from '../config';

const formatMoney = (minor: number) => fmt(config, minor);

const FONT = '"Roboto Condensed", "Arial Narrow", Arial, Helvetica, sans-serif';

const VALUE_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 17, fontWeight: 'bold', fill: 0xFFFFFF,
  dropShadow: shadow(1, 0.8, 2),
});
/** Gold captions over the panels (replace the erased baked BALANCE / BET). */
export const DRAGON_LABEL_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 13, fontWeight: 'bold', fill: vGradient(['#FFE9A6', '#F2B84B']),
  dropShadow: shadow(1, 0.8, 1),
});
const STATUS_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 17, fontWeight: 'bold', fill: 0xFFE7A3,
  stroke: { color: 0x2A0A00, width: 4 }, letterSpacing: 0.5,
});
const WIN_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 21, fontWeight: 'bold',
  fill: vGradient(['#FFF6C8', '#FFC93C', '#FF9A1F'], [0, 0.5, 1]), dropShadow: shadow(1, 0.8, 2),
});

/** Engine win box over the middle panel (former LAST WIN): place + dragon look. */
export function dragonWinBox(): WinBoxLayout {
  const a = uiAnchor('winBox');
  return { x: a.x, y: a.y, w: a.w, h: a.h, styles: { status: STATUS_STYLE, caption: DRAGON_LABEL_STYLE, amount: WIN_STYLE } };
}

/** BALANCE / BET values over the skin's baked panels (the middle one is the engine win box). */
export class DragonHUD implements Hud {
  private balanceValue: Text;
  private betValue: Text;

  constructor() {
    this.balanceValue = this.makeValue('balanceValue');
    this.betValue = this.makeValue('betValue');
  }

  private makeValue(anchorName: UiAnchorName): Text {
    const t = new Text({ text: '', style: VALUE_STYLE });
    const a = uiAnchor(anchorName);
    t.anchor.set(0.5, 0.5);
    t.position.set(a.x, a.y);
    return t;
  }

  addToStage(stage: Container): void {
    stage.addChild(
      skin.label('balanceLabel', 'label.balance', DRAGON_LABEL_STYLE),
      skin.label('betLabel', 'label.bet', DRAGON_LABEL_STYLE),
      this.balanceValue, this.betValue,
    );
  }

  updateBalanceDisplay(balance: number, totalBet: number): void {
    this.balanceValue.text = formatMoney(balance);
    this.betValue.text = formatMoney(totalBet);
  }
}
