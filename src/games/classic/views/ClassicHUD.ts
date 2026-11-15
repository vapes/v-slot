import { Container, Text, TextStyle } from 'pixi.js';
import { shadow, vGradient, formatMoney, type Hud, type WinBoxLayout } from '@/engine';
import { config, uiAnchor, type UiAnchorName, skin } from '../config';
import { JackpotTicker } from './JackpotTicker';

const FONT = '"Roboto Condensed", "Arial Narrow", Arial, Helvetica, sans-serif';
const VALUE_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 21, fontWeight: 'bold', fill: 0xFFFFFF,
  dropShadow: shadow(1, 0.7, 2),
});
const WIN_STYLE = Object.assign(VALUE_STYLE.clone(), { fill: vGradient(['#FFF4C2', '#FFD54A', '#F0A020']) });
const STATUS_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 17, fontWeight: 'bold', fill: 0xFFE7A3, letterSpacing: 0.5,
  stroke: { color: 0x061331, width: 3 },
});
/** Captions replacing the erased baked texts. */
export const CLASSIC_LABEL_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 19, fontWeight: 'bold', fill: vGradient(['#FFE7A0', '#F5C04A']),
  stroke: { color: 0x10224A, width: 3 },
});
export const CLASSIC_BUTTON_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 19, fontWeight: 'bold', fill: 0xFFFFFF, align: 'center', lineHeight: 18,
  stroke: { color: 0x0A2A66, width: 3 },
});
export const CLASSIC_SPIN_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 30, fontWeight: 'bold', fill: 0xFFFFFF,
  stroke: { color: 0x0B5A14, width: 4 }, dropShadow: shadow(2, 0.5),
});
const JACKPOT_LABEL_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 22, fontWeight: 'bold', fill: vGradient(['#FFF2B8', '#F2B23A']),
  stroke: { color: 0x6A0E0E, width: 4 },
});
const money = (v: number) => formatMoney(config, v);

/** Engine win box over the middle (WIN) panel: place + navy / gold look. */
export function classicWinBox(): WinBoxLayout {
  const a = uiAnchor('winBox');
  return {
    x: a.x, y: a.y, w: a.w, h: a.h,
    styles: {
      status: STATUS_STYLE, caption: CLASSIC_LABEL_STYLE, amount: WIN_STYLE,
      panel: { fill: 0x071A45, alpha: 1, stroke: 0x3A6BC0, inner: 0x8FB4FF, radius: 7 },
    },
  };
}

/** Values in the baked BALANCE / BET panels and the jackpot meter (the WIN panel is the engine win box). */
export class ClassicHUD implements Hud {
  private balance = this.value('balanceValue');
  private bet = this.value('betValue');
  private jackpot = new JackpotTicker();

  private value(name: UiAnchorName, style = VALUE_STYLE): Text {
    const t = new Text({ text: '', style: style });
    const a = uiAnchor(name);
    t.anchor.set(0.5);
    t.position.set(a.x, a.y);
    return t;
  }

  addToStage(stage: Container): void {
    stage.addChild(
      skin.label('jackpotLabel', 'label.megaJackpot', JACKPOT_LABEL_STYLE),
      skin.label('balanceLabel', 'label.balance', CLASSIC_LABEL_STYLE),
      skin.label('betLabel', 'label.bet', CLASSIC_LABEL_STYLE),
      this.jackpot.text, this.balance, this.bet,
    );
  }

  update(dt: number): void {
    this.jackpot.update(dt);
  }

  updateBalanceDisplay(balance: number, totalBet: number): void {
    this.balance.text = money(balance);
    this.bet.text = money(totalBet);
  }
}
