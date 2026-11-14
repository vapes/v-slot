import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { formatMoney, t, type Hud } from '@/engine';
import { config, uiAnchor, type UiAnchorName, skin } from '../config';
import { JackpotTicker } from './JackpotTicker';

const FONT = '"Roboto Condensed", "Arial Narrow", Arial, Helvetica, sans-serif';
const VALUE_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 21, fontWeight: 'bold', fill: 0xFFFFFF,
  dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 1, dropShadowBlur: 2, dropShadowAlpha: 0.7,
});
const WIN_STYLE = new TextStyle({ ...VALUE_STYLE, fill: ['#FFF4C2', '#FFD54A', '#F0A020'] });
const MESSAGE_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 15, fontWeight: 'bold', fill: 0xFFE7A3, letterSpacing: 0.5,
});
/** Captions replacing the erased baked texts. */
export const CLASSIC_LABEL_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 19, fontWeight: 'bold', fill: ['#FFE7A0', '#F5C04A'],
  stroke: 0x10224A, strokeThickness: 3,
});
export const CLASSIC_BUTTON_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 19, fontWeight: 'bold', fill: 0xFFFFFF, align: 'center', lineHeight: 18,
  stroke: 0x0A2A66, strokeThickness: 3,
});
export const CLASSIC_SPIN_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 30, fontWeight: 'bold', fill: 0xFFFFFF,
  stroke: 0x0B5A14, strokeThickness: 4, dropShadow: true, dropShadowDistance: 2, dropShadowAlpha: 0.5,
});
const JACKPOT_LABEL_STYLE = new TextStyle({
  fontFamily: FONT, fontSize: 22, fontWeight: 'bold', fill: ['#FFF2B8', '#F2B23A'],
  stroke: 0x6A0E0E, strokeThickness: 4,
});
const money = (v: number) => formatMoney(config, v);

/** Values in the baked BALANCE / BET / WIN panels, message pill, jackpot meter. */
export class ClassicHUD implements Hud {
  private balance = this.value('balanceValue');
  private bet = this.value('betValue');
  private win = this.value('winValue');
  private message = this.value('message', MESSAGE_STYLE);
  private messageBg = new Graphics();
  private jackpot = new JackpotTicker();

  constructor() {
    this.setLastWin(0);
  }

  private value(name: UiAnchorName, style = VALUE_STYLE): Text {
    const t = new Text('', style);
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
      skin.label('winLabel', 'label.win', CLASSIC_LABEL_STYLE),
      this.jackpot.text, this.balance, this.bet, this.win, this.messageBg, this.message,
    );
  }

  update(dt: number): void {
    this.jackpot.update(dt);
  }

  private setMessage(text: string): void {
    this.message.text = text;
    this.messageBg.clear();
    if (!text) return;
    const w = this.message.width + 28;
    const h = 24;
    this.messageBg.lineStyle(1.5, 0xD9A441, 0.85);
    this.messageBg.beginFill(0x061331, 0.92);
    this.messageBg.drawRoundedRect(this.message.x - w / 2, this.message.y - h / 2, w, h, h / 2);
    this.messageBg.endFill();
  }

  private setLastWin(amount: number): void {
    this.win.text = money(amount);
    this.win.style = amount > 0 ? WIN_STYLE : VALUE_STYLE;
  }

  setStatus(msg: string): void {
    this.setMessage(msg);
  }

  setWinStatus(amount: number): void {
    this.setMessage(t('hud.win', { amount: money(amount) }));
    this.setLastWin(amount);
  }

  setLineInfo(text: string): void {
    this.setMessage(text);
  }

  hideLineInfo(): void {
    this.setMessage('');
  }

  updateBalanceDisplay(balance: number, totalBet: number): void {
    this.balance.text = money(balance);
    this.bet.text = money(totalBet);
  }
}
