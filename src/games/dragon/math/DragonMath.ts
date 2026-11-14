import {
  evaluateLines, random, ReelStripMath,
  type FeatureRound, type FeatureStep, type MathModel, type SlotConfig, type SpinResult, type StickyCell,
} from '@/engine/math';
import type { MathProfile, RespinConfig } from './respinConfig';

type Rng = () => number;

/**
 * Dragon Hoard math: base reel strips + "Dragon's Nest" sticky respins.
 * Pure (no Pixi/DOM) so tools/simulate.ts can run it in Node.
 *
 * 3+ eggs (scatter) anywhere → the eggs hatch into dragons and the respins
 * run on the nest strips (no low cards, no eggs). Dragons (rc.sticky) stick
 * with a cash value; a new dragon resets respins; a full nest adds the GRAND
 * prize. The whole round is decided here, the engine only replays it.
 */
export class DragonMath implements MathModel {
  private base: ReelStripMath;
  private readonly lines: number;
  private readonly rc: RespinConfig;
  private readonly nest: string[][];

  constructor(private cfg: SlotConfig, profile: MathProfile,
              private rng: Rng = random, private forceFeature = false) {
    this.base = new ReelStripMath(cfg, profile.reels, rng);
    this.rc = profile.respin;
    this.nest = profile.nest;
    this.lines = cfg.paylines.length;
  }

  spin(): SpinResult {
    let result = this.base.spin();
    for (let i = 0; this.forceFeature && this.scatters(result.grid).length < this.rc.trigger && i < 5000; i++) {
      result = this.base.spin();
    }
    const trigger = this.scatters(result.grid);
    if (trigger.length >= this.rc.trigger) result.feature = this.playRespins(trigger);
    return result;
  }

  private scatters(grid: string[][]): [number, number][] {
    const out: [number, number][] = [];
    grid.forEach((col, reel) => col.forEach((s, row) => { if (s === this.rc.scatter) out.push([reel, row]); }));
    return out;
  }

  /** Random sticky value (× line bet) or jackpot tag, from rc.values weights; the cell shows rc.sticky. */
  private stick(reel: number, row: number): StickyCell {
    const total = this.rc.values.reduce((s, v) => s + v.w, 0);
    let roll = this.rng() * total;
    const pick = this.rc.values.find(v => (roll -= v.w) < 0) ?? this.rc.values[0];
    return { reel, row, symbol: this.rc.sticky, value: pick.x * this.lines, tag: pick.tag };
  }

  private playRespins(trigger: [number, number][]): FeatureRound {
    const { cols, rows } = this.cfg.grid;
    const cells = cols * rows;
    const sticky = new Map<string, StickyCell>();
    const initialSticky = trigger.map(([r, row]) => this.stick(r, row));
    initialSticky.forEach(c => sticky.set(`${c.reel},${c.row}`, c));

    const steps: FeatureStep[] = [];
    let respins = this.rc.respins;
    let lineWins = 0;
    while (respins > 0 && sticky.size < cells) {
      const grid = this.nest.map(strip => {
        const stop = Math.floor(this.rng() * strip.length);
        return Array.from({ length: rows }, (_, r) => strip[(stop + r) % strip.length]);
      });
      for (const c of sticky.values()) grid[c.reel][c.row] = c.symbol;

      const newSticky: StickyCell[] = [];
      grid.forEach((col, reel) => col.forEach((s, row) => {
        if (s === this.rc.sticky && !sticky.has(`${reel},${row}`)) newSticky.push(this.stick(reel, row));
      }));
      newSticky.forEach(c => sticky.set(`${c.reel},${c.row}`, c));
      respins = newSticky.length > 0 ? this.rc.respins : respins - 1;

      const wins = evaluateLines(this.cfg, grid);
      const lineWin = wins.reduce((s, w) => s + w.multiplier, 0);
      lineWins += lineWin;
      steps.push({ grid, wins, lineWin, newSticky, respinsLeft: sticky.size < cells ? respins : 0 });
    }

    const collect = [...sticky.values()].reduce((s, c) => s + c.value, 0);
    const fullBonus = sticky.size >= cells ? this.rc.grand * this.lines : 0;
    return {
      kind: 'respins', trigger, initialSticky, initialRespins: this.rc.respins, steps,
      reelSymbols: [...new Set(this.nest.flat())],
      collect, fullBonus, totalWin: collect + fullBonus + lineWins,
    };
  }
}
