import { Text, TextStyle, Container } from 'pixi.js';
import { shadow, vGradient, formatMoney as fmt, WinBox, type Hud } from '@/engine';
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

/**
 * Texts drawn over the skin's baked panels: BALANCE / BET values. The middle
 * panel is the engine WinBox (status line + counting win; BIG+ wins ride onto
 * the reels) — it replaces the old LAST WIN block and message strip.
 */
export class DragonHUD implements Hud {
  readonly winBox: WinBox;
  private balanceValue: Text;
  private betValue: Text;

  constructor() {
    this.balanceValue = this.makeValue('balanceValue');
    this.betValue = this.makeValue('betValue');
    const a = uiAnchor('winBox');
    this.winBox = new WinBox(config, { x: a.x, y: a.y, w: a.w, h: a.h },
      { status: STATUS_STYLE, caption: DRAGON_LABEL_STYLE, amount: WIN_STYLE });
  }

  private makeValue(anchorName: UiAnchorName): Text {
    const t = new Text({ text: '', style: VALUE_STYLE });
    const a = uiAnchor(anchorName);
    t.anchor.set(0.5, 0.5);
    t.position.set(a.x, a.y);
    return t;
  }

  /** The win box itself is mounted by the engine (above the HUD, below the corner buttons). */
  addToStage(stage: Container): void {
    stage.addChild(
      skin.label('balanceLabel', 'label.balance', DRAGON_LABEL_STYLE),
      skin.label('betLabel', 'label.bet', DRAGON_LABEL_STYLE),
      this.balanceValue, this.betValue,
    );
  }

  /** Neutral status line (e.g. "Good luck!"). */
  setStatus(msg: string): void {
    this.winBox.setStatus(msg);
  }

  setWinStatus(amount: number): void {
    this.winBox.showWin(amount);
  }

  setLineInfo(text: string): void {
    this.winBox.setCaption(text);
  }

  hideLineInfo(): void {
    this.winBox.setCaption(null);
  }

  updateBalanceDisplay(balance: number, totalBet: number): void {
    this.balanceValue.text = formatMoney(balance);
    this.betValue.text = formatMoney(totalBet);
  }
}
