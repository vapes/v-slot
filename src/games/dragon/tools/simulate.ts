/**
 * Monte-Carlo report for Dragon Hoard incl. the Dragon's Nest respins.
 * Runs the real game math (math/DragonMath.ts) in Node.
 *
 *   npm run dragon:sim                       (real profile, 5M spins + 200k forced features)
 *   npm run dragon:sim -- demo 2000000 100000 (demo profile, custom sample sizes)
 *
 * Feature RTP = trigger rate × mean feature win; the mean is measured on a
 * separate batch of forced features to keep its variance low.
 */
// Node global (no @types/node in this browser project)
declare const process: { argv: string[] };

import raw from '../config.json';
import strips from '../strips.json';
import { computeAnticipation, resolveConfig, type RawSlotConfig } from '@/engine/math';
import { DragonMath } from '../math/DragonMath';
import { buildProfile, type MathMode } from '../math/respinConfig';

const MODE: MathMode = process.argv[2] === 'demo' ? 'demo' : 'real';
const nums = process.argv.slice(2).filter(a => /^\d+$/.test(a)).map(Number);
const SPINS = nums[0] ?? 5_000_000;
const FEATURES = nums[1] ?? 200_000;

const cfg = resolveConfig(raw as RawSlotConfig);
const profile = buildProfile(raw, strips, MODE);
const LINES = cfg.paylines.length;

const math = new DragonMath(cfg, profile);
let base = 0, hits = 0, triggers = 0, maxWin = 0, teases = 0, teasesWon = 0;
for (let i = 0; i < SPINS; i++) {
  const r = math.spin();
  base += r.totalWin;
  const total = r.totalWin + (r.feature?.totalWin ?? 0);
  if (total > 0) hits++;
  if (r.feature) triggers++;
  if (computeAnticipation(cfg, r.grid).some(Boolean)) {
    teases++;
    if (r.feature) teasesWon++;
  }
  if (total > maxWin) maxWin = total;
}

const forced = new DragonMath(cfg, profile, Math.random, true);
let fWin = 0, fCollect = 0, fLines = 0, grands = 0, respins = 0, eggs = 0, fMax = 0;
const tags: Record<string, number> = {};
let buyBase = 0;
const featureWins: number[] = []; // × total bet, feature only
for (let i = 0; i < FEATURES; i++) {
  const r = forced.spin({ buyFeature: true });
  const f = r.feature!;
  buyBase += r.totalWin;
  featureWins.push(f.totalWin / LINES);
  fWin += f.totalWin;
  fCollect += f.collect;
  fLines += f.totalWin - f.collect - f.fullBonus;
  if (f.fullBonus) grands++;
  respins += f.steps.length;
  const cells = [...f.initialSticky, ...f.steps.flatMap(s => s.newSticky)];
  eggs += cells.length;
  cells.forEach(c => { if (c.tag) tags[c.tag] = (tags[c.tag] ?? 0) + 1; });
  fMax = Math.max(fMax, f.totalWin);
}

/** Exact P(trigger): convolution of per-reel scatter-count distributions over all stops. */
function exactTriggerRate(): number {
  const rows = cfg.grid.rows;
  let dist = [1];
  for (const strip of profile.reels) {
    const d = new Array(rows + 1).fill(0);
    for (let i = 0; i < strip.length; i++) {
      let n = 0;
      for (let r = 0; r < rows; r++) if (strip[(i + r) % strip.length] in profile.respin.scatters) n++;
      d[n] += 1 / strip.length;
    }
    const next = new Array(dist.length + rows).fill(0);
    dist.forEach((p, a) => d.forEach((q, b) => { next[a + b] += p * q; }));
    dist = next;
  }
  return dist.slice(profile.respin.trigger).reduce((a, b) => a + b, 0);
}

const pct = (x: number) => `${(x * 100).toFixed(3)}%`;
const trigRate = triggers / SPINS;
const meanFeature = fWin / FEATURES / LINES; // × total bet
const baseRtp = base / SPINS / LINES;
const featureRtp = trigRate * meanFeature;
console.log(`Profile          : ${MODE}   spins: ${SPINS.toLocaleString()}   forced features: ${FEATURES.toLocaleString()}`);
console.log(`Base-game RTP    : ${pct(baseRtp)}`);
console.log(`Feature trigger  : 1 in ${(1 / trigRate).toFixed(1)}  (${pct(trigRate)})`);
console.log(`Mean feature win : ${meanFeature.toFixed(2)} × bet  (sticky ${(fCollect / FEATURES / LINES).toFixed(2)}, lines ${(fLines / FEATURES / LINES).toFixed(2)})`);
console.log(`Feature RTP      : ${pct(featureRtp)}`);
console.log(`TOTAL RTP        : ${pct(baseRtp + featureRtp)}`);
const exact = exactTriggerRate();
console.log(`Exact trigger    : 1 in ${(1 / exact).toFixed(2)} → feature RTP ${pct(exact * meanFeature)} (add the exact base RTP from npm run dragon:reels)`);
console.log(`Hit frequency    : ${pct(hits / SPINS)}`);
console.log(`Anticipation     : ${pct(teases / SPINS)} of spins, ${pct(teasesWon / Math.max(1, teases))} of them end in the feature`);
console.log(`Respins / feature: ${(respins / FEATURES).toFixed(2)}   sticky / feature: ${(eggs / FEATURES).toFixed(2)}`);
console.log(`GRAND (full nest): 1 in ${grands ? (FEATURES / grands).toFixed(0) : '∞'} features`);
console.log(`Jackpots / feature: ${Object.entries(tags).map(([k, v]) => `${k} ${(v / FEATURES).toFixed(4)}`).join(', ')}`);
const buyCost = (MODE === 'demo' ? raw.demo.buyFeature : raw.buyFeature).cost;
const buyMean = (buyBase + fWin) / FEATURES / LINES;
console.log(`Feature buy      : mean ${buyMean.toFixed(2)} × bet (trigger spin ${(buyBase / FEATURES / LINES).toFixed(2)} + nest ${meanFeature.toFixed(2)}) → at ${buyCost} × bet: RTP ${pct(buyMean / buyCost)}  (cost for 96%: ${(buyMean / 0.96).toFixed(1)} × bet)`);
featureWins.sort((a, b) => a - b);
const q = (p: number) => featureWins[Math.floor(p * (featureWins.length - 1))].toFixed(1);
const share = (x: number) => pct(featureWins.filter(w => w >= x).length / featureWins.length);
const cel = raw.celebration;
console.log(`Feature win dist : p25 ${q(0.25)}  median ${q(0.5)}  p75 ${q(0.75)}  p95 ${q(0.95)}  p99 ${q(0.99)} × bet`);
console.log(`Feature banners  : BIG+ ${share(cel.big)}  HUGE+ ${share(cel.huge)}  EPIC+ ${share(cel.epic)}  MAX ${share(cel.max)} of features`);
console.log(`Max win seen     : base ${(maxWin / LINES).toFixed(1)} × bet, feature ${(fMax / LINES).toFixed(1)} × bet`);
