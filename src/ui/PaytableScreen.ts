import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, uiAnchor } from '../core/Config';
import { buildPaytableContent } from './PaytableContent';
import { SpriteButton } from './SpriteButton';

const GOLD = 0xFFC94A;
const WHITE = 0xFFFFFF;
const HEADER_H = 64;
const SCROLL_AREA_H = GAME_HEIGHT - HEADER_H;

/** Pixi-based scrollable paytable / rules overlay (drag + wheel). */
export class PaytableScreen {
  readonly container: Container;
  private contentContainer: Container;
  private _visible = false;
  private isDragging = false;
  private dragStartY = 0;
  private contentStartY = 0;
  private contentHeight = 0;
  private readonly onWheel: (e: WheelEvent) => void;

  constructor() {
    this.container = new Container();
    this.container.visible = false;
    this.container.eventMode = 'static';

    const bg = new Graphics();
    bg.beginFill(0x0B0410, 0.94);
    bg.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.endFill();
    bg.eventMode = 'static';
    this.container.addChild(bg);

    this.contentContainer = new Container();
    this.contentContainer.y = HEADER_H;
    this.container.addChild(this.contentContainer);

    const scrollMask = new Graphics();
    scrollMask.beginFill(WHITE);
    scrollMask.drawRect(0, HEADER_H, GAME_WIDTH, SCROLL_AREA_H);
    scrollMask.endFill();
    this.container.addChild(scrollMask);
    this.contentContainer.mask = scrollMask;

    this.setupScroll();
    this.buildHeader();

    this.onWheel = (e: WheelEvent) => {
      if (!this._visible) return;
      this.scrollContent(this.contentContainer.y - e.deltaY * 0.5);
    };
    window.addEventListener('wheel', this.onWheel, { passive: true });
  }

  get isOpen(): boolean {
    return this._visible;
  }

  private buildHeader(): void {
    const headerBg = new Graphics();
    headerBg.beginFill(0x14081A, 1);
    headerBg.drawRect(0, 0, GAME_WIDTH, HEADER_H);
    headerBg.endFill();
    headerBg.lineStyle(1.5, GOLD, 0.6);
    headerBg.moveTo(0, HEADER_H).lineTo(GAME_WIDTH, HEADER_H);
    this.container.addChild(headerBg);

    const title = new Text('PAYTABLE & RULES', new TextStyle({
      fontFamily: '"Roboto Condensed", "Arial Narrow", Arial, sans-serif',
      fontSize: 22,
      fontWeight: 'bold',
      fill: ['#FFF3B0', '#FFC94A', '#E08A12'],
      letterSpacing: 2,
    }));
    title.anchor.set(0.5, 0.5);
    title.position.set(GAME_WIDTH / 2, HEADER_H / 2);
    this.container.addChild(title);

    const closeBtn = new Container();
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    const circle = new Graphics();
    circle.lineStyle(2, GOLD, 0.8);
    circle.beginFill(0x2A1230, 1);
    circle.drawCircle(0, 0, 18);
    circle.endFill();
    const x = new Text('✕', new TextStyle({ fontFamily: 'Arial, sans-serif', fontSize: 16, fill: GOLD }));
    x.anchor.set(0.5);
    closeBtn.addChild(circle, x);
    closeBtn.position.set(GAME_WIDTH - 34, HEADER_H / 2);
    closeBtn.on('pointertap', () => this.hide());
    this.container.addChild(closeBtn);
  }

  private setupScroll(): void {
    const hitArea = new Graphics();
    hitArea.beginFill(WHITE, 0.001);
    hitArea.drawRect(0, HEADER_H, GAME_WIDTH, SCROLL_AREA_H);
    hitArea.endFill();
    hitArea.eventMode = 'static';
    this.container.addChild(hitArea);

    hitArea.on('pointerdown', (e) => {
      this.isDragging = true;
      this.dragStartY = e.global.y;
      this.contentStartY = this.contentContainer.y;
    });
    hitArea.on('pointermove', (e) => {
      if (!this.isDragging) return;
      this.scrollContent(this.contentStartY + (e.global.y - this.dragStartY));
    });
    hitArea.on('pointerup', () => { this.isDragging = false; });
    hitArea.on('pointerupoutside', () => { this.isDragging = false; });
  }

  private scrollContent(newY: number): void {
    const minY = Math.min(HEADER_H, HEADER_H - this.contentHeight + SCROLL_AREA_H);
    this.contentContainer.y = Math.max(minY, Math.min(HEADER_H, newY));
  }

  /** Open the overlay; payouts are rendered for the given line bet (cents). */
  show(lineBet: number): void {
    this.contentContainer.removeChildren().forEach(c => c.destroy({ children: true }));
    this.contentHeight = buildPaytableContent(this.contentContainer, lineBet);
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

  destroy(): void {
    window.removeEventListener('wheel', this.onWheel);
    this.container.destroy({ children: true });
  }
}

/** Round menu button (top-left, sliced from the skin) that toggles the paytable. */
export class InfoButton extends SpriteButton {
  constructor(onTap: () => void) {
    const a = uiAnchor('menu');
    super('menu', 22);
    this.setPosition(a.x, a.y);
    this.onClick(onTap);
  }
}
