import { GAME_WIDTH } from './Config';
import type { SpinButton } from '../ui/SpinButton';
import type { SpriteButton } from '../ui/SpriteButton';

export interface InputCallbacks {
  onSpin(): void;
  onStop(): void;
  onBetChange(delta: -1 | 1): void;
  /** False while a modal (paytable) covers the game. */
  canInteract(): boolean;
}

export class GameInput {
  buttonHeld = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private spinButton: SpinButton,
    betDecrBtn: SpriteButton,
    betIncrBtn: SpriteButton,
    callbacks: InputCallbacks,
  ) {
    window.addEventListener('pointerdown', (e) => {
      if (!callbacks.canInteract() || !this.isOnSpinButton(e)) return;
      if (spinButton.isStopMode) {
        callbacks.onStop();
      } else if (spinButton.enabled) {
        console.log('spin button down');
        this.buttonHeld = true;
        callbacks.onSpin();
      }
    });
    window.addEventListener('pointerup', () => {
      if (this.buttonHeld) console.log('spin button up');
      this.buttonHeld = false;
    });
    window.addEventListener('pointercancel', () => {
      if (this.buttonHeld) console.log('spin button up');
      this.buttonHeld = false;
    });

    betDecrBtn.onClick(() => callbacks.onBetChange(-1));
    betIncrBtn.onClick(() => callbacks.onBetChange(1));

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat && callbacks.canInteract()) {
        e.preventDefault();
        if (spinButton.isStopMode) {
          callbacks.onStop();
        } else if (spinButton.enabled) {
          console.log('spin button down');
          this.buttonHeld = true;
          callbacks.onSpin();
        }
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        console.log('spin button up');
        this.buttonHeld = false;
      }
    });
  }

  private isOnSpinButton(e: PointerEvent): boolean {
    const rect = this.canvas.getBoundingClientRect();
    const cssScale = rect.width / GAME_WIDTH;
    const gameX = (e.clientX - rect.left) / cssScale;
    const gameY = (e.clientY - rect.top) / cssScale;
    const cx = this.spinButton.centerX;
    const cy = this.spinButton.centerY;
    const r = this.spinButton.radius;
    return (gameX - cx) ** 2 + (gameY - cy) ** 2 <= r * r;
  }
}
