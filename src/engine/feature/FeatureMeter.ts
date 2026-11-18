import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { vGradient } from '../ui/textStyle';
import type { SlotConfig } from '../config/SlotConfig';
import { t } from '../i18n/I18n';
import { fitText } from '../ui/fitText';

const STYLE = new TextStyle({
  fontFamily: '"Roboto Condensed", "Arial Narrow", Arial, sans-serif',
  fontSize: 17, fontWeight: 'bold', fill: vGradient(['#FFF3C4', '#FFC94A']), stroke: { color: 0x2A0A00, width: 3 },
});
const COUNT_STYLE = new TextStyle({
  fontFamily: '"Roboto Condensed", "Arial Narrow", Arial, sans-serif',
  fontSize: 22, fontWeight: 'bold', fill: vGradient(['#FFFFFF', '#FFD34A']), stroke: { color: 0x2A0A00, width: 3 },
});

/** Pop of the counter after respins were added, frames. */
const POP = 20;

/** Plate above the reels: "RESPINS 3" (the count is a number) and the running total of the feature. */
export class FeatureMeter {
  readonly container = new Container();
  private plate = new Graphics();
  private label = new Text({ text: '', style: STYLE });
  private count = new Text({ text: '', style: COUNT_STYLE });
  private total = new Text({ text: '', style: STYLE });
  private readonly w: number;
  private popAge = -1;

  constructor(cfg: SlotConfig) {
    this.w = cfg.reelAreaWidth * 0.86;
    const h = 30;
    this.container.position.set(cfg.reelOffsetX + cfg.reelAreaWidth / 2, cfg.feature?.meterY ?? cfg.reelOffsetY - h / 2 - 4);
    this.plate.roundRect(-this.w / 2, -h / 2, this.w, h, h / 2)
      .fill({ color: 0x12060F, alpha: 0.9 }).stroke({ width: 1.5, color: 0xFFC94A, alpha: 0.9 });
    this.label.anchor.set(0, 0.5);
    this.label.x = -this.w / 2 + 14;
    this.count.anchor.set(0.5);
    this.total.anchor.set(1, 0.5);
    this.total.x = this.w / 2 - 14;
    this.container.addChild(this.plate, this.label, this.count, this.total);
    this.container.visible = false;
  }

  /** `labelKey`: i18n key of the counter caption (respins / free spins). */
  show(respins: number, total: string, labelKey = 'feature.respins'): void {
    this.label.text = t(labelKey);
    fitText(this.label, this.w * 0.3);
    this.container.visible = true;
    this.setRespins(respins);
    this.setTotal(total);
  }

  /** Where respins "fly in": the counter number, stage px. */
  counterPoint(): { x: number; y: number } {
    const { x, y } = this.container.position;
    return { x: x + this.count.x, y: y + this.count.y };
  }

  /** Bounce of the counter after respins were added. */
  pop(): void {
    this.popAge = 0;
  }

  update(dt: number): void {
    if (this.popAge < 0) return;
    this.popAge += dt;
    const p = Math.min(this.popAge / POP, 1);
    this.count.scale.set(1 + Math.sin(p * Math.PI) * 0.45);
    if (p >= 1) this.popAge = -1;
  }

  setRespins(n: number): void {
    const text = String(n);
    if (this.count.text !== text) this.count.text = text;
    this.count.x = this.label.x + this.label.width + 10 + this.count.width / this.count.scale.x / 2;
  }

  setTotal(amount: string): void {
    this.total.text = t('feature.collected', { amount });
    fitText(this.total, this.w * 0.48);
  }

  hide(): void {
    this.container.visible = false;
  }
}
