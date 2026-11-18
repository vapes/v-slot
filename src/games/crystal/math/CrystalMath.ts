import {
  cellSymbol, cellValue, evaluateAnywhere, random, runTumbles, withValue,
  type FreeSpin, type FreeSpinsRound, type MathModel, type MultiplierResult, type SlotConfig, type SpinOptions, type SpinResult,
} from '@/engine/math';
import { picker, type RawCrystalMath, type WeightTable } from './profile';

type Rng = () => number;
type Pos = [number, number];

/** One drawn + tumbled screen before the game decides what the multipliers do. */
interface Play {
  result: SpinResult;
  finalGrid: string[][];
  tumbleWin: number;
  multCells: Pos[];
  multSum: number;
  scatters: Pos[];
}

/**
 * Crystal Falls: 6×5, pay anywhere (8+ of a symbol, cfg.payMode "anywhere"),
 * tumbles until nothing pays, multiplier orbs, prism scatters → free spins.
 *
 * Base game: the orbs on the final screen add up and multiply the spin's
 * tumble win (only when it won). 4+ prisms on the final screen pay
 * (paytable.scatter) and start 15 free spins; in free spins every orb sum of a
 * winning spin adds to a total multiplier that multiplies every later win,
 * 3+ prisms add 5 spins. Wins are × total bet (the bet unit of a pay-anywhere
 * game), capped at cfg.maxWin. Pure: tools/simulate.ts runs it in Node.
 */
export class CrystalMath implements MathModel {
  private readonly cell: Record<'base' | 'free', () => string>;

  constructor(private cfg: SlotConfig & { maxWin?: number }, private m: RawCrystalMath,
              private rng: Rng = random, private forceFeature = false) {
    const make = (t: WeightTable) => {
      const sym = picker(Object.entries(t.weights), rng);
      const mult = picker(Object.entries(t.multipliers).map(([v, w]) => [Number(v), w] as [number, number]), rng);
      return () => {
        const s = sym();
        return s === m.multiplier ? withValue(s, mult()) : s;
      };
    };
    this.cell = { base: make(m.base), free: make(m.free) };
  }

  /** A quiet base screen: no win, no orb, fewer prisms than a near miss. */
  initialGrid(): string[][] {
    for (let i = 0; i < 1000; i++) {
      const g = this.draw('base');
      const flat = g.flat().map(cellSymbol);
      if (!evaluateAnywhere(this.cfg, g, [this.m.scatter]).length && !flat.includes(this.m.multiplier)
        && flat.filter(s => s === this.m.scatter).length < 2) return g;
    }
    return this.draw('base');
  }

  spin(opts?: SpinOptions): SpinResult {
    const fs = this.m.freeSpins;
    const grid = this.draw('base');
    if (opts?.buyFeature || this.forceFeature) this.addScatters(grid, this.m.buyScatters);
    const play = this.play(grid, 'base');
    const { result } = play;
    if (play.tumbleWin > 0 && play.multSum > 0) {
      result.multiplier = this.multiplier(play, play.multSum);
      result.totalWin = play.tumbleWin * play.multSum;
    }
    result.totalWin += this.scatterPay(play.scatters.length);
    result.totalWin = Math.min(result.totalWin, this.maxWin);
    if (play.scatters.length >= fs.trigger) result.freeSpins = this.freeSpins(play.scatters, result.totalWin);
    return result;
  }

  private get maxWin(): number {
    return this.cfg.maxWin ?? Infinity;
  }

  private freeSpins(trigger: Pos[], baseWin: number): FreeSpinsRound {
    const fs = this.m.freeSpins;
    const spins: FreeSpin[] = [];
    let left = fs.spins;
    let acc = 0;
    let total = 0;
    while (left > 0 && spins.length < 1000) {
      left--;
      const play = this.play(this.draw('free'), 'free');
      const { result } = play;
      const won = play.tumbleWin > 0;
      if (won && play.multSum > 0) acc += play.multSum;
      result.totalWin = play.tumbleWin * (won && acc > 0 ? acc : 1);
      if (won && play.multSum > 0) result.multiplier = this.multiplier(play, acc);
      // max win: the round ends once the cap is reached
      const room = this.maxWin - baseWin - total;
      if (result.totalWin >= room) {
        result.totalWin = Math.max(0, room);
        left = 0;
      }
      total += result.totalWin;
      const added = left > 0 && play.scatters.length >= fs.retrigger ? fs.extra : 0;
      left += added;
      spins.push({ result, spinsLeft: left, added, multiplier: acc });
    }
    return { kind: 'freespins', trigger, scatterWin: this.scatterPay(trigger.length), initialSpins: fs.spins, spins, totalWin: total };
  }

  private play(grid: string[][], table: 'base' | 'free'): Play {
    const run = runTumbles(grid,
      g => evaluateAnywhere(this.cfg, g, [this.m.scatter]),
      (_, n) => Array.from({ length: n }, () => this.cell[table]()));
    const multCells: Pos[] = [];
    const scatters: Pos[] = [];
    let multSum = 0;
    run.finalGrid.forEach((col, r) => col.forEach((id, row) => {
      const s = cellSymbol(id);
      if (s === this.m.multiplier) {
        multCells.push([r, row]);
        multSum += cellValue(id) ?? 0;
      } else if (s === this.m.scatter) scatters.push([r, row]);
    }));
    const result: SpinResult = { grid, wins: [], totalWin: run.totalWin, tumbles: run.steps };
    return { result, finalGrid: run.finalGrid, tumbleWin: run.totalWin, multCells, multSum, scatters };
  }

  private multiplier(play: Play, applied: number): MultiplierResult {
    return { cells: play.multCells, sum: play.multSum, applied, base: play.tumbleWin };
  }

  private scatterPay(count: number): number {
    const pays = this.cfg.paytable[this.m.scatter] ?? {};
    const n = Math.min(count, Math.max(...Object.keys(pays).map(Number)));
    return pays[String(n)] ?? 0;
  }

  private draw(table: 'base' | 'free'): string[][] {
    const { rows, cols } = this.cfg.grid;
    return Array.from({ length: cols }, () => Array.from({ length: rows }, () => this.cell[table]()));
  }

  /** Feature buy: put `n` prisms on distinct reels (on top of any already there). */
  private addScatters(grid: string[][], n: number): void {
    const s = this.m.scatter;
    const have = grid.flat().filter(id => id === s).length;
    const reels = grid.map((_, i) => i).filter(r => !grid[r].includes(s));
    for (let k = have; k < n && reels.length; k++) {
      const r = reels.splice(Math.floor(this.rng() * reels.length), 1)[0];
      grid[r][Math.floor(this.rng() * grid[r].length)] = s;
    }
  }
}
