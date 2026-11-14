import { Container, Text, TextStyle } from 'pixi.js';
import type { SlotConfig } from '../config/SlotConfig';
import { t } from '../i18n/I18n';

export type WinCategory = 'big' | 'huge' | 'epic' | 'max';

const FONT_SIZE = 88;
const LINE_HALF = FONT_SIZE * 0.58;  // half gap between the two lines

// Durations in PixiJS frames (@ 60 fps)
const ENTER = 24;
const HOLD  = 22;
const EXIT  = 15;

/** Banner words come from i18n (`celebration.<category>`, `celebration.win`). */
const firstWord = (c: WinCategory): string => t(`celebration.${c}`);

interface ActiveBanner {
  text: Text;
  fromX: number;  // start X (off-screen)
  toX: number;    // end X (off-screen, opposite side)
  elapsed: number;
  enterDur: number;
  holdDur: number;
  exitDur: number;
  done: boolean;
}

/** Decelerates into target — arrives smoothly, no overshoot. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Accelerates away from start. */
function easeInCubic(t: number): number {
  return t * t * t;
}

function makeText(label: string): Text {
  return new Text(label, new TextStyle({
    fontFamily:      'Arial Black, Arial, sans-serif',
    fontSize:        FONT_SIZE,
    fontWeight:      'bold',
    fill:            ['#FFF8D0', '#FFD34A', '#FF8A00', '#C2410C'],
    fillGradientStops: [0, 0.4, 0.75, 1],
    stroke:          0x3A0A00,
    strokeThickness: 10,
    dropShadow:      true,
    dropShadowDistance: 4,
    dropShadowBlur:     10,
    dropShadowAlpha:    0.85,
    align:           'center',
  }));
}

/**
 * Win celebration: two words fly in from opposite sides and meet at
 * the centre of the reel grid.
 *
 *   ←——— BIG  ———→        (top line, enters from left, exits right)
 *   ←——— WIN  ———→        (bottom line, enters from right, exits left)
 */
export class WinCelebration {
  readonly container: Container;
  private banners: ActiveBanner[] = [];
  private staticTimer: ReturnType<typeof setTimeout> | null = null;
  /** Centre of the reel grid and off-screen start offset. */
  private readonly rcx: number;
  private readonly rcy: number;
  private readonly off: number;

  constructor(cfg: SlotConfig) {
    this.rcx = cfg.reelOffsetX + cfg.reelAreaWidth / 2;
    this.rcy = cfg.reelOffsetY + cfg.reelAreaHeight / 2;
    this.off = cfg.canvas.width + 350;
    this.container = new Container();
    this.container.visible = false;
  }

  /** Show celebration text statically at centre for durationMs, then hide. */
  playStatic(category: WinCategory, durationMs: number): void {
    this.stop();

    const word1 = makeText(firstWord(category));
    const word2 = makeText(t('celebration.win'));

    word1.anchor.set(0.5, 0.5);
    word2.anchor.set(0.5, 0.5);

    word1.x = this.rcx;
    word1.y = this.rcy - LINE_HALF;
    word2.x = this.rcx;
    word2.y = this.rcy + LINE_HALF;

    this.container.addChild(word1, word2);
    this.container.visible = true;

    this.staticTimer = setTimeout(() => {
      this.staticTimer = null;
      this.stop();
    }, durationMs);
  }

  play(category: WinCategory): void {
    this.stop();

    const word1 = makeText(firstWord(category));
    const word2 = makeText(t('celebration.win'));

    word1.anchor.set(0.5, 0.5);
    word2.anchor.set(0.5, 0.5);

    // Top line: "BIG" etc. — enters from left, exits right
    word1.x = -this.off;
    word1.y = this.rcy - LINE_HALF;

    // Bottom line: "WIN" — enters from right, exits left
    word2.x = this.off;
    word2.y = this.rcy + LINE_HALF;

    this.container.addChild(word1, word2);

    this.banners.push(
      { text: word1, fromX: -this.off, toX:  this.off, elapsed: 0, enterDur: ENTER, holdDur: HOLD, exitDur: EXIT, done: false },
      { text: word2, fromX:  this.off, toX: -this.off, elapsed: 0, enterDur: ENTER, holdDur: HOLD, exitDur: EXIT, done: false },
    );

    this.container.visible = true;
  }

  update(dt: number): void {
    if (this.banners.length === 0) return;

    let allDone = true;

    for (const b of this.banners) {
      if (b.done) continue;

      b.elapsed += dt;
      const t = b.elapsed;
      const total = b.enterDur + b.holdDur + b.exitDur;

      if (t >= total) {
        b.done = true;
        b.text.scale.set(1);
        b.text.visible = false;
        continue;
      }

      allDone = false;

      if (t < b.enterDur) {
        // Decelerate into centre — no overshoot
        const p = easeOutCubic(t / b.enterDur);
        b.text.x = b.fromX + (this.rcx - b.fromX) * p;
        b.text.scale.set(1);
      } else if (t < b.enterDur + b.holdDur) {
        // Hold at centre; scale pulses once (elastic feel without position bounce)
        b.text.x = this.rcx;
        const hp = (t - b.enterDur) / b.holdDur;
        const pulse = 1 + 0.18 * Math.sin(Math.PI * hp);
        b.text.scale.set(pulse);
      } else {
        // Accelerate out — continues in the same direction
        b.text.scale.set(1);
        const p = easeInCubic((t - b.enterDur - b.holdDur) / b.exitDur);
        b.text.x = this.rcx + (b.toX - this.rcx) * p;
      }
    }

    if (allDone) this.stop();
  }

  stop(): void {
    if (this.staticTimer !== null) {
      clearTimeout(this.staticTimer);
      this.staticTimer = null;
    }
    this.banners.forEach(b => b.text.destroy());
    this.banners = [];
    // destroy any remaining children (e.g. from playStatic)
    while (this.container.children.length > 0) {
      this.container.children[0].destroy();
    }
    this.container.visible = false;
  }
}

/** Maps win ÷ total bet to a banner category using cfg.celebration thresholds. */
export function getWinCategory(cfg: SlotConfig, winAmount: number, totalBet: number): WinCategory | null {
  const x = winAmount / totalBet;
  const t = cfg.celebration;
  if (x >= t.max)  return 'max';
  if (x >= t.epic) return 'epic';
  if (x >= t.huge) return 'huge';
  if (x >= t.big)  return 'big';
  return null;
}
