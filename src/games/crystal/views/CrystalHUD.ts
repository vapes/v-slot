import { Container, Text, TextStyle } from 'pixi.js';
import { shadow, vGradient, formatMoney, type Hud, type WinBoxLayout } from '@/engine';
import { config, uiAnchor, skin, type UiAnchorName } from '../config';

const FONT = '"Roboto Condensed", "Arial Narrow", Arial, Helvetica, sans-serif';

const VALUE_STYLE = new TextStyle({ fontFamily: FONT, fontSize: 19, fontWeight: 'bold', fill: 0xFFFFFF, dropShadow: shadow(1, 0.8, 2) });
/** Captions over the plates and under the round buttons. */
export const LABEL_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 13, fontWeight: 'bold', letterSpacing: 1,
  fill: vGradient(['#E8F8FF', '#B9A4FF']), dropShadow: shadow(1, 0.8, 1),
});
/** Caption on the BUY button. */
export const BUY_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 17, fontWeight: 'bold', fill: 0xFFFFFF, stroke: { color: 0x5A0846, width: 3 },
});
const STATUS_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 18, fontWeight: 'bold', fill: 0xE8DCFF, stroke: { color: 0x1A0840, width: 4 }, letterSpacing: 0.5,
});
const WIN_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 24, fontWeight: 'bold',
  fill: vGradient(['#FFFFFF', '#FFE27A', '#FF9A1F'], [0, 0.5, 1]), dropShadow: shadow(1, 0.8, 2),
});

/** Engine win box over the middle plate. */
export function crystalWinBox(): WinBoxLayout {
  const a = uiAnchor('winBox');
  return { x: a.x, y: a.y, w: a.w, h: a.h, styles: { status: STATUS_STYLE, caption: LABEL_STYLE, amount: WIN_STYLE } };
}

/** BALANCE / BET values on their plates. */
export class CrystalHUD implements Hud {
  private balance = this.value('balanceValue');
  private bet = this.value('betValue');

  private value(name: UiAnchorName): Text {
    const t = new Text({ text: '', style: VALUE_STYLE });
    const a = uiAnchor(name);
    t.anchor.set(0.5);
    t.position.set(a.x, a.y);
    return t;
  }

  addToStage(stage: Container): void {
    stage.addChild(
      skin.label('balanceLabel', 'label.balance', LABEL_STYLE),
      skin.label('betLabel', 'label.bet', LABEL_STYLE),
      this.balance, this.bet,
    );
  }

  updateBalanceDisplay(balance: number, totalBet: number): void {
    this.balance.text = formatMoney(config, balance);
    this.bet.text = formatMoney(config, totalBet);
  }
}
