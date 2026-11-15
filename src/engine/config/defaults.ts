/**
 * Engine defaults — the ONLY place for fallback timings and feel numbers.
 * resolveConfig() merges them under the game's config.json values, so
 * engine code reads resolved fields (cfg.timing, cfg.featureTiming, cfg.tease)
 * and never carries its own `?? 1400`.
 */
export const TIMING_DEFAULTS = {
  /** Turbo (hold): winners framed this long before the next spin. */
  turboWinMs: 300,
  /** Turbo: BIG/HUGE/… banner shown statically this long. */
  turboBannerMs: 500,
  /** Autoplay pause after a winning / losing spin. */
  autoplayWinPauseMs: 1600,
  autoplayPauseMs: 250,
};

export const FEATURE_TIMING_DEFAULTS = {
  /** Trigger scatters pulse before the intro banner. */
  triggerMs: 1200,
  /** "CONGRATULATIONS! YOU WON N RESPINS" window (a tap closes it earlier). */
  introMs: 3200,
  /** Pause after the triggering cells became sticky. */
  stickMs: 600,
  /** Pause after a respin that landed new sticky cells. */
  newStickyMs: 450,
  /** Respins added by a new sticky cell fly from it into the counter this long. */
  flyMs: 800,
  /** Line wins of a respin are shown this long. */
  stepWinMs: 900,
  stepPauseMs: 300,
  /** Per sticky cell during the final collect. */
  collectMs: 130,
  grandMs: 2600,
  /** "TOTAL WIN" window (a tap closes it earlier). */
  outroMs: 3200,
  /** Every feature timing is multiplied by this in turbo / quick spins. */
  fastFactor: 0.4,
};

export const ANTICIPATION_DEFAULTS = {
  enabled: true,
  startReel: 2,
  minCategory: 'huge',
  scatter: null as string | null,
  scatters: [] as string[],
  scatterTrigger: 3,
  extraMs: 1400,
  speedBoost: 1.6,
  colors: ['0xFFE9A0', '0xFF6A00'],
  style: 'flame',
  veil: 0.32,
  /** null = on for "flame", off for "marquee". */
  sparks: null as boolean | null,
};

/**
 * Symbol landing animation (config.symbols[].landing / turboLanding): played on
 * the visible cells of that symbol when its reel stops. Every field optional.
 */
export const LANDING_DEFAULTS = {
  /** Whole animation length. */
  ms: 650,
  /** Diagonal light bands sweeping across the cell, one after another. */
  sweeps: 2,
  /** Peak of the pop scale (1 = no pop). */
  scale: 1.12,
  /** Total hue rotation in degrees during the animation (0 = none; 360 = full iridescent pass). */
  hue: 0,
  /** Peak brightness flash over the cell, 0..1. */
  flash: 0.45,
  /** Colour of the light bands / flash, "0xRRGGBB". */
  color: '0xFFF6C8',
};
