import { resolveConfig, type RawSlotConfig, type SlotConfig } from '../src/engine/math';

/** Minimal 3-reel × 3-row config for engine tests; override anything. */
export function testConfig(over: Partial<RawSlotConfig> = {}): SlotConfig {
  const raw: RawSlotConfig = {
    id: 'test', title: 'Test',
    canvas: { width: 300, height: 400 }, backgroundColor: '0x000000',
    grid: { rows: 3, cols: 3 }, symbol: { width: 100, height: 100, gap: 0 }, reelOffsetY: 0,
    currency: { code: 'EUR', decimals: 2 }, startBalance: 10000, betOptions: [30, 60], defaultBetIndex: 0,
    homeButton: { x: 0, y: 0 },
    spin: {
      reelStartInterval: 0, bounceUp: { amount: 0, duration: 1 }, spinSpeed: 10, turboSpeedMultiplier: 1,
      acceleration: 1, blurAlpha: 1, scrollScreens: [1, 1, 1], bounceDown: { amount: 0, duration: 1 },
      settle: { duration: 1 }, winAllDelay: 0, winLineInterval: 0,
    },
    celebration: { big: 2, huge: 5, epic: 20, max: 50 },
    rtp: 0.96, wild: 'W',
    symbols: [{ id: 'W', weight: 1 }, { id: 'A', weight: 1 }, { id: 'B', weight: 1 }, { id: 'S', weight: 1 }],
    paytable: { A: { '2': 2, '3': 10 }, B: { '3': 300 } },
    paylines: [[0, 0, 0], [1, 1, 1], [2, 2, 2]],
    ...over,
  };
  return resolveConfig(raw);
}

/** grid[reel][row] from rows written left→right, top→bottom. */
export function gridFromRows(rows: string[][]): string[][] {
  return rows[0].map((_, reel) => rows.map(r => r[reel]));
}
