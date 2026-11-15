import type { SlotConfig } from '../config/SlotConfig';
import type { WinBox } from '../ui/WinBox';
import type { SpinResult } from '../math/types';
import type { ReelController } from '../reels/ReelController';
import { t } from '../i18n/I18n';
import { formatMoney } from '../utils/Money';

/** After `winAllDelay`, cycles through each winning line every `winLineInterval` with its text in the win box. */
export class WinCycle {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private cfg: SlotConfig, private reels: ReelController, private winBox: WinBox) {}

  start(result: SpinResult, lineBet: number): void {
    if (result.wins.length === 0) return;
    const { winAllDelay, winLineInterval } = this.cfg.spin;
    let i = 0;
    const showNextLine = () => {
      const win = result.wins[i];
      this.reels.showWinLine(win, winLineInterval);
      const symbol = t(`symbol.${win.symbol}`, {}, this.cfg.symbolName(win.symbol)).toUpperCase();
      const amount = formatMoney(this.cfg, win.multiplier * lineBet);
      this.winBox.setCaption(t('win.line', { line: win.paylineIndex + 1, count: win.count, symbol, amount }));
      i = (i + 1) % result.wins.length;
      this.timer = setTimeout(showNextLine, winLineInterval);
    };
    this.timer = setTimeout(showNextLine, winAllDelay);
  }

  stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.winBox.setCaption(null);
  }
}
