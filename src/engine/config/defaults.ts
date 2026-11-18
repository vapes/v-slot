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

/**
 * Win box (GameView.winBox): animated win counter in the HUD; BIG+ wins ride
 * onto the reels and count up tier by tier (config.winBox overrides any field).
 * Not used in turbo / quick spins.
 */
export const WINBOX_DEFAULTS = {
  /** Small win (under BIG): count-up length. */
  tickMs: 700,
  /** BIG+ win: count-up to the BIG threshold before the box leaves its place. */
  climbMs: 600,
  /** BIG+ win: count-up through one tier (BIG → HUGE → EPIC → MAX). */
  stageMs: 2200,
  /** Shortest last partial tier, share of stageMs. */
  minStage: 0.35,
  /** Box flight between its place and the reels (each way). */
  rideMs: 450,
  /** Final amount held on the reels before the box returns (a tap skips). */
  holdMs: 1800,
  /** Box scale while on the reels. */
  bigScale: 1.9,
  /** Screen dim behind the box on the reels. */
  shade: 0.55,
  /** Win counter text refresh (text re-rasterises on change; ≈ 30 per second is plenty). */
  refreshMs: 33,
  /** Per tier BIG / HUGE / EPIC / MAX: coins per second from the box … */
  coinRate: [14, 30, 55, 90],
  /** … coins per second raining from the top … */
  rainRate: [0, 8, 24, 45],
  /** … and the coin burst when the tier title appears. */
  burst: [20, 35, 55, 80],
};

/** Info line under the reels ("LINE 3: 4× … — amount", engine `ui/LineInfo`); config.lineInfo overrides. */
export const LINE_INFO_DEFAULTS = {
  /** Centre y in game px; null = just below the reels. */
  y: null as number | null,
  /** Gap between the reels' bottom edge and the pill when `y` is null. */
  gap: 6,
};

/**
 * Drop mode (config.drop): reels do not spin — symbols fall like pebbles.
 * The old screen falls out, the new one drops in reel by reel
 * (spin.reelStartInterval), winning cells burst and the rest tumbles down.
 * Frames are 60 fps frames; config.drop overrides any field.
 */
export const DROP_DEFAULTS = {
  /** Gravity, px per frame² (turbo / slam stop multiply it by turboGravity). */
  gravity: 2.2,
  turboGravity: 2.5,
  /** Start delay between rows of one reel (bottom row first), frames. */
  rowDelay: 2.5,
  /** Delay between the old screen leaving and the new one dropping in, frames. */
  refillDelay: 4,
  /** Pebble bounce after a landing: height (share of a cell) and length, frames. */
  bounce: 0.1,
  bounceFrames: 12,
  /** Winning cells are shown this long before they burst, ms. */
  winMs: 900,
  /** Burst of the winning cells, ms. */
  popMs: 320,
  /** Pause after a tumble landed, ms. */
  tumblePauseMs: 150,
  /** Multiplier cells pulse, then fly into the win box, ms. */
  multiplierMs: 700,
  flyMs: 650,
  /** Every drop-mode timing (ms) in turbo / quick spins is multiplied by this. */
  fastFactor: 0.45,
  /** Free spins: number of spins awarded by a retrigger is shown this long, ms. */
  retriggerMs: 1800,
  /** Pause between free spins, ms. */
  freeSpinPauseMs: 350,
};
