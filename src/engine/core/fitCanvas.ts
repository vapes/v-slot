import type { Application } from 'pixi.js';

/** Scale the canvas to fit the window (letterboxed, centred). Portrait-first. */
export function fitCanvas(app: Application, width: number, height: number): void {
  const canvas = app.view as HTMLCanvasElement;
  const apply = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const scale = Math.min(w / width, h / height);
    canvas.style.width = `${width * scale}px`;
    canvas.style.height = `${height * scale}px`;
    canvas.style.position = 'absolute';
    canvas.style.left = `${(w - width * scale) / 2}px`;
    canvas.style.top = `${(h - height * scale) / 2}px`;
  };
  apply();
  window.addEventListener('resize', apply);
}

export function goToLobby(): void {
  window.location.search = '';
}
