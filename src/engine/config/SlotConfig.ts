/**
 * Slot configuration contract shared by every game.
 *
 * Each game owns `src/games/<id>/config.json`; annotating the JSON import as
 * `RawSlotConfig` makes the compiler validate it. Game-specific extra keys
 * (skin anchors, reel strips, payout distributions…) are allowed and read only
 * by that game's own code. `resolveConfig()` adds derived geometry.
 */
export interface RawSlotConfig {
  id: string;
  title: string;
  canvas: { width: number; height: number };
  /** Pixi clear colour, e.g. "0x0D0D1A". */
  backgroundColor: string;
  grid: { rows: number; cols: number };
  symbol: { width: number; height: number; gap: number };
  /** Omit to centre the reel area horizontally. */
  reelOffsetX?: number;
  reelOffsetY: number;
  reelStyle?: {
    /** Rounded panel drawn behind the reels. */
    background?: string;
    /** Thin grid lines between cells. */
    separators?: { color: string; alpha: number; width: number };
  };
  /** Money is stored in minor units (cents); `decimals` says how many. */
  currency: { code: string; decimals: number };
  startBalance: number;
  /** Total-bet options in minor units; each must divide by paylines.length. */
  betOptions: number[];
  defaultBetIndex: number;
  /** Home (back to lobby) button centre in game pixels. */
  homeButton: { x: number; y: number };
  spin: {
    reelStartInterval: number;
    bounceUp: { amount: number; duration: number };
    spinSpeed: number;
    turboSpeedMultiplier: number;
    acceleration: number;
    blurAlpha: number;
    /** Distance-based spin: blur screens per reel. Ignored when stopTimesMs is set. */
    scrollScreens?: number[];
    /** Time-based spin: landing time of each reel, ms from spin start. */
    stopTimesMs?: number[];
    /** Quick spin / hold-turbo: all reels land together after this many ms. */
    quickStopMs?: number;
    /** Holding SPIN this long after a press slams the reels (hold-to-turbo). */
    holdToTurboMs?: number;
    bounceDown: { amount: number; duration: number };
    settle: { duration: number };
    winAllDelay: number;
    winLineInterval: number;
    autoplayWinPause?: number;
    autoplayPause?: number;
  };
  /** How wins are presented after the reels land (all optional). */
  winPresentation?: {
    /** Draw payline paths over the reels. */
    drawLines?: boolean;
    /** Count-up length by win ÷ total bet: first tier whose `below` exceeds the ratio wins. */
    rollup?: { below: number; ms: number }[];
    /** Count-up length for banner wins, per celebration tier. */
    bigRollupMs?: { big: number; huge: number; epic: number; max: number };
    /** Payline colours ("0xRRGGBB"), cycled by line index. */
    lineColors?: string[];
  };
  /** Win ÷ total bet thresholds for the BIG/HUGE/EPIC/MAX banners. */
  celebration: { big: number; huge: number; epic: number; max: number };
  rtp: number;
  /** Symbol id that substitutes for all others (pays nothing itself). */
  wild?: string | null;
  /** `weight` drives only the random "blur" symbols during spin. */
  symbols: { id: string; name?: string; weight: number }[];
  /** symbol → match count → multiplier of the line bet. */
  paytable: Record<string, Record<string, number>>;
  /** One row index per reel, left to right. */
  paylines: number[][];
}

export interface SlotConfig extends RawSlotConfig {
  reelOffsetX: number;
  reelWidth: number;
  cellHeight: number;
  reelAreaWidth: number;
  reelAreaHeight: number;
  symbolIds: string[];
  symbolName(id: string): string;
}

export function resolveConfig(raw: RawSlotConfig): SlotConfig {
  const reelWidth = raw.symbol.width + raw.symbol.gap;
  const cellHeight = raw.symbol.height + raw.symbol.gap;
  const reelAreaWidth = raw.grid.cols * reelWidth;
  const names = new Map(raw.symbols.map(s => [s.id, s.name ?? s.id]));
  return {
    ...raw,
    reelOffsetX: raw.reelOffsetX ?? (raw.canvas.width - reelAreaWidth) / 2,
    reelWidth,
    cellHeight,
    reelAreaWidth,
    reelAreaHeight: raw.grid.rows * cellHeight,
    symbolIds: raw.symbols.map(s => s.id),
    symbolName: (id) => names.get(id) ?? id,
  };
}

/** Parse "0xRRGGBB" / "#RRGGBB" colour strings from JSON. */
export function color(value: string): number {
  return Number(value.replace('#', '0x'));
}
