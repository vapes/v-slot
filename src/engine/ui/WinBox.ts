import { Container, Graphics, Text } from 'pixi.js';
import type { SlotConfig } from '../config/SlotConfig';
import { CoinShower } from '../fx/CoinShower';
import { formatMoney } from '../utils/Money';
import { gameEvents } from '../core/GameEvents';
import { t } from '../i18n/I18n';
import { fitText } from './fitText';
import { DEFAULT_STYLES, drawGlow, drawPanel, type WinBoxLayout } from './winBoxStyle';
import { WinTitle } from './WinTitle';
import { planWinTicks, WIN_TIERS, type TickSegment } from './winTicks';
import type { WinCategory } from './WinCelebration';

const FRAME_MS = 1000 / 60;
/** Taps closer than this count as one (pointer + spin input may both report it). */
const SKIP_DEBOUNCE_MS = 300;


const smooth = (x: number) => x * x * (3 - 2 * x);

/**
 * Win box (engine-owned, every game): the HUD panel for the status line
 * and the win amount (line info is ui/LineInfo under the reels); the game only places it (GameView.winBox). A win counts up
 * (small wins quickly, in place). A BIG+ win keeps counting while the box rides
 * onto the reels (dimmed screen), the title switches BIG → HUGE → EPIC → MAX as
 * the counter passes each threshold, and coins / glints grow with every tier;
 * then it holds and returns. A tap (or SPIN) jumps to the final amount, a second
 * tap closes. The engine drives it only outside turbo / quick spins.
 */
export class WinBox {
  readonly container = new Container();
  private shade = new Graphics();
  private shower: CoinShower;
  private title: WinTitle;
  private box = new Container();
  private glow = new Graphics();
  private status: Text;
  private caption: Text;
  private amount: Text;
  private readonly home: { x: number; y: number };
  private readonly stage: { x: number; y: number };
  private readonly s: SlotConfig['winBox'];

  private plan: TickSegment[] = [];
  private seg = 0;
  private segT = 0;
  private from = 0;
  private value = 0;
  private target = 0;
  private tier = -1;
  private big = false;
  private hold = 0;
  private away = 0;
  private awayTarget = 0;
  private refresh = 0;
  private shown = '';
  private emitCoins = 0;
  private emitRain = 0;
  private lastSkip = 0;
  private done: (() => void) | null = null;

  constructor(private cfg: SlotConfig, private rect: WinBoxLayout) {
    this.s = cfg.winBox;
    const st = { ...DEFAULT_STYLES, ...rect.styles };
    const { width: W, height: H } = cfg.canvas;
    const { w, h } = rect;
    this.home = { x: rect.x, y: rect.y };
    this.stage = { x: cfg.reelOffsetX + cfg.reelAreaWidth / 2, y: cfg.reelOffsetY + cfg.reelAreaHeight * 0.62 };

    this.shade.rect(0, 0, W, H).fill(0x000000);
    this.shade.visible = false;
    this.shade.on('pointertap', () => this.skip());
    this.shower = new CoinShower(W, H);
    this.title = new WinTitle(W - 40);
    this.title.container.position.set(this.stage.x, this.stage.y - (h * this.s.bigScale) / 2 - 92);
    this.title.container.visible = false;

    drawGlow(this.glow, w, h, st.panel);
    this.glow.blendMode = 'add';
    this.glow.alpha = 0;
    const panel = drawPanel(new Graphics(), w, h, st.panel);
    // empty socket left in the HUD while the box is on the reels
    const socket = drawPanel(new Graphics(), w, h, st.panel);
    socket.position.set(rect.x, rect.y);
    this.status = new Text({ text: '', style: st.status });
    this.caption = new Text({ text: '', style: st.caption });
    this.amount = new Text({ text: '', style: st.amount });
    for (const txt of [this.status, this.caption, this.amount]) txt.anchor.set(0.5);
    // the amount is scaled up on the reels: rasterise it sharp enough for that
    this.amount.resolution = Math.min(window.devicePixelRatio || 1, 2) * this.s.bigScale;
    this.caption.y = -h * 0.22;
    this.box.addChild(this.glow, panel, this.status, this.caption, this.amount);
    this.box.position.set(this.home.x, this.home.y);
    this.container.addChild(socket, this.shade, this.shower.container, this.title.container, this.box);
    this.pose();
  }

  /** Neutral status line ("Good luck!"); ends any count-up. */
  setStatus(text: string): void {
    this.finish();
    this.status.text = text;
    fitText(this.status, this.rect.w - 24);
    this.status.visible = true;
    this.caption.visible = this.amount.visible = false;
  }

  /** Win amount at once (turbo / quick spins). */
  showWin(amount: number): void {
    this.finish();
    this.value = this.target = amount;
    this.winLayout();
    this.drawAmount(true);
  }

  /** Count the win up; BIG+ wins ride onto the reels. Resolves when the box is back. */
  countUp(amount: number, totalBet: number): Promise<void> {
    this.finish();
    this.plan = planWinTicks(amount, totalBet, this.cfg.celebration, this.s);
    this.seg = this.segT = this.from = this.value = 0;
    this.target = amount;
    this.tier = -1;
    this.big = this.plan.some(p => p.tier !== null);
    this.winLayout();
    this.drawAmount(true);
    return new Promise(resolve => { this.done = resolve; });
  }

