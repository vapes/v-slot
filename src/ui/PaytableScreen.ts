import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, SYMBOLS, PAYLINES, SYMBOL_COLORS } from '../core/Config';
import type { SymbolId } from '../core/Config';
import { Paytable } from '../math/Paytable';
import gameConfig from '../gameConfig.json';

const GOLD = 0xFFD700;
const WHITE = 0xFFFFFF;
const HEADER_H = 72;
const SCROLL_AREA_H = GAME_HEIGHT - HEADER_H;
const PAD = 20;

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

    // Dark overlay
    const bg = new Graphics();
    bg.beginFill(0x000000, 0.88);
    bg.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.endFill();
    bg.eventMode = 'static';
    this.container.addChild(bg);

    this.buildHeader();

    this.contentContainer = new Container();
    this.contentContainer.y = HEADER_H;
    this.container.addChild(this.contentContainer);

    const scrollMask = new Graphics();
    scrollMask.beginFill(WHITE);
    scrollMask.drawRect(0, HEADER_H, GAME_WIDTH, SCROLL_AREA_H);
    scrollMask.endFill();
    this.container.addChild(scrollMask);
    this.contentContainer.mask = scrollMask;

    this.buildContent();
    this.setupScroll();

    this.onWheel = (e: WheelEvent) => {
      if (!this._visible) return;
      this.scrollContent(this.contentContainer.y - e.deltaY * 0.5);
    };
    window.addEventListener('wheel', this.onWheel, { passive: true });
  }

  private buildHeader(): void {
    const headerBg = new Graphics();
    headerBg.beginFill(0x080810, 1);
    headerBg.drawRect(0, 0, GAME_WIDTH, HEADER_H);
    headerBg.endFill();
    this.container.addChild(headerBg);

    const title = new Text('GAME RULES', new TextStyle({
      fontFamily: 'Arial Black, Arial, Helvetica, sans-serif',
      fontSize: 22,
      fontWeight: 'bold',
      fill: GOLD,
      letterSpacing: 3,
    }));
    title.anchor.set(0.5, 0.5);
    title.x = GAME_WIDTH / 2;
    title.y = HEADER_H / 2;
    this.container.addChild(title);

    const closeBtn = this.makeCloseButton();
    closeBtn.x = GAME_WIDTH - 36;
    closeBtn.y = HEADER_H / 2;
    this.container.addChild(closeBtn);
  }

  private makeCloseButton(): Container {
    const btn = new Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    const bg = new Graphics();
    const draw = (alpha: number) => {
      bg.clear();
      bg.lineStyle(2, WHITE, 0.35);
      bg.beginFill(WHITE, alpha);
      bg.drawCircle(0, 0, 18);
      bg.endFill();
    };
    draw(0.1);

    const label = new Text('✕', new TextStyle({
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 16,
      fill: WHITE,
    }));
    label.anchor.set(0.5, 0.5);

    btn.addChild(bg, label);
    btn.on('pointertap', () => this.hide());
    btn.on('pointerover', () => draw(0.24));
    btn.on('pointerout', () => draw(0.1));
    return btn;
  }

  private buildContent(): void {
    let y = 24;

    y = this.addSubtitle('All symbols pay from left to right\non adjacent reels starting from the\nleftmost reel.', y);
    y += 28;

    y = this.addSymbolGrid(y);
    y += 24;

    y = this.addSectionDivider('Winning Lines (20)', y);
    y += 12;
    y = this.addPaylinesGrid(y);

    y += 20;
    y = this.addRTPBlock(y);

    y += 48;
    this.contentHeight = y;
  }

  private addSubtitle(text: string, y: number): number {
    const label = new Text(text, new TextStyle({
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 15,
      fill: WHITE,
      align: 'center',
      lineHeight: 22,
    }));
    label.anchor.set(0.5, 0);
    label.x = GAME_WIDTH / 2;
    label.y = y;
    this.contentContainer.addChild(label);
    return y + label.height;
  }

  private addSymbolGrid(y: number): number {
    const COLS = 3;
    const COL_GAP = 14;
    const BOX_W = Math.floor((GAME_WIDTH - PAD * 2 - COL_GAP * (COLS - 1)) / COLS);
    const BOX_H = 148;
    const ROW_GAP = 14;

    for (let i = 0; i < SYMBOLS.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = PAD + col * (BOX_W + COL_GAP);
      const boxY = y + row * (BOX_H + ROW_GAP);
      this.addSymbolBox(SYMBOLS[i], x, boxY, BOX_W, BOX_H);
    }

    const rows = Math.ceil(SYMBOLS.length / COLS);
    return y + rows * (BOX_H + ROW_GAP) - ROW_GAP;
  }

  private addSymbolBox(id: SymbolId, x: number, y: number, w: number, h: number): void {
    // Outer box with gold border
    const box = new Graphics();
    box.lineStyle(2, GOLD, 0.55);
    box.beginFill(0x1A1025, 1);
    box.drawRoundedRect(x, y, w, h, 14);
    box.endFill();
    this.contentContainer.addChild(box);

    // Symbol square — centered in upper portion of box
    const SQ = 72;
    const sqX = x + (w - SQ) / 2;
    const sqY = y + 14;

    const sqBg = new Graphics();
    sqBg.lineStyle(2, GOLD, 0.4);
    sqBg.beginFill(SYMBOL_COLORS[id], 0.85);
    sqBg.drawRoundedRect(sqX, sqY, SQ, SQ, 10);
    sqBg.endFill();
    this.contentContainer.addChild(sqBg);

    const letter = new Text(id, new TextStyle({
      fontFamily: 'Arial Black, Arial, Helvetica, sans-serif',
      fontSize: 28,
      fontWeight: 'bold',
      fill: WHITE,
      dropShadow: true,
      dropShadowDistance: 2,
      dropShadowAlpha: 0.6,
    }));
    letter.anchor.set(0.5, 0.5);
    letter.x = sqX + SQ / 2;
    letter.y = sqY + SQ / 2;
    this.contentContainer.addChild(letter);

    // Payout label "3 - $X.XX"
    const mult = Paytable.getPayout(id, 3);
    const dollarAmt = (mult * 1).toFixed(2);
    const payText = new Text(`3 - $${dollarAmt}`, new TextStyle({
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 14,
      fontWeight: 'bold',
      fill: WHITE,
    }));
    payText.anchor.set(0.5, 0);
    payText.x = x + w / 2;
    payText.y = sqY + SQ + 10;
    this.contentContainer.addChild(payText);
  }

  private addSectionDivider(text: string, y: number): number {
    const line1 = new Graphics();
    line1.lineStyle(1, WHITE, 0.15);
    line1.moveTo(PAD, y + 10);
    line1.lineTo(GAME_WIDTH / 2 - 80, y + 10);
    this.contentContainer.addChild(line1);

    const label = new Text(text.toUpperCase(), new TextStyle({
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 11,
      fill: WHITE,
      letterSpacing: 2.5,
    }));
    label.alpha = 0.4;
    label.anchor.set(0.5, 0.5);
    label.x = GAME_WIDTH / 2;
    label.y = y + 10;
    this.contentContainer.addChild(label);

    const line2 = new Graphics();
    line2.lineStyle(1, WHITE, 0.15);
    line2.moveTo(GAME_WIDTH / 2 + 80, y + 10);
    line2.lineTo(GAME_WIDTH - PAD, y + 10);
    this.contentContainer.addChild(line2);

    return y + label.height + 10;
  }

  private addPaylinesGrid(y: number): number {
    const COLS = 2;
    const CONTENT_W = GAME_WIDTH - PAD * 2;
    const COL_W = (CONTENT_W - 8) / 2;
    const ITEM_H = 50;
    const CELL = 7;
    const CELL_GAP = 2;

    for (let i = 0; i < PAYLINES.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = PAD + col * (COL_W + 8);
      const itemY = y + row * (ITEM_H + 7);

      const card = new Graphics();
      card.beginFill(WHITE, 0.05);
      card.drawRoundedRect(x, itemY, COL_W, ITEM_H, 10);
      card.endFill();
      this.contentContainer.addChild(card);

      const lineNum = new Text(`#${i + 1}`, new TextStyle({
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: 11,
        fill: WHITE,
      }));
      lineNum.alpha = 0.35;
      lineNum.anchor.set(1, 0.5);
      lineNum.x = x + 28;
      lineNum.y = itemY + ITEM_H / 2;
      this.contentContainer.addChild(lineNum);

      const pattern = PAYLINES[i];
      const gridH = 3 * (CELL + CELL_GAP) - CELL_GAP;
      const gridX = x + 34;
      const gridY = itemY + (ITEM_H - gridH) / 2;

      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 5; c++) {
          const active = pattern[c] === r;
          const cell = new Graphics();
          cell.beginFill(active ? GOLD : WHITE, active ? 1 : 0.1);
          cell.drawRoundedRect(0, 0, CELL, CELL, 1);
          cell.endFill();
          cell.x = gridX + c * (CELL + CELL_GAP);
          cell.y = gridY + r * (CELL + CELL_GAP);
          this.contentContainer.addChild(cell);
        }
      }
    }

    const rows = Math.ceil(PAYLINES.length / COLS);
    return y + rows * (ITEM_H + 7) - 7;
  }

  private addRTPBlock(y: number): number {
    const CONTENT_W = GAME_WIDTH - PAD * 2;
    const H = 110;

    const block = new Graphics();
    block.lineStyle(1, GOLD, 0.25);
    block.beginFill(GOLD, 0.07);
    block.drawRoundedRect(PAD, y, CONTENT_W, H, 14);
    block.endFill();
    this.contentContainer.addChild(block);

    const rtpLabel = new Text('RETURN TO PLAYER', new TextStyle({
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 11,
      fill: WHITE,
      letterSpacing: 2.5,
    }));
    rtpLabel.alpha = 0.45;
    rtpLabel.anchor.set(0.5, 0);
    rtpLabel.x = PAD + CONTENT_W / 2;
    rtpLabel.y = y + 14;
    this.contentContainer.addChild(rtpLabel);

    const rtpValue = new Text(`${Math.round(gameConfig.rtp * 100)}%`, new TextStyle({
      fontFamily: 'Arial Black, Arial, Helvetica, sans-serif',
      fontSize: 38,
      fontWeight: 'bold',
      fill: GOLD,
    }));
    rtpValue.anchor.set(0.5, 0);
    rtpValue.x = PAD + CONTENT_W / 2;
    rtpValue.y = y + 30;
    this.contentContainer.addChild(rtpValue);

    const rtpNote = new Text('Theoretical RTP over long-term play', new TextStyle({
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 11,
      fill: WHITE,
    }));
    rtpNote.alpha = 0.3;
    rtpNote.anchor.set(0.5, 0);
    rtpNote.x = PAD + CONTENT_W / 2;
    rtpNote.y = y + 78;
    this.contentContainer.addChild(rtpNote);

    return y + H;
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
    const minY = HEADER_H - this.contentHeight + SCROLL_AREA_H;
    const maxY = HEADER_H;
    this.contentContainer.y = Math.max(minY, Math.min(maxY, newY));
  }

  show(): void {
    this._visible = true;
    this.container.visible = true;
    this.contentContainer.y = HEADER_H;
  }

  hide(): void {
    this._visible = false;
    this.container.visible = false;
  }

  toggle(): void {
    this._visible ? this.hide() : this.show();
  }

  destroy(): void {
    window.removeEventListener('wheel', this.onWheel);
    this.container.destroy({ children: true });
  }
}

/** Circular "i" button for toggling the paytable. */
export class InfoButton {
  readonly container: Container;
  private bg: Graphics;

  constructor(onTap: () => void) {
    this.container = new Container();
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';

    this.bg = new Graphics();
    this.container.addChild(this.bg);
    this.draw(0.12);

    const label = new Text('i', new TextStyle({
      fontFamily: "Georgia, 'Times New Roman', serif",
      fontSize: 20,
      fontStyle: 'italic',
      fontWeight: 'bold',
      fill: WHITE,
    }));
    label.anchor.set(0.5, 0.5);
    this.container.addChild(label);

    this.container.on('pointertap', onTap);
    this.container.on('pointerover', () => this.draw(0.22));
    this.container.on('pointerout', () => this.draw(0.12));
  }

  private draw(alpha: number): void {
    this.bg.clear();
    this.bg.lineStyle(2, WHITE, 0.35);
    this.bg.beginFill(WHITE, alpha);
    this.bg.drawCircle(0, 0, 22);
    this.bg.endFill();
  }
}
