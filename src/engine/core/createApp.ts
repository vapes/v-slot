import { Application } from 'pixi.js';

/** Highest canvas resolution: 2× is sharp on phones; 3× DPR screens would triple the fill cost. */
const MAX_RESOLUTION = 2;
/** 120 Hz phones would render twice as often for no visible gain (animations are time-based). */
const MAX_FPS = 60;

/**
 * Pixi v8 application tuned for mobile:
 *  - WebGL renderer (WebGPU is still uneven on phones, and the flame shader is GLSL);
 *  - resolution = device pixel ratio capped at 2;
 *  - MSAA only on low-DPI screens: at 2× the extra pixels already smooth edges, and
 *    multisampling would cost memory bandwidth for nothing;
 *  - no pointer-move / wheel hit testing (the games use taps only);
 *  - high-performance GPU hint;
 *  - ticker capped at `maxFps` (60; the lobby uses less).
 */
export async function createApp(width: number, height: number, background: number, maxFps = MAX_FPS): Promise<Application> {
  const dpr = window.devicePixelRatio || 1;
  const app = new Application();
  await app.init({
    width,
    height,
    background,
    preference: 'webgl',
    resolution: Math.min(dpr, MAX_RESOLUTION),
    autoDensity: true,
    antialias: dpr < 2,
    powerPreference: 'high-performance',
    eventFeatures: { move: false, globalMove: false, click: true, wheel: false },
    hello: false,
  });
  app.ticker.maxFPS = maxFps;
  return app;
}
