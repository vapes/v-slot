import type { SlotConfig } from '../config/SlotConfig';
import { lineBetOf } from '../math/Paytable';
import { gameEvents } from './GameEvents';

/** Balance and bet selection (minor units). Emits `balance` / `betChange`. */
export class Wallet {
  private _balance: number;
  private betIndex: number;

  constructor(private cfg: SlotConfig) {
    this._balance = cfg.startBalance;
    this.betIndex = cfg.defaultBetIndex;
  }

  get balance(): number { return this._balance; }
  set balance(value: number) {
    if (value === this._balance) return;
    this._balance = value;
    gameEvents.emit('balance', { balance: value });
  }

  get totalBet(): number { return this.cfg.betOptions[this.betIndex]; }
  get lineBet(): number { return lineBetOf(this.cfg, this.totalBet); }
  get canDecrease(): boolean { return this.betIndex > 0; }
  get canIncrease(): boolean { return this.betIndex < this.cfg.betOptions.length - 1; }
  get canAffordSpin(): boolean { return this._balance >= this.totalBet; }

  /** Step the bet; `wrap` cycles past the ends. Returns false when unchanged. */
  changeBet(delta: -1 | 1, wrap: boolean): boolean {
    const n = this.cfg.betOptions.length;
    let next = this.betIndex + delta;
    if (wrap) next = (next + n) % n;
    if (next < 0 || next >= n || next === this.betIndex) return false;
    this.betIndex = next;
    gameEvents.emit('betChange', { totalBet: this.totalBet });
    return true;
  }
}
