/** Shape of config.json → "respin" (Dragon's Nest feature). Values are × TOTAL bet. */
export interface RespinConfig {
  /** Base-game scatters → respins each one grants (egg 1, dragon "super scatter" 3). */
  scatters: Record<string, number>;
  /** Symbol that sticks during the respins, carries a cash value and substitutes on lines (the wild). */
  sticky: string;
  /** Scatters (any mix) needed anywhere on screen. */
  trigger: number;
  /** A new sticky symbol tops the respin counter up to at least this value. */
  respins: number;
  /** Sticky value table: x = × total bet, w = weight, tag = jackpot name (i18n `feature.jackpot.<tag>`). */
  values: { x: number; w: number; tag?: string }[];
  /** Prize for filling every cell, × total bet. */
  grand: number;
  /** Symbol counts per nest reel (input of tools/build-reels.mjs). */
  composition: Record<string, number | undefined>[];
}

/** Everything DragonMath needs for one play mode (real / demo). */
export interface MathProfile {
  /** Base reel strips (strips.json → <mode>.reels). */
  reels: string[][];
  /** Nest reel strips used during respins (strips.json → <mode>.nest). */
  nest: string[][];
  respin: RespinConfig;
}

export type MathMode = 'real' | 'demo';

/** Merge the real profile with the demo overrides from config.json → demo. */
export function buildProfile(
  raw: { respin: RespinConfig; demo?: { respin?: Partial<RespinConfig> } },
  strips: Record<MathMode, { reels: string[][]; nest: string[][] }>,
  mode: MathMode,
): MathProfile {
  const respin = mode === 'demo' ? { ...raw.respin, ...raw.demo?.respin } : raw.respin;
  return { reels: strips[mode].reels, nest: strips[mode].nest, respin };
}
