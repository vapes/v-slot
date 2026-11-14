import type { SpinControl } from '../contracts';

export interface InputCallbacks {
  onSpin(): void;
  onStop(): void;
  /** False while a modal (paytable) covers the game. */
  canInteract(): boolean;
}

/**
 * Spin input: pointer on the spin button (window-level, so a held press is
 * tracked for turbo) and the spacebar. `buttonHeld` drives hold-to-turbo.
 * Other buttons are plain Pixi objects wired by the game view.
 */
export class GameInput {
  buttonHeld = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private gameWidth: number,
    private spinButton: SpinControl,
    callbacks: InputCallbacks,
  ) {
    const press = () => {
      if (spinButton.isStopMode) {
        callbacks.onStop();
      } else if (spinButton.enabled) {
        this.buttonHeld = true;
        callbacks.onSpin();
      }
    };
    const release = () => { this.buttonHeld = false; };

    window.addEventListener('pointerdown', (e) => {
      if (callbacks.canInteract() && this.isOnSpinButton(e)) press();
    });
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat && callbacks.canInteract()) {
        e.preventDefault();
        press();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') release();
    });
  }

  private isOnSpinButton(e: PointerEvent): boolean {
    const rect = this.canvas.getBoundingClientRect();
    const cssScale = rect.width / this.gameWidth;
    return this.spinButton.hitTest((e.clientX - rect.left) / cssScale, (e.clientY - rect.top) / cssScale);
  }
}
