import { Text, TextStyle, Container, Graphics } from 'pixi.js';
import { shadow, vGradient, formatMoney as fmt, t, type Hud } from '@/engine';
import { config, uiAnchor, type UiAnchorName, skin } from '../config';

const formatMoney = (minor: number) => fmt(config, minor);

const FONT = '"Roboto Condensed", "Arial Narrow", Arial, Helvetica, sans-serif';

const VALUE_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 17, fontWeight: 'bold', fill: 0xFFFFFF,
  dropShadow: shadow(1, 0.8, 2),
});
const WIN_VALUE_STYLE = Object.assign(VALUE_STYLE.clone(), {
  fill: vGradient(['#FFF6C8', '#FFC93C', '#FF9A1F'], [0, 0.5, 1]),
});
/** Gold captions over the panels (replace the erased baked BALANCE / LAST WIN / BET). */
export const DRAGON_LABEL_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 13, fontWeight: 'bold', fill: vGradient(['#FFE9A6', '#F2B84B']),
  dropShadow: shadow(1, 0.8, 1),
});
const MESSAGE_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 15, fontWeight: 'bold', fill: 0xFFE7A3,
  stroke: { color: 0x2A0A00, width: 4 }, letterSpacing: 0.5,
});

/**
 * Texts drawn over the skin's baked panels:
 * BALANCE / LAST WIN / BET values plus a one-line message strip under the reels.
 */
export class DragonHUD implements Hud {
  private balanceValue: Text;
  private lastWinValue: Text;
  private betValue: Text;
  private message: Text;
  private messageBg = new Graphics();
  private lastWin = 0;

  constructor() {
    this.balanceValue = this.makeValue('balanceValue', VALUE_STYLE);
    this.lastWinValue = this.makeValue('lastWinValue', VALUE_STYLE);
    this.betValue = this.makeValue('betValue', VALUE_STYLE);
    this.message = this.makeValue('message', MESSAGE_STYLE);
    this.setLastWin(0);
  }

  private makeValue(anchorName: UiAnchorName, style: TextStyle): Text {
    const t = new Text({ text: '', style: style });
    const a = uiAnchor(anchorName);
    t.anchor.set(0.5, 0.5);
    t.position.set(a.x, a.y);
    return t;
  }

  addToStage(stage: Container): void {
    stage.addChild(
      skin.label('balanceLabel', 'label.balance', DRAGON_LABEL_STYLE),
      skin.label('lastWinLabel', 'label.lastWin', DRAGON_LABEL_STYLE),
      skin.label('betLabel', 'label.bet', DRAGON_LABEL_STYLE),
      this.balanceValue, this.lastWinValue, this.betValue, this.messageBg, this.message,
    );
  }

  private setMessage(text: string): void {
    this.message.text = text;
    this.messageBg.clear();
    if (!text) return;
    const w = this.message.width + 28;
    const h = 24;
    this.messageBg.roundRect(this.message.x - w / 2, this.message.y - h / 2, w, h, h / 2)
      .fill({ color: 0x160912, alpha: 0.9 }).stroke({ width: 1.5, color: 0xC8962E, alpha: 0.8 });
  }

  /** Neutral status line (e.g. "Good luck!"). */
  setStatus(msg: string): void {
    this.setMessage(msg);
  }

  /** Show the win of the latest spin in the message strip and LAST WIN panel. */
  setWinStatus(amount: number): void {
    this.setMessage(t('hud.win', { amount: formatMoney(amount) }));
    this.setLastWin(amount);
  }

  setLineInfo(text: string): void {
    this.setMessage(text);
  }

  hideLineInfo(): void {
    if (this.lastWin > 0) this.setMessage(t('hud.win', { amount: formatMoney(this.lastWin) }));
  }

  setLastWin(amount: number): void {
    this.lastWin = amount;
    this.lastWinValue.text = formatMoney(amount);
    this.lastWinValue.style = amount > 0 ? WIN_VALUE_STYLE : VALUE_STYLE;
  }

  updateBalanceDisplay(balance: number, totalBet: number): void {
    this.balanceValue.text = formatMoney(balance);
    this.betValue.text = formatMoney(totalBet);
  }
}
