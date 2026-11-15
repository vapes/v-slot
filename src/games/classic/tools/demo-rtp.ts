/**
 * Exact RTP of both classic profiles from screens.bin (no sampling): mean win
 * of every payout category × its probability (config.payoutDistribution for
 * real, config.demo.payoutProbabilities for demo). Also prints the hit rate
 * and how often each category lands, to tune the demo profile.
 *
 *   npm run classic:rtp
 */
import raw from '../config.json';
import { evaluateLines, resolveConfig, type RawSlotConfig } from '@/engine/math';

const cfg = resolveConfig(raw as RawSlotConfig);
const LINES = cfg.paylines.length;
const CELLS = cfg.grid.cols * cfg.grid.rows;
const SCREEN_BYTES = Math.ceil(CELLS / 2);

// Node-only module, imported by a computed name (no @types/node in this browser project)
const fs: { readFileSync(p: string): Uint8Array } = await import('node:' + 'fs');
const data = fs.readFileSync('public/games/classic/screens.bin');
const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
const cats = data[5];
const header = 6 + cats * 4;

/** Mean win (× total bet) per category, in screens.bin order. */
const means: number[] = [];
let screen = 0;
for (let c = 0; c < cats; c++) {
  const count = view.getUint32(6 + c * 4, true);
  let sum = 0;
  for (let k = 0; k < count; k++, screen++) {
    const grid: string[][] = Array.from({ length: cfg.grid.cols }, () => []);
    for (let n = 0; n < CELLS; n++) {
      const b = data[header + screen * SCREEN_BYTES + (n >> 1)];
      grid[Math.floor(n / cfg.grid.rows)][n % cfg.grid.rows] = cfg.symbolIds[n % 2 === 0 ? (b >> 4) & 15 : b & 15];
    }
    sum += evaluateLines(cfg, grid).reduce((s, w) => s + w.multiplier, 0) / LINES;
  }
  means.push(count ? sum / count : 0);
}

const profiles: [string, number[], number][] = [
  ['real', raw.payoutDistribution.map(d => d.probability), raw.rtp],
  ['demo', raw.demo.payoutProbabilities, raw.demo.rtp],
];
for (const [name, probs, configured] of profiles) {
  const rtp = probs.reduce((s, p, i) => s + p * means[i], 0);
  const total = probs.reduce((s, p) => s + p, 0);
  console.log(`\n${name}: RTP ${(rtp * 100).toFixed(2)}% (config.rtp ${(configured * 100).toFixed(0)}%), ` +
    `hit rate ${((1 - probs[0]) * 100).toFixed(1)}%, Σp = ${total.toFixed(6)}`);
  raw.payoutDistribution.forEach((d, i) => {
    const p = probs[i];
    console.log(`  ${d.type.padEnd(7)} p ${p.toFixed(6)}  1 in ${(1 / p).toFixed(1).padStart(8)}  mean ${means[i].toFixed(2).padStart(7)}×  share ${(p * means[i] / rtp * 100).toFixed(1)}%`);
  });
}
