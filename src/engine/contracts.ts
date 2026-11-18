import type { WinBoxLayout } from './ui/winBoxStyle';
/**
 * Contracts between the engine and a game. A game is a folder in
 * src/games/<id>/ whose index.ts default-exports a GameDefinition.
 * The engine never imports from games; games import only from '@/engine'.
 */
import type { Container } from 'pixi.js';
import type { SlotConfig } from './config/SlotConfig';
import type { SpinResult } from './math/types';

/** Visual of one reel cell; recycled while reels spin. */
export interface SymbolView {
  readonly display: Container;
  setSymbol(id: string): void;
  /** Optional caption on the symbol (sticky cash value / jackpot name); null hides it. */
  setValue?(label: string | null): void;
}

export interface SymbolRenderer {
  createView(id: string): SymbolView;
}

/** Produces spin outcomes. `load` runs once before the first spin. */
/** Per-spin options from the engine. */
export interface SpinOptions {
  /** Bought feature: the result must trigger the game's feature (config.buyFeature). */
  buyFeature?: boolean;
}

export interface MathModel {
  load?(): Promise<void>;
  spin(opts?: SpinOptions): SpinResult;
  /**
   * Screen shown before the first spin (after load): a grid the base game can
   * really land, without a win or a feature trigger. Without it the engine
   * keeps the random blur symbols (config.symbols[].weight; weight 0 = never).
   */
  initialGrid?(): string[][] | undefined;
}

/** The spin/stop button. Pointer input is routed by the engine via hitTest. */
export interface SpinControl {
  enabled: boolean;
  readonly isStopMode: boolean;
  setStopMode(stop: boolean): void;
  /** Coordinates are game pixels (canvas scale already removed). */
  hitTest(x: number, y: number): boolean;
}

/**
 * Game-drawn HUD values. Status line, win amount and line info are not here:
 * the engine shows them in its win box (GameView.winBox).
 * All money values are integer minor units (see SlotConfig.currency).
 */
export interface Hud {
  updateBalanceDisplay(balance: number, totalBet: number): void;
}

export interface BetControlsState {
  enabled: boolean;
  canDecrease: boolean;
  canIncrease: boolean;
  /** Feature buy is possible now (config.buyFeature set, idle, balance covers the price). */
  canBuy: boolean;
}

/** Commands a view may trigger from its own buttons. */
export interface GameActions {
  changeBet(delta: -1 | 1, wrap?: boolean): void;
  openPaytable(): void;
  togglePaytable(): void;
  toggleAutoplay(): void;
  toggleQuickSpin(): void;
  /** Ask to buy the feature (engine shows a confirmation with the price; needs config.buyFeature). */
  buyFeature(): void;
}

/**
 * Everything a game draws around the reels: background, buttons, HUD.
 * The paytable is HTML from the content CDN (engine HtmlPaytable); views only
 * open it through GameActions.
 */
export interface GameView {
  readonly spinButton: SpinControl;
  readonly hud: Hud;
  /**
   * Where the engine win box sits (centre + size in game px, usually over a
   * baked HUD panel) and its look. The engine owns it: status line, counting
   * win, line info; BIG+ wins ride onto the reels tier by tier.
   */
  readonly winBox: WinBoxLayout;
  /** Layers under the reels (background art, reel frame). */
  mountBelowReels(stage: Container): void;
  /** Buttons and HUD above the reels. */
  mountAboveReels(stage: Container): void;
  setBetControls(state: BetControlsState): void;
  setAutoplay?(on: boolean): void;
  setQuickSpin?(on: boolean): void;
  /** Bonus feature (e.g. respins) started / ended — switch background mood, hide base-only UI. */
  setFeatureMode?(on: boolean): void;
  update?(dt: number): void;
}

export interface GameDefinition {
  readonly config: SlotConfig;
  loadAssets?(): Promise<void>;
  createMath(): MathModel;
  createSymbolRenderer(): SymbolRenderer;
  createView(actions: GameActions): GameView;
}

/** Lightweight lobby entry; `load` lazily imports the game bundle. */
export interface GameManifest {
  id: string;
  title: string;
  subtitle: string;
  /** Path under public/, e.g. "games/dragon/thumb.jpg". */
  thumbnail: string;
  /** Card accent colour. */
  accent: number;
  load(): Promise<GameDefinition>;
}
