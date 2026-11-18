/**
 * Monte-Carlo report for Crystal Falls (real game math, math/CrystalMath.ts, in Node).
 *
 *   npm run crystal:sim                    (2M base spins + 50k bought features)
 *   npm run crystal:sim -- 500000 20000    (custom sample sizes)
 *
 * Base RTP covers tumbles, orbs and prism pays; free-spins RTP = trigger
 * rate × mean free-spins win, measured on a separate batch of bought
 * features (buy = same round, so it also prices the feature buy).
 */
// Node global (no @types/node in this browser project)
declare const process: { argv: string[] };

import raw from '../config.json';
import { createRng, resolveConfig, type RawSlotConfig } from '@/engine/math';
import { CrystalMath } from '../math/CrystalMath';

const nums = process.argv.slice(2).filter(a => /^\d+$/.test(a)).map(Number);
const SPINS = nums[0] ?? 2_000_000;
const FEATURES = nums[1] ?? 50_000;

const cfg = Object.assign(resolveConfig({ ...raw, payMode: 'anywhere' } as RawSlotConfig), { maxWin: raw.maxWin });
const math = new CrystalMath(cfg, raw.math, createRng(12345));

let base = 0, hits = 0, triggers = 0, tumbles = 0, multHits = 0, top = 0;
for (let i = 0; i < SPINS; i++) {
  const r = math.spin();
  base += r.totalWin;
  if (r.totalWin > 0) hits++;
  if (r.freeSpins) triggers++;
  if (r.multiplier) multHits++;
  tumbles += r.tumbles?.length ?? 0;
  top = Math.max(top, r.totalWin);
}

let fsWin = 0, fsSpins = 0, buyBase = 0, fsTop = 0;
for (let i = 0; i < FEATURES; i++) {
  const r = math.spin({ buyFeature: true });
  const fs = r.freeSpins!;
  fsWin += fs.totalWin;
  buyBase += r.totalWin;
  fsSpins += fs.spins.length;
  fsTop = Math.max(fsTop, fs.totalWin + r.totalWin);
}
const meanFs = fsWin / FEATURES;
const trigRate = triggers / SPINS;
// base spins already include the triggering spin's own win; free spins add trigger rate × mean round
const rtpBase = base / SPINS;
const rtpFs = trigRate * meanFs;
const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
const buyRtp = (buyBase / FEATURES + meanFs) / raw.buyFeature.cost;

console.log(`spins ${SPINS.toLocaleString()}, bought features ${FEATURES.toLocaleString()}`);
console.log(`base RTP           ${pct(rtpBase)}   hit rate ${pct(hits / SPINS)}   tumbles/spin ${(tumbles / SPINS).toFixed(2)}   orb wins ${pct(multHits / SPINS)}`);
console.log(`free spins         1 in ${(1 / trigRate).toFixed(0)} spins   mean round ${meanFs.toFixed(1)}× bet   ${(fsSpins / FEATURES).toFixed(1)} spins/round   RTP ${pct(rtpFs)}`);
console.log(`TOTAL RTP          ${pct(rtpBase + rtpFs)}   (target ${pct(raw.rtp)})`);
console.log(`feature buy        ${raw.buyFeature.cost}× bet → RTP ${pct(buyRtp)}   cost for 96%: ${((buyBase / FEATURES + meanFs) / 0.96).toFixed(1)}× bet`);
console.log(`top win            base ${top.toFixed(1)}×   feature ${fsTop.toFixed(1)}× (cap ${raw.maxWin}×)`);
