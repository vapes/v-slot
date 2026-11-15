import { ANTICIPATION_DEFAULTS, FEATURE_TIMING_DEFAULTS, LANDING_DEFAULTS, TIMING_DEFAULTS, WINBOX_DEFAULTS, LINE_INFO_DEFAULTS } from './defaults';

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
    separators?: { color: string; alpha: number; width: number; /** draw horizontal lines too (default true) */ rows?: boolean };
  };
  /**
   * Money is stored in minor units (cents); `decimals` says how many.
   * With `symbol` amounts render as "$5,420.50"; otherwise "5 420.50 PLN".
   */
  currency: { code: string; decimals: number; symbol?: string; thousands?: string };
  startBalance: number;
  /** Total-bet options in minor units; each must divide by paylines.length. */
  betOptions: number[];
  defaultBetIndex: number;
  /** Home (back to lobby) button centre in game pixels — top-left corner by convention. */
  homeButton: { x: number; y: number; r?: number };
  /** Sound on/off toggle centre in game pixels — top-right corner by convention. */
  soundButton?: { x: number; y: number; r?: number };
  spin: {
    reelStartInterval: number;
    bounceUp: { amount: number; duration: number };
    spinSpeed: number;
    turboSpeedMultiplier: number;
    acceleration: number;
    blurAlpha: number;
    scrollScreens: number[];
    bounceDown: { amount: number; duration: number };
    settle: { duration: number };
    winAllDelay: number;
    winLineInterval: number;
    autoplayWinPause?: number;
    /** Turbo (hold): winners framed this long, ms. */
    turboWinMs?: number;
    /** Turbo: celebration banner shown statically this long, ms. */
    turboBannerMs?: number;
    autoplayPause?: number;
  };
  /** Bonus-feature playback (sticky respins). All optional, ms unless noted. */
  feature?: {
    /** Centre y of the respin meter (game px); default: just above the reels. */
    meterY?: number;
    introMs?: number;
    outroMs?: number;
    /** Pause after each respin (longer when it had line wins). */
    stepPauseMs?: number;
    /** Per sticky cell during the final collect. */
    collectMs?: number;
    triggerMs?: number;
    stickMs?: number;
    newStickyMs?: number;
    /** Flight of the added respins from a new sticky cell into the counter. */
    flyMs?: number;
    stepWinMs?: number;
    grandMs?: number;
    /** Multiplier for every feature timing in turbo / quick spins. */
    fastFactor?: number;
  };
  /**
   * Anticipation (reel tease): a reel keeps spinning longer and faster with a
   * particle/shader effect when the reels already landed are one symbol away
   * from the feature or from a win of `minCategory` or more. Never in turbo
   * (hold or TURBO toggle). Optional; disabled when omitted.
   */
  anticipation?: {
    enabled?: boolean;
    /** First reel (0-based) that may anticipate; default 2 (the 3rd reel). */
    startReel?: number;
    /** Lowest celebration tier worth a tease: big | huge | epic | max; default "huge" (≈ MEGA). */
    minCategory?: string;
    /** Feature scatter id and how many trigger it (tease at trigger − 1). */
    scatter?: string;
    /** Several scatter ids that count together towards the trigger (e.g. egg + dragon). */
    scatters?: string[];
    scatterTrigger?: number;
    /** Extra spin time of an anticipating reel, ms (default 1400). */
    extraMs?: number;
    /** Top-speed multiplier while anticipating (default 1.6). */
    speedBoost?: number;
    /** Effect colours: [core, outer glow], "0xRRGGBB". */
    colors?: string[];
    /** Visual style: "flame" (GLSL fire + sparks, default) or "marquee" (chasing casino bulbs). */
    style?: string;
    /** Dim veil over the other reels, 0..1 (default 0.32). */
    veil?: number;
    /** Rising spark particles (default: on for flame, off for marquee). */
    sparks?: boolean;
  };
  /** Win box timings / particle rates (see WINBOX_DEFAULTS); used when the view has a `winBox`. */
  winBox?: Partial<typeof WINBOX_DEFAULTS>;
  /** Info line under the reels (see LINE_INFO_DEFAULTS). */
  lineInfo?: Partial<typeof LINE_INFO_DEFAULTS>;
  /** Feature buy: price = `cost` × total bet; the math must trigger the feature (SpinOptions.buyFeature). */
  buyFeature?: { cost: number };
  /** Win ÷ total bet thresholds for the BIG/HUGE/EPIC/MAX banners. */
  celebration: { big: number; huge: number; epic: number; max: number };
  rtp: number;
  /** Symbol id that substitutes for all others (pays nothing itself). */
  wild?: string | null;
  /**
   * `weight` drives only the random "blur" symbols during spin. `landing` /
   * `turboLanding`: animation played on this symbol's visible cells when its
   * reel stops in a normal / turbo (or quick) spin; none if absent.
   */
  symbols: { id: string; name?: string; weight: number; landing?: LandingAnimation; turboLanding?: LandingAnimation }[];
  /** symbol → match count → multiplier of the line bet. */
  paytable: Record<string, Record<string, number>>;
  /** One row index per reel, left to right. */
  paylines: number[][];
}

