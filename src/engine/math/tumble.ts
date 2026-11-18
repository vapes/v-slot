import type { TumbleStep, WinResult } from './types';

/**
 * Collapse one grid after removing `removed` cells: in every reel the cells
 * left fall down (keep their order), `refill(reel, n)` supplies n new cells
 * for the top (top → bottom). Pure; returns a new grid.
 */
export function collapseGrid(
  grid: string[][], removed: [number, number][], refill: (reel: number, count: number) => string[],
): string[][] {
  const gone = new Set(removed.map(([r, row]) => `${r},${row}`));
  return grid.map((col, reel) => {
    const kept = col.filter((_, row) => !gone.has(`${reel},${row}`));
    const n = col.length - kept.length;
    return n > 0 ? [...refill(reel, n), ...kept] : [...col];
  });
}

export interface TumbleRun {
  steps: TumbleStep[];
  /** Grid after the last tumble. */
  finalGrid: string[][];
  /** Sum of every step's win (× line bet). */
  totalWin: number;
}

/**
 * Cascade until the grid stops paying: evaluate → remove winning cells →
 * collapse + refill → repeat. `evaluate` decides what pays (e.g.
 * evaluateAnywhere); `refill` draws the new cells (game math, seedable).
 */
export function runTumbles(
  grid: string[][],
  evaluate: (grid: string[][]) => WinResult[],
  refill: (reel: number, count: number) => string[],
  maxSteps = 100,
): TumbleRun {
  const steps: TumbleStep[] = [];
  let current = grid;
  let totalWin = 0;
  for (let i = 0; i < maxSteps; i++) {
    const wins = evaluate(current);
    if (!wins.length) break;
    const seen = new Set<string>();
    const removed: [number, number][] = [];
    for (const w of wins) for (const [r, row] of w.positions) {
      const key = `${r},${row}`;
      if (!seen.has(key)) {
        seen.add(key);
        removed.push([r, row]);
      }
    }
    const win = wins.reduce((s, w) => s + w.multiplier, 0);
    current = collapseGrid(current, removed, refill);
    steps.push({ wins, win, removed, grid: current });
    totalWin += win;
  }
  return { steps, finalGrid: current, totalWin };
}
