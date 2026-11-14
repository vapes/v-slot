/** Shape of config.json → "respin" (Dragon's Nest feature). Values are × TOTAL bet. */
export interface RespinConfig {
  /** Base-game scatter that triggers the feature (the egg). */
  scatter: string;
  /** Symbol that sticks during the respins and carries the cash values (the dragon). */
  sticky: string;
  /** Scatters needed anywhere on screen. */
  trigger: number;
  /** Respins granted at start and after every new sticky symbol. */
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
