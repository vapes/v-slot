import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { SlotConfig } from '../config/SlotConfig';
import { DEFAULT_THEME, type PaytableTheme } from './paytableBlocks';

const HEADER_H = 64;

export type PaytableBuilder = (root: Container, lineBet: number) => number;

/**
 * Pixi-only scrollable paytable overlay (drag + wheel). The body is built by
 * the game view (GameView.buildPaytable) every time it opens, so payouts can
 * show money for the current bet. HARD RULE: no HTML here.
 */
export class PaytableScreen {
  readonly container: Container;
  private contentContainer: Container;
  private _visible = false;
  private isDragging = false;
  private dragStartY = 0;
  private contentStartY = 0;
  private contentHeight = 0;
  private readonly areaH: number;
  private readonly onWheel: (e: WheelEvent) => void;

  constructor(cfg: SlotConfig, private build: PaytableBuilder, private theme: PaytableTheme = DEFAULT_THEME) {
    const { width: W, height: H } = cfg.canvas;
    this.areaH = H - HEADER_H;
    this.container = new Container();
    this.container.visible = false;
    this.container.eventMode = 'static';

    const bg = new Graphics();
    bg.beginFill(theme.overlay, 0.94);
    bg.drawRect(0, 0, W, H);
    bg.endFill();
    bg.eventMode = 'static';
    this.container.addChild(bg);

    this.contentContainer = new Container();
    this.contentContainer.y = HEADER_H;
    this.container.addChild(this.contentContainer);

    const scrollMask = new Graphics();
    scrollMask.beginFill(0xFFFFFF);
    scrollMask.drawRect(0, HEADER_H, W, this.areaH);
    scrollMask.endFill();
    this.container.addChild(scrollMask);
    this.contentContainer.mask = scrollMask;

    this.setupScroll(W);
    this.buildHeader(W, cfg.title);

    this.onWheel = (e: WheelEvent) => {
      if (this._visible) this.scrollContent(this.contentContainer.y - e.deltaY * 0.5);
    };
    window.addEventListener('wheel', this.onWheel, { passive: true });
  }

  get isOpen(): boolean {
    return this._visible;
  }

  private buildHeader(W: number, title: string): void {
    const { accent, header, font } = this.theme;
    const headerBg = new Graphics();
    headerBg.beginFill(header, 1);
    headerBg.drawRect(0, 0, W, HEADER_H);
    headerBg.endFill();
    headerBg.lineStyle(1.5, accent, 0.6);
    headerBg.moveTo(0, HEADER_H).lineTo(W, HEADER_H);

    const label = new Text(`${title.toUpperCase()} · RULES`, new TextStyle({
      fontFamily: font, fontSize: 20, fontWeight: 'bold', fill: accent, letterSpacing: 2,
    }));
    label.anchor.set(0.5);
    label.position.set(W / 2, HEADER_H / 2);

    const closeBtn = new Container();
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    const circle = new Graphics();
    circle.lineStyle(2, accent, 0.8);
    circle.beginFill(header, 1);
    circle.drawCircle(0, 0, 18);
    circle.endFill();
    const x = new Text('✕', new TextStyle({ fontFamily: 'Arial, sans-serif', fontSize: 16, fill: accent }));
    x.anchor.set(0.5);
    closeBtn.addChild(circle, x);
    closeBtn.position.set(W - 34, HEADER_H / 2);
    closeBtn.on('pointertap', () => this.hide());

    this.container.addChild(headerBg, label, closeBtn);
  }

  private setupScroll(W: number): void {
    const hitArea = new Graphics();
    hitArea.beginFill(0xFFFFFF, 0.001);
    hitArea.drawRect(0, HEADER_H, W, this.areaH);
    hitArea.endFill();
    hitArea.eventMode = 'static';
    this.container.addChild(hitArea);

    hitArea.on('pointerdown', (e) => {
      this.isDragging = true;
      this.dragStartY = e.global.y;
      this.contentStartY = this.contentContainer.y;
    });
    hitArea.on('pointermove', (e) => {
      if (this.isDragging) this.scrollContent(this.contentStartY + (e.global.y - this.dragStartY));
    });
    hitArea.on('pointerup', () => { this.isDragging = false; });
    hitArea.on('pointerupoutside', () => { this.isDragging = false; });
  }

  private scrollContent(newY: number): void {
    const minY = Math.min(HEADER_H, HEADER_H - this.contentHeight + this.areaH);
    this.contentContainer.y = Math.max(minY, Math.min(HEADER_H, newY));
  }

  /** Open with payouts rendered for the given line bet (minor units). */
  show(lineBet: number): void {
    this.contentContainer.removeChildren().forEach(c => c.destroy({ children: true }));
    this.contentHeight = this.build(this.contentContainer, lineBet);
    this._visible = true;
    this.container.visible = true;
    this.contentContainer.y = HEADER_H;
  }

  hide(): void {
    this._visible = false;
    this.container.visible = false;
  }

  toggle(lineBet: number): void {
    this._visible ? this.hide() : this.show(lineBet);
  }
}

/** Circular "i" button (Pixi Graphics) that toggles the paytable. */
export class InfoButton {
  readonly container: Container;
  private bg = new Graphics();

  constructor(onTap: () => void) {
    this.container = new Container();
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';
    this.container.addChild(this.bg);
    this.draw(0.12);

    const label = new Text('i', new TextStyle({
      fontFamily: "Georgia, 'Times New Roman', serif",
      fontSize: 20, fontStyle: 'italic', fontWeight: 'bold', fill: 0xFFFFFF,
    }));
    label.anchor.set(0.5);
    this.container.addChild(label);

    this.container.on('pointertap', onTap);
    this.container.on('pointerover', () => this.draw(0.22));
    this.container.on('pointerout', () => this.draw(0.12));
  }

  private draw(alpha: number): void {
    this.bg.clear();
    this.bg.lineStyle(2, 0xFFFFFF, 0.35);
    this.bg.beginFill(0xFFFFFF, alpha);
    this.bg.drawCircle(0, 0, 22);
    this.bg.endFill();
  }
}
