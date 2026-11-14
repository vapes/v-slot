/**
 * Monte-Carlo report for Dragon Hoard incl. the Dragon's Nest respins.
 * Runs the real game math (math/DragonMath.ts) in Node.
 *
 *   npm run dragon:sim                 (default 5M spins + 200k forced features)
 *   npm run dragon:sim -- 20000000     (more spins)
 *
 * Feature RTP = trigger rate × mean feature win; the mean is measured on a
 * separate batch of forced features to keep its variance low.
 */
// Node global (no @types/node in this browser project)
declare const process: { argv: string[] };

import raw from '../config.json';
import { resolveConfig, type RawSlotConfig } from '@/engine/math';
import { DragonMath } from '../math/DragonMath';
import type { RespinConfig } from '../math/respinConfig';

const cfg = resolveConfig(raw as RawSlotConfig);
const rc = raw.respin as RespinConfig;
const LINES = cfg.paylines.length;
const SPINS = Number(process.argv[2] ?? 5_000_000);
const FEATURES = Number(process.argv[3] ?? 200_000);

const math = new DragonMath(cfg, raw.reels, rc);
let base = 0, hits = 0, triggers = 0, maxWin = 0;
for (let i = 0; i < SPINS; i++) {
  const r = math.spin();
  base += r.totalWin;
  const total = r.totalWin + (r.feature?.totalWin ?? 0);
  if (total > 0) hits++;
  if (r.feature) triggers++;
  if (total > maxWin) maxWin = total;
}

const forced = new DragonMath(cfg, raw.reels, rc, Math.random, true);
let fWin = 0, fCollect = 0, fLines = 0, grands = 0, respins = 0, eggs = 0, fMax = 0;
const tags: Record<string, number> = {};
for (let i = 0; i < FEATURES; i++) {
  const f = forced.spin().feature!;
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

const pct = (x: number) => `${(x * 100).toFixed(3)}%`;
const trigRate = triggers / SPINS;
const meanFeature = fWin / FEATURES / LINES; // × total bet
const baseRtp = base / SPINS / LINES;
const featureRtp = trigRate * meanFeature;
console.log(`Spins            : ${SPINS.toLocaleString()}   forced features: ${FEATURES.toLocaleString()}`);
console.log(`Base-game RTP    : ${pct(baseRtp)}`);
console.log(`Feature trigger  : 1 in ${(1 / trigRate).toFixed(1)}  (${pct(trigRate)})`);
console.log(`Mean feature win : ${meanFeature.toFixed(2)} × bet  (eggs ${(fCollect / FEATURES / LINES).toFixed(2)}, lines ${(fLines / FEATURES / LINES).toFixed(2)})`);
console.log(`Feature RTP      : ${pct(featureRtp)}`);
console.log(`TOTAL RTP        : ${pct(baseRtp + featureRtp)}`);
console.log(`Hit frequency    : ${pct(hits / SPINS)}`);
console.log(`Respins / feature: ${(respins / FEATURES).toFixed(2)}   eggs / feature: ${(eggs / FEATURES).toFixed(2)}`);
console.log(`GRAND (full nest): 1 in ${grands ? (FEATURES / grands).toFixed(0) : '∞'} features`);
console.log(`Jackpots / feature: ${Object.entries(tags).map(([k, v]) => `${k} ${(v / FEATURES).toFixed(4)}`).join(', ')}`);
console.log(`Max win seen     : base ${(maxWin / LINES).toFixed(1)} × bet, feature ${(fMax / LINES).toFixed(1)} × bet`);
