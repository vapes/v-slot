export interface WinResult {
  paylineIndex: number;
  symbol: string;
  count: number;
  /** Multiplier of the line bet. */
  multiplier: number;
  positions: [number, number][]; // [reel, row]
}

export interface SpinResult {
  /** Visible grid: grid[reel][row] */
  grid: string[][];
  wins: WinResult[];
  /** Sum of all line multipliers (× line bet). */
  totalWin: number;
}
