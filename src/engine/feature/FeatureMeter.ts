import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { vGradient } from '../ui/textStyle';
import type { SlotConfig } from '../config/SlotConfig';
import { t } from '../i18n/I18n';
import { fitText } from '../ui/fitText';

const MAX_DOTS = 5;

const STYLE = new TextStyle({
  fontFamily: '"Roboto Condensed", "Arial Narrow", Arial, sans-serif',
  fontSize: 17, fontWeight: 'bold', fill: vGradient(['#FFF3C4', '#FFC94A']), stroke: { color: 0x2A0A00, width: 3 },
});

/** Plate above the reels: "RESPINS ●●○" and the running total of the feature. */
export class FeatureMeter {
  readonly container = new Container();
  private plate = new Graphics();
  private respins = new Text({ text: '', style: STYLE });
  private total = new Text({ text: '', style: STYLE });
  private dots = new Graphics();
  private readonly w: number;
  private popAge = -1;

  constructor(cfg: SlotConfig, private maxRespins: number) {
    this.w = cfg.reelAreaWidth * 0.86;
    const h = 30;
    this.container.position.set(cfg.reelOffsetX + cfg.reelAreaWidth / 2, cfg.feature?.meterY ?? cfg.reelOffsetY - h / 2 - 4);
    this.plate.roundRect(-this.w / 2, -h / 2, this.w, h, h / 2)
      .fill({ color: 0x12060F, alpha: 0.9 }).stroke({ width: 1.5, color: 0xFFC94A, alpha: 0.9 });
    this.respins.anchor.set(0, 0.5);
    this.respins.x = -this.w / 2 + 14;
    this.total.anchor.set(1, 0.5);
    this.total.x = this.w / 2 - 14;
    this.container.addChild(this.plate, this.respins, this.dots, this.total);
    this.container.visible = false;
  }

  show(respins: number, total: string): void {
    this.container.visible = true;
    this.setRespins(respins);
    this.setTotal(total);
  }

  private get asNumber(): boolean {
    return this.maxRespins > MAX_DOTS;
  }

  /** Where respins "fly in" for a counter value `n` (the dot that lights up, or the number), stage px. */
  counterPoint(n: number): { x: number; y: number } {
    const { x, y } = this.container.position;
    if (this.asNumber) return { x: x + this.respins.x + this.respins.width - 10, y };
    return { x: x + this.dotX(Math.max(n - 1, 0)), y };
  }

  /** Bounce of the counter after respins were added. */
  pop(): void {
    this.popAge = 0;
  }

  update(dt: number): void {
    if (this.popAge < 0) return;
    this.popAge += dt;
    const t = Math.min(this.popAge / 20, 1);
    const s = 1 + Math.sin(t * Math.PI) * 0.35;
    this.respins.scale.set(this.respinsScale * s);
    this.dots.scale.set(1, s);
    if (t >= 1) this.popAge = -1;
  }

  private respinsScale = 1;

  private dotX(i: number): number {
    return this.respins.x + this.respins.width + 12 + i * 16;
  }

  /** Dots for up to MAX_DOTS respins, a number beyond that (big scatter triggers). */
  setRespins(n: number): void {
    const asNumber = this.asNumber;
    this.respins.text = asNumber ? `${t('feature.respins')} ${n}` : t('feature.respins');
    this.respins.scale.set(1);
    fitText(this.respins, this.w * 0.42);
    this.respinsScale = this.respins.scale.x;
    const x0 = this.dotX(0);
    this.dots.clear();
    for (let i = 0; i < (asNumber ? 0 : this.maxRespins); i++) {
      this.dots.circle(x0 + i * 16, 0, 5.5).fill(i < n ? 0xFFC94A : 0x12060F).stroke({ width: 1.5, color: 0xFFC94A });
    }
  }

  setTotal(amount: string): void {
    this.total.text = t('feature.collected', { amount });
    fitText(this.total, this.w * 0.48);
  }

  hide(): void {
    this.container.visible = false;
  }
}
