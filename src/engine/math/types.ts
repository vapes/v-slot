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

/**
 * One cascade ("tumble") of a drop-mode game: the wins of the grid on screen
 * are removed, the symbols above fall down and new ones drop in from the top.
 */
export interface TumbleStep {
  /** Wins of the grid BEFORE this tumble (their cells are removed). */
  wins: WinResult[];
  /** Sum of `wins` (× line bet). */
  win: number;
  /** Removed cells [reel, row]. */
  removed: [number, number][];
  /** Grid after the collapse + refill (cells may carry a value, see cellValue). */
  grid: string[][];
}

/** Multiplier cells applied to the tumble win at the end of a spin. */
export interface MultiplierResult {
  /** Multiplier cells on the final grid [reel, row]. */
  cells: [number, number][];
  /** Sum of the cells' values landed in this spin. */
  sum: number;
  /** Multiplier applied to the tumble win (sum, or an accumulated one in free spins). */
  applied: number;
  /** Tumble win before the multiplier (× line bet). */
  base: number;
}

/** One free spin: a full drop-mode spin result plus counters after it. */
export interface FreeSpin {
  result: SpinResult;
  /** Free spins left after this one (retriggers included). */
  spinsLeft: number;
  /** Free spins added by this spin (retrigger), 0 if none. */
  added: number;
  /** Accumulated multiplier after this spin (0 = none yet). */
  multiplier: number;
}

/** Free-spins round decided up front by the math; the engine plays it back. */
export interface FreeSpinsRound {
  kind: 'freespins';
  /** Scatter cells that triggered it (on the final base grid). */
  trigger: [number, number][];
  /** Scatter pay for the trigger (× line bet), already part of the base spin's totalWin. */
  scatterWin: number;
  initialSpins: number;
  spins: FreeSpin[];
  /** Sum of every free spin's totalWin (× line bet). */
  totalWin: number;
}

export interface SpinResult {
  /** Visible grid: grid[reel][row] (drop mode: the grid that drops in, before tumbles). */
  grid: string[][];
  wins: WinResult[];
  /** Sum of all line multipliers (× line bet) of the base spin (drop mode: tumbles × multiplier + scatter pay). */
  totalWin: number;
  /** Bonus round triggered by this spin, played after the reels stop. */
  feature?: FeatureRound;
  /** Drop mode: cascades after the first drop, in order (empty / absent = no win). */
  tumbles?: TumbleStep[];
  /** Drop mode: multiplier cells applied to the tumble win. */
  multiplier?: MultiplierResult;
  /** Drop mode: free spins triggered by this spin. */
  freeSpins?: FreeSpinsRound;
}
