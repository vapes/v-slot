import { Text, TextStyle, Container } from 'pixi.js';
import {
  GAME_WIDTH, GAME_HEIGHT,
  REEL_OFFSET_Y, REEL_AREA_HEIGHT,
} from '../core/Config';

const STATUS_Y = REEL_OFFSET_Y + REEL_AREA_HEIGHT + 50;

const FONT = 'Arial, Helvetica, sans-serif';
const LABEL_STYLE = new TextStyle({ fontFamily: FONT, fontSize: 20, fill: 0xFFD700 });
const VALUE_STYLE = new TextStyle({ fontFamily: FONT, fontSize: 20, fill: 0xFFFFFF });

export class GameHUD {
  readonly statusText: Text;
  readonly winLabelText: Text;
  readonly winValueText: Text;
  readonly lineInfoText: Text;
  readonly statsRow: Container;

  private balanceLabel: Text;
  private balanceValue: Text;
  private betLabel: Text;
  private betValue: Text;

  constructor() {
    this.statusText = new Text('', new TextStyle({
      fontFamily: FONT, fontSize: 28, fontWeight: 'bold', fill: 0xFFFFFF,
    }));
    this.statusText.anchor.set(0.5, 0.5);
    this.statusText.x = GAME_WIDTH / 2;
    this.statusText.y = STATUS_Y;

    this.winLabelText = new Text('WIN:', new TextStyle({
      fontFamily: FONT, fontSize: 28, fontWeight: 'bold', fill: 0xFFD700,
    }));
    this.winLabelText.anchor.set(0, 0.5);
    this.winLabelText.y = STATUS_Y;

    this.winValueText = new Text('', new TextStyle({
      fontFamily: FONT, fontSize: 28, fontWeight: 'bold', fill: 0xFFFFFF,
    }));
    this.winValueText.anchor.set(0, 0.5);
    this.winValueText.y = STATUS_Y;

    this.lineInfoText = new Text('', new TextStyle({
      fontFamily: FONT, fontSize: 20, fill: 0xFFFFFF,
    }));
    this.lineInfoText.anchor.set(0.5, 0);
    this.lineInfoText.x = GAME_WIDTH / 2;
    this.lineInfoText.y = STATUS_Y + 22;
    this.lineInfoText.visible = false;

    this.balanceLabel = new Text('Balance:', LABEL_STYLE);
    this.balanceValue = new Text('', VALUE_STYLE);
    this.betLabel = new Text('Bet:', LABEL_STYLE);
    this.betValue = new Text('', VALUE_STYLE);

    this.statsRow = new Container();
    this.statsRow.addChild(this.balanceLabel, this.balanceValue, this.betLabel, this.betValue);
    this.statsRow.y = GAME_HEIGHT - 60;
  }

  addToStage(stage: Container): void {
    stage.addChild(
      this.statusText, this.winLabelText, this.winValueText,
      this.lineInfoText, this.statsRow,
    );
  }

  setStatus(msg: string): void {
    this.statusText.text = msg;
    this.winLabelText.visible = false;
    this.winValueText.visible = false;
    this.lineInfoText.visible = false;
    this.statusText.visible = true;
  }

  setWinStatus(amount: number): void {
    this.statusText.visible = false;
    this.winLabelText.text = 'WIN:';
    this.winValueText.text = ` ${amount}`;
    const totalW = this.winLabelText.width + this.winValueText.width;
    this.winLabelText.x = (GAME_WIDTH - totalW) / 2;
    this.winValueText.x = this.winLabelText.x + this.winLabelText.width;
    this.winLabelText.visible = true;
    this.winValueText.visible = true;
  }

  setLineInfo(text: string): void {
    this.lineInfoText.text = text;
    this.lineInfoText.visible = true;
  }

  hideLineInfo(): void {
    this.lineInfoText.visible = false;
  }

  updateBalanceDisplay(balance: number, totalBet: number): void {
    this.balanceValue.text = ` ${balance}`;
    this.betValue.text = ` ${totalBet}`;

    const gap = 24;
    const balW = this.balanceLabel.width + this.balanceValue.width;
    const betW = this.betLabel.width + this.betValue.width;
    const totalW = balW + gap + betW;
    let x = (GAME_WIDTH - totalW) / 2;

    this.balanceLabel.x = x;
    x += this.balanceLabel.width;
    this.balanceValue.x = x;
    x += this.balanceValue.width + gap;
    this.betLabel.x = x;
    x += this.betLabel.width;
    this.betValue.x = x;
  }
}
