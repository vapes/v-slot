/** Shape of config.json → "respin" (Dragon's Nest feature). Values are × TOTAL bet. */
export interface RespinConfig {
  /** Scatter symbol id that triggers the feature and sticks. */
  scatter: string;
  /** Scatters needed anywhere on screen. */
  trigger: number;
  /** Respins granted at start and after every new scatter. */
  respins: number;
  /** Sticky value table: x = × total bet, w = weight, tag = jackpot name (i18n `feature.jackpot.<tag>`). */
  values: { x: number; w: number; tag?: string }[];
  /** Prize for filling every cell, × total bet. */
  grand: number;
  /** Symbol counts per nest reel (input of tools/build-reels.mjs). */
  composition: Record<string, number | undefined>[];
  /** Respin ("nest") reel strips — high symbols + scatter only (generated). */
  strips: string[][];
}
