import type { Container } from 'pixi.js';
import { InfoButton, type BetControlsState, type GameActions, type GameView } from '@/engine';
import { config } from '../config';
import { ClassicSpinButton } from './ClassicSpinButton';
import { ClassicBetButton } from './ClassicBetButton';
import { ClassicHUD } from './ClassicHUD';
import { buildClassicPaytable } from './ClassicPaytable';

const BET_RADIUS = 35;
const BET_GAP = 25;

/** Original V-Slot look: flat colours, Graphics buttons, "i" paytable toggle. */
export class ClassicView implements GameView {
  readonly spinButton = new ClassicSpinButton();
  readonly hud = new ClassicHUD();
  private readonly betDecr = new ClassicBetButton('−');
  private readonly betIncr = new ClassicBetButton('+');
  private readonly infoBtn: InfoButton;

  constructor(actions: GameActions) {
    this.betDecr.onClick(() => actions.changeBet(-1));
    this.betIncr.onClick(() => actions.changeBet(1));
    this.infoBtn = new InfoButton(actions.togglePaytable);
    this.infoBtn.container.position.set(46, config.canvas.height - 46);

    const cx = config.canvas.width / 2;
    const cy = this.spinButton.container.y + 50;
    this.betDecr.container.position.set(cx - 50 - BET_GAP - BET_RADIUS * 2, cy - BET_RADIUS);
    this.betIncr.container.position.set(cx + 50 + BET_GAP, cy - BET_RADIUS);
  }

  mountBelowReels(_stage: Container): void {
    // Plain background colour (config.backgroundColor) + reelStyle panel.
  }

  mountAboveReels(stage: Container): void {
    stage.addChild(this.spinButton.container, this.betDecr.container, this.betIncr.container);
    this.hud.addToStage(stage);
    stage.addChild(this.infoBtn.container);
  }

  setBetControls({ enabled, canDecrease, canIncrease }: BetControlsState): void {
    this.betDecr.enabled = enabled && canDecrease;
    this.betIncr.enabled = enabled && canIncrease;
  }

  buildPaytable(root: Container, lineBet: number): number {
    return buildClassicPaytable(root, lineBet);
  }
}
