import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { SlotConfig } from '../config/SlotConfig';
import { t } from '../i18n/I18n';
import { fitText } from './fitText';

const HEADER = new TextStyle({
  fontFamily: '"Roboto Condensed", "Arial Narrow", Arial, sans-serif', fontSize: 18, fontWeight: 'bold',
  fill: 0xFFC94A, letterSpacing: 4, align: 'center',
});
const TITLE = new TextStyle({
  fontFamily: 'Arial Black, Arial, sans-serif', fontSize: 34, fontWeight: 'bold',
  fill: ['#FFF8D0', '#FFD34A', '#FF8A00'], fillGradientStops: [0, 0.5, 1],
  stroke: 0x3A0A00, strokeThickness: 6, align: 'center',
});
const PRICE = new TextStyle({
  fontFamily: '"Roboto Condensed", "Arial Narrow", Arial, sans-serif', fontSize: 34, fontWeight: 'bold',
  fill: 0xFFFFFF, stroke: 0x2A0A00, strokeThickness: 5, align: 'center',
});
const BUTTON = new TextStyle({
  fontFamily: '"Roboto Condensed", "Arial Narrow", Arial, sans-serif', fontSize: 22, fontWeight: 'bold',
  fill: 0xFFFFFF, stroke: 0x2A0A00, strokeThickness: 3, align: 'center',
});

const PANEL_H = 290;
const BTN_W = 150;
const BTN_H = 54;

/**
 * Feature-buy confirmation: dimmed screen, panel with the feature name,
 * "BUY FEATURE" and the price, BUY / CANCEL. `ask()` resolves true on BUY,
 * false on CANCEL or a tap outside the panel.
 */
export class BuyFeatureDialog {
  readonly container = new Container();
  private header = new Text('', HEADER);
  private title = new Text('', TITLE);
  private price = new Text('', PRICE);
  private confirmLabel = new Text('', BUTTON);
  private cancelLabel = new Text('', BUTTON);
  private resolve: ((ok: boolean) => void) | null = null;
  private readonly innerW: number;

  constructor(cfg: SlotConfig) {
    const { width: W, height: H } = cfg.canvas;
    const shade = new Graphics().beginFill(0x000000, 0.65).drawRect(0, 0, W, H).endFill();
    shade.eventMode = 'static';
    shade.on('pointertap', () => this.close(false));

    const pw = Math.min(cfg.reelAreaWidth * 0.96, W - 20);
    this.innerW = pw - 40;
    const panel = new Container();
    panel.position.set(cfg.reelOffsetX + cfg.reelAreaWidth / 2, cfg.reelOffsetY + cfg.reelAreaHeight / 2);
    panel.eventMode = 'static'; // taps on the panel do not close it
    const frame = new Graphics()
      .beginFill(0x1A0820, 0.97).lineStyle(3, 0xFFC94A, 1).drawRoundedRect(-pw / 2, -PANEL_H / 2, pw, PANEL_H, 18).endFill()
      .lineStyle(1, 0xFFC94A, 0.45).drawRoundedRect(-pw / 2 + 8, -PANEL_H / 2 + 8, pw - 16, PANEL_H - 16, 12);
    for (const [txt, y] of [[this.header, -108], [this.title, -58], [this.price, 4]] as const) {
      txt.anchor.set(0.5);
      txt.y = y;
    }
    const gap = 16;
    const confirm = this.button(this.confirmLabel, 0xE8A317, gap / 2 + BTN_W / 2, () => this.close(true));
    const cancel = this.button(this.cancelLabel, 0x3A2440, -gap / 2 - BTN_W / 2, () => this.close(false));
    panel.addChild(frame, this.header, this.title, this.price, cancel, confirm);
    this.container.addChild(shade, panel);
    this.container.visible = false;
  }

  get isOpen(): boolean {
    return this.container.visible;
  }

  /** Show the offer for `price` (formatted money); true = BUY. */
  ask(price: string): Promise<boolean> {
    this.close(false);
    this.header.text = t('feature.title');
    this.title.text = t('buy.title');
    this.price.text = price;
    this.confirmLabel.text = t('buy.confirm');
    this.cancelLabel.text = t('buy.cancel');
    fitText(this.header, this.innerW);
    fitText(this.title, this.innerW);
    fitText(this.price, this.innerW);
    fitText(this.confirmLabel, BTN_W - 16);
    fitText(this.cancelLabel, BTN_W - 16);
    this.container.visible = true;
    return new Promise(resolve => { this.resolve = resolve; });
  }

  private close(ok: boolean): void {
    this.container.visible = false;
    const r = this.resolve;
    this.resolve = null;
    r?.(ok);
  }

  private button(label: Text, fill: number, x: number, onTap: () => void): Container {
    const c = new Container();
    const bg = new Graphics()
      .beginFill(fill, 1).lineStyle(2, 0xFFE9A0, 0.9)
      .drawRoundedRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, BTN_H / 2).endFill();
    label.anchor.set(0.5);
    c.addChild(bg, label);
    c.position.set(x, PANEL_H / 2 - 30 - BTN_H / 2);
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.on('pointertap', (e) => { e.stopPropagation(); onTap(); });
    return c;
  }
}