export type TeaseConfig = typeof ANTICIPATION_DEFAULTS;
export type LandingConfig = typeof LANDING_DEFAULTS;
/** Landing animation as written in config.json (see LANDING_DEFAULTS). */
export type LandingAnimation = Partial<LandingConfig>;

export interface SlotConfig extends RawSlotConfig {
  /** Spin pacing with engine defaults applied (see config/defaults.ts). */
  timing: typeof TIMING_DEFAULTS;
  /** Feature playback timings with defaults applied. */
  featureTiming: typeof FEATURE_TIMING_DEFAULTS;
  /** Win box settings with defaults applied. */
  winBox: typeof WINBOX_DEFAULTS;
  /** Info line settings with defaults applied. */
  lineInfo: typeof LINE_INFO_DEFAULTS;
  /** Resolved anticipation settings, or null when the game has none / disabled it. */
  tease: TeaseConfig | null;
  reelOffsetX: number;
  reelWidth: number;
  cellHeight: number;
  reelAreaWidth: number;
  reelAreaHeight: number;
  symbolIds: string[];
  symbolName(id: string): string;
  /** Resolved landing animation of a symbol for a normal / turbo stop, or null. */
  landing(id: string, turbo: boolean): LandingConfig | null;
}

export function resolveConfig(raw: RawSlotConfig): SlotConfig {
  const reelWidth = raw.symbol.width + raw.symbol.gap;
  const cellHeight = raw.symbol.height + raw.symbol.gap;
  const reelAreaWidth = raw.grid.cols * reelWidth;
  const names = new Map(raw.symbols.map(s => [s.id, s.name ?? s.id]));
  const landings = new Map(raw.symbols.map(s => [s.id, {
    normal: s.landing ? { ...LANDING_DEFAULTS, ...s.landing } : null,
    turbo: s.turboLanding ? { ...LANDING_DEFAULTS, ...s.turboLanding } : null,
  }]));
  const s = raw.spin;
  const tease = raw.anticipation && raw.anticipation.enabled !== false
    ? { ...ANTICIPATION_DEFAULTS, ...raw.anticipation } as TeaseConfig
    : null;
  return {
    ...raw,
    timing: {
      turboWinMs: s.turboWinMs ?? TIMING_DEFAULTS.turboWinMs,
      turboBannerMs: s.turboBannerMs ?? TIMING_DEFAULTS.turboBannerMs,
      autoplayWinPauseMs: s.autoplayWinPause ?? TIMING_DEFAULTS.autoplayWinPauseMs,
      autoplayPauseMs: s.autoplayPause ?? TIMING_DEFAULTS.autoplayPauseMs,
    },
    featureTiming: { ...FEATURE_TIMING_DEFAULTS, ...raw.feature },
    winBox: { ...WINBOX_DEFAULTS, ...raw.winBox },
    lineInfo: { ...LINE_INFO_DEFAULTS, ...raw.lineInfo },
    tease,
    reelOffsetX: raw.reelOffsetX ?? (raw.canvas.width - reelAreaWidth) / 2,
    reelWidth,
    cellHeight,
    reelAreaWidth,
    reelAreaHeight: raw.grid.rows * cellHeight,
    symbolIds: raw.symbols.map(s => s.id),
    symbolName: (id) => names.get(id) ?? id,
    landing: (id, turbo) => (turbo ? landings.get(id)?.turbo : landings.get(id)?.normal) ?? null,
  };
}

/** Parse "0xRRGGBB" / "#RRGGBB" colour strings from JSON. */
export function color(value: string): number {
  return Number(value.replace('#', '0x'));
}
