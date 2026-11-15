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
 * 3+ scatters anywhere (eggs and/or dragons, rc.scatters) start the nest;
 * respins = Σ per-scatter grants (egg 1, dragon 3). The scatters only start
 * the feature (they do not stay). Respins run on the nest strips (wild +
 * treasures, no scatters); each WILD (rc.sticky) that lands sticks, tops the
 * counter up to rc.respins and substitutes on lines. Wilds pay nothing on
 * their own — the feature pays its line wins only.
 * The whole round is decided here, the engine only replays it.
 */
export class DragonMath implements MathModel {
  private base: ReelStripMath;
  private readonly rc: RespinConfig;
  private readonly nest: string[][];

  constructor(private cfg: SlotConfig, profile: MathProfile,
              private rng: Rng = random, private forceFeature = false) {
    this.base = new ReelStripMath(cfg, profile.reels, rng);
    this.rc = profile.respin;
    this.nest = profile.nest;
  }

  spin(): SpinResult {
    let result = this.base.spin();
    for (let i = 0; this.forceFeature && this.scatters(result.grid).length < this.rc.trigger && i < 1_000_000; i++) {
      result = this.base.spin();
    }
    const trigger = this.scatters(result.grid);
    if (trigger.length >= this.rc.trigger) {
      const grant = trigger.reduce((n, [r, row]) => n + this.rc.scatters[result.grid[r][row]], 0);
      result.feature = this.playRespins(trigger, grant);
    }
    return result;
  }

  private scatters(grid: string[][]): [number, number][] {
    const out: [number, number][] = [];
    grid.forEach((col, reel) => col.forEach((s, row) => { if (s in this.rc.scatters) out.push([reel, row]); }));
    return out;
  }

  /** A sticky wild: no cash value of its own. */
  private stick(reel: number, row: number): StickyCell {
    return { reel, row, symbol: this.rc.sticky, value: 0 };
  }

  private playRespins(trigger: [number, number][], initialRespins: number): FeatureRound {
    const { cols, rows } = this.cfg.grid;
    const cells = cols * rows;
    const sticky = new Map<string, StickyCell>();

    const steps: FeatureStep[] = [];
    let respins = initialRespins;
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
      respins = newSticky.length > 0 ? Math.max(respins - 1, this.rc.respins) : respins - 1;

      const wins = evaluateLines(this.cfg, grid);
      const lineWin = wins.reduce((s, w) => s + w.multiplier, 0);
      lineWins += lineWin;
      steps.push({ grid, wins, lineWin, newSticky, respinsLeft: sticky.size < cells ? respins : 0 });
    }

    return {
      kind: 'respins', trigger, initialSticky: [], initialRespins, steps,
      reelSymbols: [...new Set(this.nest.flat())],
      collect: 0, fullBonus: 0, totalWin: lineWins,
    };
  }
}
