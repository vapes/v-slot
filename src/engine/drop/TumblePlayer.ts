import type { Container } from 'pixi.js';
import type { SlotConfig } from '../config/SlotConfig';
import type { SpinResult, WinResult } from '../math/types';
import type { ReelController } from '../reels/ReelController';
import type { LineInfo } from '../ui/LineInfo';
import type { WinBox } from '../ui/WinBox';
import type { WinBoxLayout } from '../ui/winBoxStyle';
import { RespinFlyFX } from '../feature/RespinFlyFX';
import { gameEvents } from '../core/GameEvents';
import { t } from '../i18n/I18n';
import { formatMoney } from '../utils/Money';
import { cellSymbol } from '../math/cells';

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Drop mode: plays the cascades of one spin decided by the math
 * (SpinResult.tumbles) — winners pulse, the info line names the win, the win
 * box shows the running amount, the cells burst and the grid tumbles — then
 * the multiplier cells (SpinResult.multiplier) fly into the win box.
 */
export class TumblePlayer {
  private fly = new RespinFlyFX(0x7FE3FF);

  constructor(
    private cfg: SlotConfig, private reels: ReelController, private lineInfo: LineInfo,
    private winBox: WinBox, private box: WinBoxLayout,
  ) {}

  mount(stage: Container): void {
    stage.addChild(this.fly.container);
  }

  update(dt: number): void {
    this.fly.update(dt);
  }

  /**
   * `shown` = amount (minor units) already in the win box before this spin
   * (free spins add up); the box ends at shown + this spin's win.
   */
  async play(result: SpinResult, lineBet: number, fast: boolean, shown = 0): Promise<void> {
    const d = this.cfg.dropTiming;
    if (!d) return;
    const ms = (v: number) => (fast ? v * d.fastFactor : v);
    const money = (x: number) => Math.round(x * lineBet);
    let running = 0;
    let grid = result.grid;
    for (const [index, step] of (result.tumbles ?? []).entries()) {
      this.reels.showWins({ grid, wins: step.wins, totalWin: step.win }, 700);
      this.lineInfo.show(this.winText(step.wins[0], lineBet));
      running += step.win;
      this.winBox.showWin(shown + money(running));
      gameEvents.emit('tumble', { index, win: money(step.win) });
      await wait(ms(d.winMs));
      await this.reels.tumble(step, fast);
      grid = step.grid;
      await wait(ms(d.tumblePauseMs));
    }
    const m = result.multiplier;
    if (m && m.applied > 0 && m.base > 0) {
      const marks: WinResult[] = m.cells.length ? [{
        paylineIndex: -1, symbol: cellSymbol(grid[m.cells[0][0]][m.cells[0][1]]), count: m.cells.length, multiplier: 0, positions: m.cells,
      }] : [];
      this.reels.showWins({ grid, wins: marks, totalWin: 0 }, 500);
      this.lineInfo.show(t('win.multiplier', { n: m.applied }));
      await wait(ms(d.multiplierMs));
      const to = { x: this.box.x, y: this.box.y };
      await Promise.all(m.cells.map(c => this.fly.fly(this.cellCenter(c), to, ms(d.flyMs))));
      this.reels.clearWins();
      gameEvents.emit('multiplier', { applied: m.applied, sum: m.sum });
    }
    if (result.totalWin > 0) this.winBox.showWin(shown + money(result.totalWin));
    this.lineInfo.hide();
  }

  clear(): void {
    this.fly.clear();
    this.lineInfo.hide();
  }

  private winText(w: WinResult | undefined, lineBet: number): string {
    if (!w) return '';
    const symbol = t(`symbol.${w.symbol}`, {}, this.cfg.symbolName(w.symbol)).toUpperCase();
    return t('win.cluster', { count: w.count, symbol, amount: formatMoney(this.cfg, Math.round(w.multiplier * lineBet)) });
  }

  private cellCenter([reel, row]: [number, number]): { x: number; y: number } {
    const { reelOffsetX, reelOffsetY, reelWidth, cellHeight, symbol } = this.cfg;
    return { x: reelOffsetX + reel * reelWidth + symbol.width / 2, y: reelOffsetY + row * cellHeight + symbol.height / 2 };
  }
}