  /** SPIN / tap during a BIG+ win: jump to the end, then close. True = input consumed. */
  skip(): boolean {
    if (!this.big) return false;
    const now = performance.now();
    if (now - this.lastSkip < SKIP_DEBOUNCE_MS) return true;
    this.lastSkip = now;
    if (this.seg < this.plan.length) {
      const last = this.plan[this.plan.length - 1].tier;
      this.seg = this.plan.length;
      this.value = this.target;
      this.drawAmount(true);
      if (last) this.enterTier(WIN_TIERS.indexOf(last));
      this.hold = this.s.holdMs;
      gameEvents.emit('winCountEnd', { amount: this.target });
    } else if (this.hold > 0) {
      this.hold = 0;
      this.awayTarget = 0;
    }
    return true;
  }

  /** End everything now (next spin): final amount in place, no particles. */
  finish(): void {
    if (this.seg < this.plan.length) this.value = this.target;
    this.plan = [];
    this.seg = 0;
    this.big = false;
    this.hold = 0;
    this.away = this.awayTarget = 0;
    this.tier = -1;
    this.shower.clear();
    this.title.reset();
    this.pose();
    if (this.amount.visible) this.drawAmount(true);
    const d = this.done;
    this.done = null;
    d?.();
  }

  update(dt: number): void {
    const ms = dt * FRAME_MS;
    if (this.seg < this.plan.length) this.count(ms);
    else if (this.hold > 0) {
      this.hold -= ms;
      if (this.hold <= 0) this.awayTarget = 0;
    }
    // ride between the HUD and the reels
    if (this.away !== this.awayTarget) {
      const step = ms / this.s.rideMs;
      this.away = this.awayTarget > this.away ? Math.min(this.away + step, 1) : Math.max(this.away - step, 0);
      this.pose();
      if (this.away === 0 && this.big && this.seg >= this.plan.length) this.close();
    }
    if (this.away > 0) {
      this.glow.alpha = 0.5 + 0.4 * Math.sin(performance.now() / 160);
      this.emit(dt);
    }
    this.title.update(dt);
    this.shower.update(dt);
  }

  private count(ms: number): void {
    const seg = this.plan[this.seg];
    if (seg.tier !== null && this.tier !== WIN_TIERS.indexOf(seg.tier)) this.enterTier(WIN_TIERS.indexOf(seg.tier));
    this.segT += ms;
    const p = Math.min(this.segT / seg.ms, 1);
    const last = this.seg === this.plan.length - 1;
    this.value = this.from + (seg.to - this.from) * (last ? 1 - (1 - p) ** 2 : p);
    if (p >= 1) {
      this.from = this.value = seg.to;
      this.seg++;
      this.segT = 0;
      if (this.seg >= this.plan.length) {
        this.drawAmount(true);
        gameEvents.emit('winCountEnd', { amount: this.target });
        if (this.big) this.hold = this.s.holdMs;
        else this.close();
        return;
      }
    }
    this.refresh += ms;
    if (this.refresh >= this.s.refreshMs) this.drawAmount(false);
  }

  private enterTier(i: number): void {
    if (i <= this.tier) return;
    this.tier = i;
    this.awayTarget = 1;
    this.title.container.visible = true;
    this.title.show(WIN_TIERS[i]);
    const { x, y } = this.title.container.position;
    this.shower.fountain(this.box.x, this.box.y, this.s.burst[i], 1.15);
    this.shower.glint(x, y, 18 + i * 8, 160);
    gameEvents.emit('winTier', { category: WIN_TIERS[i] as WinCategory });
  }

  /** Continuous coins / glints for the current tier (fractional counts carried over frames). */
  private emit(dt: number): void {
    if (this.tier < 0 || this.awayTarget === 0) return;
    const sec = dt / 60;
    this.emitCoins += this.s.coinRate[this.tier] * sec;
    this.emitRain += this.s.rainRate[this.tier] * sec;
    const coins = Math.floor(this.emitCoins);
    const rain = Math.floor(this.emitRain);
    if (coins > 0) this.shower.fountain(this.box.x, this.box.y - this.rect.h, coins, 0.9 + this.tier * 0.1);
    if (rain > 0) this.shower.rain(rain);
    if (coins > 0 && Math.random() < 0.5) this.shower.glint(this.box.x, this.box.y, 2, this.rect.w * this.s.bigScale);
    this.emitCoins -= coins;
    this.emitRain -= rain;
  }

  private close(): void {
    this.big = false;
    this.plan = [];
    this.seg = 0;
    this.title.reset();
    this.title.container.visible = false;
    const d = this.done;
    this.done = null;
    d?.();
  }

  /** Box position / scale, shade and title alpha from `away` (0 = HUD, 1 = reels). */
  private pose(): void {
    const k = smooth(this.away);
    this.box.position.set(this.home.x + (this.stage.x - this.home.x) * k, this.home.y + (this.stage.y - this.home.y) * k);
    this.box.scale.set(1 + (this.s.bigScale - 1) * k);
    this.shade.visible = this.away > 0;
    this.shade.alpha = this.s.shade * k;
    this.shade.eventMode = this.away > 0 ? 'static' : 'none';
    this.title.container.alpha = k;
    // on the reels the title says WIN: drop the caption, centre the amount
    this.caption.alpha = 1 - k;
    this.amount.y = this.rect.h * 0.17 * (1 - k);
    if (this.away === 0) {
      this.title.container.visible = false;
      this.glow.alpha = 0;
    }
  }

  private winLayout(): void {
    this.status.visible = false;
    this.caption.visible = this.amount.visible = true;
    this.caption.text = t('label.win');
    fitText(this.caption, this.rect.w - 28);
  }

  private drawAmount(force: boolean): void {
    this.refresh = 0;
    const text = formatMoney(this.cfg, Math.round(this.value));
    if (!force && text === this.shown) return;
    this.shown = text;
    this.amount.text = text;
    fitText(this.amount, this.rect.w - 28);
  }
}
