import { Container, Text, TextStyle } from 'pixi.js';
import {
  REEL_OFFSET_X, REEL_OFFSET_Y,
  REEL_AREA_WIDTH, REEL_AREA_HEIGHT,
  GAME_WIDTH,
} from '../core/Config';

export type WinCategory = 'big' | 'huge' | 'epic' | 'max';

// Centre of the reel grid
const RCX = REEL_OFFSET_X + REEL_AREA_WIDTH / 2;
const RCY = REEL_OFFSET_Y + REEL_AREA_HEIGHT / 2;

const OFF = GAME_WIDTH + 350;  // off-screen horizontal padding

const FONT_SIZE = 96;
const LINE_HALF = FONT_SIZE * 0.58;  // half gap between the two lines

// Durations in PixiJS frames (@ 60 fps)
const ENTER = 24;
const HOLD  = 22;
const EXIT  = 15;

const FIRST_WORD: Record<WinCategory, string> = {
  big:  'BIG',
  huge: 'HUGE',
  epic: 'EPIC',
  max:  'MAX',
};

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
    fill:            0xFFFFFF,
    stroke:          0x000000,
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

  constructor() {
    this.container = new Container();
    this.container.visible = false;
  }

  play(category: WinCategory): void {
    this.stop();

    const word1 = makeText(FIRST_WORD[category]);
    const word2 = makeText('WIN');

    word1.anchor.set(0.5, 0.5);
    word2.anchor.set(0.5, 0.5);

    // Top line: "BIG" etc. — enters from left, exits right
    word1.x = -OFF;
    word1.y = RCY - LINE_HALF;

    // Bottom line: "WIN" — enters from right, exits left
    word2.x = OFF;
    word2.y = RCY + LINE_HALF;

    this.container.addChild(word1, word2);

    this.banners.push(
      { text: word1, fromX: -OFF, toX:  OFF, elapsed: 0, enterDur: ENTER, holdDur: HOLD, exitDur: EXIT, done: false },
      { text: word2, fromX:  OFF, toX: -OFF, elapsed: 0, enterDur: ENTER, holdDur: HOLD, exitDur: EXIT, done: false },
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
        b.text.x = b.fromX + (RCX - b.fromX) * p;
        b.text.scale.set(1);
      } else if (t < b.enterDur + b.holdDur) {
        // Hold at centre; scale pulses once (elastic feel without position bounce)
        b.text.x = RCX;
        const hp = (t - b.enterDur) / b.holdDur;
        const pulse = 1 + 0.18 * Math.sin(Math.PI * hp);
        b.text.scale.set(pulse);
      } else {
        // Accelerate out — continues in the same direction
        b.text.scale.set(1);
        const p = easeInCubic((t - b.enterDur - b.holdDur) / b.exitDur);
        b.text.x = RCX + (b.toX - RCX) * p;
      }
    }

    if (allDone) this.stop();
  }

  stop(): void {
    this.banners.forEach(b => b.text.destroy());
    this.banners = [];
    this.container.visible = false;
  }
}

/**
 * Maps win amount to a celebration category based on win/totalBet ratio.
 * Thresholds: BIG ≥ 2×, HUGE ≥ 5×, EPIC ≥ 20×, MAX ≥ 50×.
 */
export function getWinCategory(winAmount: number, totalBet: number): WinCategory | null {
  const x = winAmount / totalBet;
  if (x >= 50) return 'max';
  if (x >= 20) return 'epic';
  if (x >= 5)  return 'huge';
  if (x >= 2)  return 'big';
  return null;
}
