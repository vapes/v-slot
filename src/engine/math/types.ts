export interface WinResult {
  paylineIndex: number;
  symbol: string;
  count: number;
  /** Multiplier of the line bet. */
  multiplier: number;
  positions: [number, number][]; // [reel, row]
}

/** A cell that stays in place during a feature (e.g. a sticky egg with a cash value). */
export interface StickyCell {
  reel: number;
  row: number;
  symbol: string;
  /** Cash value as a multiple of the LINE bet (0 = none). */
  value: number;
  /** Optional jackpot tag shown instead of the value (i18n key suffix, e.g. "mini"). */
  tag?: string;
}

/** One respin of a sticky-respin feature, fully decided by the math. */
export interface FeatureStep {
  /** Visible grid after this respin (sticky cells included). */
  grid: string[][];
  /** Line wins of this respin (× line bet). */
  wins: WinResult[];
  lineWin: number;
  /** Cells that became sticky on this respin. */
  newSticky: StickyCell[];
  /** Respins left after this one. */
  respinsLeft: number;
}

/**
 * Sticky-respin feature (Hold & Respin style). Everything is decided up front
 * (server-style); the engine only plays it back.
 */
export interface FeatureRound {
  kind: 'respins';
  /** Symbols that can appear on the feature reels (used for the spin blur). */
  reelSymbols?: string[];
  /** Scatter positions that triggered the feature. */
  trigger: [number, number][];
  /** Sticky cells at the start (usually the triggering scatters). */
  initialSticky: StickyCell[];
  initialRespins: number;
  steps: FeatureStep[];
  /** Sum of all sticky values at the end (× line bet). */
  collect: number;
  /** Extra prize for filling every cell (× line bet), 0 if not reached. */
  fullBonus: number;
  /** collect + fullBonus + all step line wins (× line bet). */
  totalWin: number;
}

export interface SpinResult {
  /** Visible grid: grid[reel][row] */
  grid: string[][];
  wins: WinResult[];
  /** Sum of all line multipliers (× line bet) of the base spin. */
  totalWin: number;
  /** Bonus round triggered by this spin, played after the reels stop. */
  feature?: FeatureRound;
}
